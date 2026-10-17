# Vehicle-owned odometer and accepted mileage

**Status:** implemented in the working tree, **not committed, not deployed, not verified in production.**
**Scope:** who owns a vehicle's mileage, which tracker readings may change it, how daily and cumulative
mileage are reconciled, what is shown on screen, and how to recover when something goes wrong.
**Extends:** [VEHICLE_ODOMETER_STANDARD.md](VEHICLE_ODOMETER_STANDARD.md) (business language) and
[VEHICLE_ODOMETER_IMPLEMENTATION.md](VEHICLE_ODOMETER_IMPLEMENTATION.md) (engine layout). Where they differ on
the points below, this document is the newer decision.

> **Principle.** Traccar provides telemetry evidence. NUMZFLEET decides operational truth. The **vehicle**
> owns its mileage; a tracker is replaceable hardware that only supplies evidence for it.

There is one mileage authority: `resolveOdometerFromEvidence` (fuel-api). Fleet cards, the vehicle workspace,
maintenance reminders, fuel-efficiency intervals and the daily ledger all read it, and the daily ledger is
built from the same accepted evidence as the cumulative odometer (see [Daily and cumulative mileage](#daily-and-cumulative-mileage)).
No second mileage engine exists, and the frontend never rebuilds a trusted figure from raw counters.

---

## 1. The model

### The anchor belongs to the vehicle

`vehicle_odometer_anchors` holds the vehicle's accepted mileage baseline. It is **append-only**: a change never
edits a row, it supersedes it (`superseded_at`) with a new one, so the whole history is kept. A partial unique
index guarantees at most one current anchor per vehicle.

| Column | Meaning |
|--------|---------|
| `odometer_km` | the accepted vehicle odometer at `observed_at` |
| `telemetry_km` | the tracker's *accepted* counter at that same moment; `NULL` = baseline not yet matched to the tracker (**pending**) |
| `state` | `physically_verified`, `trusted_estimate`, `provisional`, `awaiting_tracker`, `legacy_unverified` |
| `kind`, `source` | what the row is (observation, correction, carry-over, onboarding...) and who/what produced it |
| `previous_odometer_km`, `reason`, `actor_user_id`, `evidence` | audit trail: what it replaced, why, who, supporting note/attachment |
| `device_id`, `device_assignment_id` | the tracker whose counter `telemetry_km` refers to, and the assignment period it belongs to |

### The formula

```
odometer = anchor.odometer_km + max(0, acceptedCounter − anchor.telemetry_km)
```

`acceptedCounter` is the tracker's counter **after** the acceptance rules (below), not the raw attribute.
While the baseline is pending (`telemetry_km IS NULL`) the odometer holds the anchor value; it is released
by the first valid counter reading of the new tracker (`establishPendingBaseline`, run by the housekeeping
sweep before the ingest so baseline and remembered counter come from the same reading).

### Labels the backend reports (and the screens show)

| Field | Values | Meaning |
|-------|--------|---------|
| `odometerVerification` | `physical` · `estimated` · `unverified_legacy` · `none` | who vouches for the value. **`physical` only ever comes from a person's attestation** that they read it from the dashboard. A GPS-derived or carried-over value is `estimated`; pre-existing anchors are `unverified_legacy` |
| `odometerReconciliation` | `none` · `awaiting_tracker` · `provisional` · `established` | where a replacement tracker stands against the carried-over baseline: `established` = the tracker's counter is tied to a baseline that is not provisional |
| `odometerReadingStatus` | `accepted` · `quarantined` · `unvalidated` · `none` | whether the latest tracker reading was accepted, is being held, or was never run through the rules |
| `odometerBaselinePending` | boolean | the baseline is not yet matched to the tracker counter |
| `odometerEvidenceAt` | ISO time | when the accepted reading behind the value was taken (so age can be shown) |
| `odometerAnchorObservedAt` | ISO time | when the anchor itself was set |
| `odometerConfidence` | `high` · `medium` · `low` · `unavailable` | graded confidence (freshness, drift, diagnostics), unchanged from earlier milestones |

All six provenance fields are **additive** to the original `odometerKm` / `odometerConfidence` / `odometerDriftPct` /
`odometerDriftClass`; existing clients keep working.

---

## 2. Observation rules

*(`odometerPlausibility.js`; referenced from code as "Observation rules".)*

A person can record a reading (`POST /api/vehicles/:id/odometer/observation`) or complete a service with an
odometer value. Either goes through the same pure rules, **before** anything is changed:

| # | Condition | Result |
|---|-----------|--------|
| 1 | not a finite number in [0, 3,000,000] | reject `invalid_value` |
| 2 | vehicle has no accepted odometer yet | accept `first_baseline` |
| 3 | within **max(50 km, 2 %)** of the current value | attested → recorded as new baseline (`within_tolerance`); **not attested → accepted but not recorded** (`no_change`), so a weaker label never replaces a verified one |
| 4 | outside tolerance and **not attested** | reject `needs_physical_confirmation` |
| 5 | outside tolerance, attested, current baseline is only an estimate | accept `establishes_baseline` |
| 6 | outside tolerance, attested, current baseline physically verified: lowered | needs a reason (≥ 5 chars) → `physical_correction_down`, else reject `correction_requires_reason` |
| 6 | …raised by more than driving could explain (1,500 km/day since last evidence, 30 days if unknown) | needs a reason → `physical_correction_up`, else reject `implausible_increase` |
| 6 | …any other increase | accept `physical_deviation` (the tracker under-counted or was offline) |

`confirmedPhysical: true` is the person's explicit attestation and the **only** route to `physically_verified`.
Rejections are HTTP 422 with a stable `code` and change nothing. The UI therefore:

- has no "trust live reading" shortcut (it would have labelled a GPS figure as physical);
- requires a ticked "I read this value from the vehicle's own odometer" box before *Save reading* is enabled;
- sends the same attestation (`odometerConfirmedPhysical`) and optional `odometerReason` when a service is
  completed, with the box **unticked** by default because the dialog's odometer is prefilled from the system's own figure.

Every accepted change appends an anchor row (previous value, source, reason, actor, evidence), and is applied in
one transaction behind a row lock on the vehicle, so concurrent observations, assignments and baseline
completions serialise.

---

## 3. Accepted readings

*(`acceptedCounter.js`, `acceptedReadings.js`, `acceptedReadingsService.js`; referenced as "Accepted readings".)*

A tracker reports a cumulative counter. Trusting every value as it arrives lets a glitch inflate the odometer
and a reset freeze it. Each tracker's counter is therefore walked **reading by reading, in arrival order**
(Traccar position id order — the order Traccar's own `totalDistance` is computed in) against a remembered
accepted state (`tracker_counter_state`). The raw positions in Traccar are never altered; only the decision
about what counts is stored.

For a reading with counter `raw` against the watermark `w` (`dc = raw − w`, `dt` = time between the fixes):

| # | Case | Outcome |
|---|------|---------|
| 1 | no usable counter | ignored (never treated as zero) |
| 2 | same position / same counter at an older time | duplicate, ignored |
| 3 | `|dc| ≤ 0.05 km` | stationary wobble: a rise is added, a dip ignored |
| 4 | `0 < dc ≤ plausible(dt)` (180 km/h, ≤ 1,500 km/day, +1 km slack) | **accepted**; if `dt > 30 min` it is a *span* (its day is unknown) |
| 5 | `dc` too large but `raw/1000` is plausible | accepted **corrected** (`unit_corrected`: counter sent in metres) |
| 6 | `dc < 0` and `raw + modulus − w` is plausible for a known counter width (65,536 / 100,000 / 1,000,000 / 1,048,576 / 16,777,216 km) | accepted as a **rollover** |
| 7 | anything else | **quarantined**: accepted counter does not move; the reading is held as *pending* |

While a reading is pending, each next reading either
- is plausible against the old watermark → the pending one was a **spike**, discarded, never counted; or
- continues consistently from the pending one → after **3** consistent readings the new level is accepted
  (a *level shift* if it jumped up, a *counter reset* if it dropped). **The jump itself is not counted**;
  mileage continues from the new level and a reset is reported as unobserved; or
- is consistent with neither → the pending reading is replaced (a flapping counter never gets in).

Invariant (tested over thousands of random steps): `acceptedKm = start + Σ accepted increments`.

Notable decisions are written to `mileage_reading_events` (quarantine, spike discarded, level shift/reset
accepted, rollover, unit correction, long gap) so *raw* and *accepted* are always distinguishable: raw lives in
Traccar, accepted in `tracker_counter_state`, and every divergence is in the event log. A tracker's counter
attribute (`odometer` vs `totalDistance`) is fixed at bootstrap, so a device that alternates cannot flip scale mid-stream.

**At read time** the remembered state is extended to the tracker's latest position with the *same* rules but no
writes (`liveAcceptedCounter`), so a position the ingest has not reached yet can never push a jump into the
odometer. With no remembered state the raw counter is used and labelled `odometerReadingStatus: 'unvalidated'`.

**Ingest.** `runMileageHousekeeping` (the daily-mileage scheduler, default every 5 minutes,
`DAILY_MILEAGE_INTERVAL_MS`) does, each part isolated so one failure never stops the rest:
1. completes pending replacement-tracker baselines;
2. runs every assigned tracker's new positions through the rules, persisting remembered state, event log and
   the daily ledger **in one transaction**; positions are fetched from 7 days before the watermark to catch
   late-arriving older fixes;
3. retries failed maintenance-schedule re-links.

---

## 4. Daily and cumulative mileage

Both come from the same accepted increments, written together in the ingest transaction:

- An accepted increment between readings **≤ 30 min** apart is *continuous*: it is split between local days in
  proportion to the time spent on each side of midnight (**Africa/Lusaka**, 22:00 UTC), in integer micro-km so
  the pieces add back to the whole exactly. This is **`confirmedKm`**.
- An increment across a **> 30 min** silence is a *span*: the distance is in the cumulative mileage but cannot
  be placed in any day. It is stored as **`unattributedKm`** on the day the silence ended — never added to
  `confirmedKm`, never silently dropped. A silence ≥ 6 h that still brought ≥ 0.5 km is also recorded as an
  unobserved gap.
- Days with no ledger row are **unknown**, not zero.
- Evidence that arrives more than 3 h after a day ended is a **revision**: the day is updated and
  `revisionCount` / `lastRevisedAt` record it.
- Rows produced by accepted readings carry `evidence = 'accepted'`; earlier rows remain `legacy`. An accepted row
  is **never** recomputed or settled from a raw-counter difference (that was the source of the old
  daily-vs-cumulative disagreement), and a recompute that cannot be resolved never overwrites a stored value
  with "unknown".

Consequently a suspicious jump cannot inflate the daily figure while the odometer stays frozen: it is
quarantined for both, and when it is eventually accepted as a level shift or reset it counts for neither.

**Reconciliation check** (`reconcileTracker`): always, `accepted_km − bootstrap_accepted_km` must equal
`applied_km` (they move in one transaction, so a difference means a lost or duplicated write). When the vehicle
has never had a replacement tracker, the ledger summed since bootstrap (`confirmed + unattributed`) must also equal
the accepted movement. **Exact reconciliation is not possible** across a tracker replacement (the counters are different
lineages) or across an unobserved gap — by construction those intervals are *not* distance; they are reported as
gaps instead of being forced to balance.

---

## 5. Tracker changes

*(`trackerAssignmentService.js`.)* A tracker is replaceable; the vehicle must keep its mileage, schedules and history.

- **Replacement.** The vehicle keeps its last accepted odometer. The new tracker inherits it as a **provisional**
  baseline, tied to the new tracker's counter at hand-over, labelled `estimated` and never `physical`.
  Reconciliation is `awaiting_tracker` while the new tracker has not yet reported a valid counter (the odometer is
  *held* at the carried value, not tracked), and `provisional` from its first valid reading. **A provisional baseline
  is never promoted automatically**: the new tracker's counter is a fresh lineage, so nothing independent exists to
  check the carried-over value against, and GPS evidence cannot make it more than an estimate. It stays `provisional`
  until a person records an attested dashboard reading, which supersedes it with a `physically_verified` anchor
  (`established`). Until then the new tracker's distance is added to the carried value and shown as provisional.
- **No cross-vehicle inheritance.** A tracker never carries another vehicle's baseline: each vehicle's baseline
  is derived only from that vehicle's own history. A vehicle with none counts from the moment the tracker is assigned.
- **Unobserved gap.** The interval between the old tracker's last report and the new tracker's first valid reading
  is stored as a gap (`open` → `closed_unobserved`); no distance is invented for it.
- **Maintenance follows the vehicle.** Traccar maintenance schedules are device-level; after the change they are
  re-linked to the new tracker via the permissions API. The outcome is recorded on `vehicle_tracker_changes` and
  retried by the housekeeping sweep (`retryPendingMaintenanceRelinks`) or by hand (`relinkMaintenance(changeId)`).
  Service history and schedules stay with the vehicle.
- **Concurrency.** Vehicle rows are locked in sorted order, then a per-tracker advisory lock; the picture read
  before locking is re-validated under the locks; deadlocks, serialisation failures and unique-index races are
  retried up to 4 times, then reported as `409 assignment_conflict`. Partial unique indexes make a double-active
  assignment of a vehicle or of a tracker unrepresentable.

---

## 6. What is shown, and how it stays live

All of it is the backend's resolved result; the frontend only names it (`fleet/display/odometerStatus.js`).

| Surface | Shows |
|---------|-------|
| Map vehicle card (`VehicleContextCard`) | day figure (or odometer), then `Odometer • N km · <Verified/Estimated/Provisional/Awaiting tracker/Reading under review/Calibrating/Unverified> · <age>`; warning colour and a tooltip listing the reasons when it needs attention |
| Sidebar row (`VehicleListItem`) | the compact `Today X km` / `Odometer N km`, plus **one** flag only when something is unsettled (state, `+X km unobserved`, `Last reading 3 days ago`, low confidence). Offline rows keep showing `Last seen …` |
| Vehicle header (`VehicleWorkspaceHero`) | **Odometer** (cumulative only, never daily distance) with state and reading age under it; Routine Service due text is the backend's own wording |
| Vehicle overview and maintenance tabs | `OdometerStatusLine`: odometer, state, reading age; a warning with reasons when unsettled |
| Odometer module (Setup) | live value, state, age, reasons; dashboard-reading form with attestation and reason |
| Fuel operations | a vehicle still waiting to be fuelled shows its **live** canonical odometer; a fuelled line shows the mileage **captured at the fill** (`currentMileage`), never today's odometer |
| Vehicles list, maintenance dashboard | Routine Service status / remaining km follow the vehicles live (below) |
| Replay / event status card | the raw tracker counter is labelled **Tracker distance counter** — historical evidence, not the vehicle's odometer |
| Daily label | `Daily Mileage • 30.0 km (partial day, +8.0 km unobserved)` — the unobserved distance is shown beside the figure, never added |

An offline tracker keeps its last accepted value and the **age of the reading is disclosed**; staleness changes the
tone (≥ 24 h) and confidence, never the value.

### Live updates (no manual refresh)

fuel-api resolves every number; the browser only decides **when to ask again**. One signal source
(`fleet/display/useMileageSignalSource.js`, mounted once with the registry) watches data already in Redux and publishes
signals on a small bus (`mileageSignal.js`):

| Signal | When | Screens react |
|--------|------|---------------|
| `counter` + `deviceIds` | a tracker's distance counter advanced ≥ 100 m (compared per device, never displayed) | normal: after a 5 s window, at most one refresh per 30 s; a single-vehicle screen reacts only to its own device |
| `reconnect` | the live connection returned after a drop | urgent: refresh after the short floor (10 s between urgent refreshes) |
| `online` | the browser regained connectivity | urgent |
| `visible` | the tab was shown | urgent only if the screen's data is > 60 s old or it skipped a refresh while hidden |
| `fallback` | **only while the live connection is down** and the tab is visible: every 2 min | normal |

Each screen subscribes through `useMileageSignalRefresh` → `mileageConsumer.js` → `refreshScheduler.js`: notifications
join an open window instead of extending it (a moving vehicle cannot starve the refresh), a refresh never overlaps itself,
a hidden tab spends nothing, a failed refresh keeps the last good data on screen, and nothing polls while the connection is
healthy. Subscribers: the registry (map cards, sidebar, operations, Vehicles list), the vehicle workspace engine
(odometer, Routine Service remaining km and status), and the maintenance dashboard. The workspace keeps its existing 60 s
engine poll as a backstop.

### Routine Service interval — what moves it

`start` of the Traccar schedule is where the current interval began; **only completing a service moves it** (the backend
rebases it to the completion odometer). Three screen rules protect that:

- the Complete Service dialog initialises once per opening; a live odometer update refreshes an *untouched, unconfirmed*
  odometer field only and never replaces something the person typed or ticked as a dashboard reading;
- Vehicle Setup hydrates the interval baseline from the **schedule** (`routineService.startingOdometerKm`, `intervalKm`), not
  from the `numzFleetConfig` copy written once at setup (stale after the first completed service), and rewrites the
  schedule only when it does not exist yet or the person changed those two fields — previously every setup save re-sent the
  cached baseline and could rewind the interval;
- the live odometer is suggested as a starting odometer only when no schedule exists.

Reports: a vehicle's operation report row (`getVehicleOperationKpis`) now carries the mileage captured at each fill; it
previously stamped today's odometer on every historical fill, which fed the "last refill" odometer and the PDF.

---

## 7. Migration and rollback

| Migration | Adds |
|-----------|------|
| `20261016_vehicle_owned_odometer.sql` | `vehicle_odometer_anchors`, `vehicle_mileage_gaps`, `vehicle_tracker_changes`; unique indexes on active `device_assignments`; legacy-anchor backfill |
| `20261017_accepted_mileage_readings.sql` | `tracker_counter_state`, `mileage_reading_events`; `vehicle_daily_mileage` gains `evidence`, `confirmedKm`, `unattributedKm`, first/last reading times and revision audit |

Both are **additive and idempotent**, in `BEGIN/COMMIT`, listed in `migrations/MIGRATION_ORDER`, and contain no `DROP`/`TRUNCATE`
(the deploy guard forbids them). `vehicle_specs` and `device_assignments` data are never modified, and anchor
changes are mirrored into `vehicle_specs` for the current tracker, so the **previous release keeps working against the
same database** with the latest accepted baseline.

**Legacy backfill — device-keyed anchors are not blindly copied.** An old anchor becomes a vehicle's current anchor
only if it has a timestamp, the vehicle held that tracker when it was captured, and no *other* vehicle has held the
tracker since. It is then `legacy_unverified` — never relabelled `physically_verified`, because a legacy row cannot say
whether a person read the dashboard. **Anything else is ambiguous**: it is kept as superseded history attributed to the
vehicle that held the tracker at the time, with the reason (`quarantined: …`), and never becomes a current anchor, so no
vehicle inherits another's mileage. Tracker readings stored in metres (≥ 500,000) are converted to km; the original value is
kept in `evidence`. If duplicate active assignments already exist, the guard index is skipped with a `NOTICE` rather than
aborting the deploy.

**Rollback** (manual, after a backup): `migrations-rollback/20261016_…down.sql` and `20261017_…down.sql` rename the new tables
and indexes aside with a timestamp suffix (nothing is dropped, so the audit history is kept) and remove the guard indexes.

### Pre-deploy production checks (read-only — **not run**)

These need your approval and an approved access route before anyone runs them. Expected output is stated so a surprise is obvious.

```sql
-- 1. Duplicate active assignments (the guard indexes are skipped if either returns rows). Expected: 0 rows each.
SELECT "vehicleId", COUNT(*) FROM device_assignments WHERE "isActive" = true GROUP BY 1 HAVING COUNT(*) > 1;
SELECT "deviceId",  COUNT(*) FROM device_assignments WHERE "isActive" = true GROUP BY 1 HAVING COUNT(*) > 1;

-- 2. Legacy anchors that will be backfilled, and those that cannot be (no timestamp => ambiguous).
--    Expected: a small number of rows (one per tracked vehicle); any NULL "verifiedOdometerAt" is quarantined, not applied.
SELECT "deviceId", "verifiedOdometerKm", "verifiedOdometerAt", "verifiedOdometerSource"
FROM vehicle_specs WHERE "verifiedOdometerKm" IS NOT NULL;

-- 3. Tracker counters running ahead of the verified odometer (maintenance reminders on the dashboard will now show MORE km remaining).
SELECT "deviceId", "verifiedOdometerKm", "verifiedTraccarDistance" / 1000 AS tracker_km
FROM vehicle_specs
WHERE "verifiedOdometerKm" IS NOT NULL AND "verifiedTraccarDistance" / 1000 > "verifiedOdometerKm";
```

---

## 8. Recovery

| Situation | What to do |
|-----------|------------|
| A wrong dashboard reading was recorded | Record a new attested reading with a reason (≥ 5 chars). The wrong row stays in history, superseded |
| A tracker counter reset or jumped | Nothing: it is quarantined, then accepted after 3 consistent readings *without* counting the jump. Recorded in `mileage_reading_events`. To pin the true value sooner, record an attested reading |
| `odometerReadingStatus` stays `quarantined` | The tracker is flapping or still inconsistent; check the device, or record an attested reading |
| `tracker_counter_state` lost or stale | It is an operational cache: the next sweep bootstraps it from the tracker's current reading. Daily rows already written are kept |
| Maintenance relink failed after a swap | Retried each sweep; or call `relinkMaintenance(changeId)`; outcome is on `vehicle_tracker_changes` |
| Tracker moved to a different vehicle | Nothing carries over; the previous vehicle keeps its odometer and its schedules |
| Need to undo the release | Run the `*.down.sql` files (rename-aside); the previous release resumes from `vehicle_specs` |

---

## 9. Known limitations (deliberate)

- Traccar's `totalDistance` is computed in arrival order. The ingest uses the same order, so the accepted counter agrees with
  it, but a position that arrives very late is only reflected once the 7-day look-back reaches it.
- Distance across an unobserved gap is **not estimated**. It is reported (`unattributedKm`, gaps) and left out of the day figure.
- A `provisional` baseline carried onto a new tracker is only as good as the vehicle's last accepted odometer plus the
  (unknown) distance driven during the swap. It has no automatic reconciliation path and stays `estimated`/`provisional`
  until a person confirms the dashboard value.
- The legacy `vehicle_specs.verified*` columns remain as a rollback-safety mirror and are no longer the authority.
- Days before the accepted-reading ingest began stay `legacy` (computed as before); they are not rewritten.
- Production behaviour is **unverified**: only synthetic data, copies of dev data and a throwaway Postgres were used.
