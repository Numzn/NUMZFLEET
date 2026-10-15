# GT06 session-race patch for Traccar 6.15.3

**Status: built and verified in development. Not deployed.** Production
Traccar is unchanged by this patch, and the normal CI deploy does not carry it
(`traccar` is a protected service). Rolling it out is a deliberate operations
change (see [Rollout](#rollout-not-performed)).

## Symptom

A GT06 tracker (HONDA-FIT, 2026-10-14/15) shows `online` in the UI while none
of its frames produce a position. Traccar's log shows the frames arriving and
nothing being decoded; the device status can even read `offline` while the
tracker is connected and transmitting.

## Root cause (confirmed)

Verified against the Traccar **6.15.3** source — the version production reports
at `/traccar/api/server` and the one pinned in `docker-compose.prod.yml` — and
reproduced black-box on that exact image (below).

| Where (6.15.3) | What it does |
|---|---|
| `Gt06ProtocolDecoder.java` L501–505 | Any non-login frame on a connection with **no endpoint session** → `return null`. No ACK, no log line, no close: the frame is dropped silently. |
| `Gt06ProtocolDecoder.java` L521–545 | A login frame calls `getDeviceSession(channel, remoteAddress, imei)` and ACKs. |
| `ConnectionManager.java` L156–164 | On every login the device's previous session is removed **and the previous connection's endpoint mapping is deleted** ("last login wins"). |
| `ConnectionManager.java` L208–224 | When a connection closes, its session is removed and the device marked `offline`. |
| `BaseProtocolDecoder.java` `onMessageEvent` | Runs for **every** decoded message, including logins that decode to no position, and marks the device `online`. This is why login churn alone keeps a device "online". |

The race: a tracker that cannot get its login ACK keeps opening sockets. When one
socket logs in and is ACKed, a *queued login from an older, abandoned socket*
can still arrive afterwards. That stale login steals the session (and deletes
the live socket's mapping); when the stale socket then closes, the live socket
has **no session at all**. The tracker believes it is logged in and never
re-logs-in, so every frame it sends is discarded until it reconnects.

6.15.3 already fixed the *closing* half (`sessionsByDeviceId.remove(id, session)`
instead of `remove(id)`, which 6.14.5 still has), but **not** this ordering —
the stock 6.15.3 image still loses frames, as the regression shows.

This matches the 2026-10-15 production timeline in the investigation notes
(connection `T428fdb90` opened 10:36:48, live connection `T899c44aa` at 10:37:30,
the older socket's queued login at 10:37:36 and its close the same second; 1,265
frames then discarded until a fresh connection at 12:22).

## The fix

`ConnectionManager.patch` — net −10 lines in `getDeviceSession`. The newest login
still becomes the device's *current* session (command routing, status), but a
superseded connection **keeps its own endpoint mapping and cache reference until
it closes**. A connection that has logged in therefore keeps decoding, and a
stale socket can no longer orphan a live one.

It is intentionally a small, local change to the session layer, not a re-design:

* The patch is applied to the pristine upstream file; `build-patched-jar.sh`
  refuses to run if upstream's `ConnectionManager.java` differs from the pinned
  SHA-256.
* Only `org/traccar/session/ConnectionManager*.class` are replaced in the stock
  `tracker-server.jar`; everything else is the unmodified upstream jar.

Behaviour changes to be aware of:

* A superseded connection that is still genuinely sending is now decoded rather
  than discarded. Late/older frames can therefore interleave with newer ones.
  The frontend ignores positions older than the one it already holds
  (`traccar-fleet-system/frontend/src/store/positionOrdering.js`), so markers do
  not move backwards.
* A zombie socket that never closes now retains its (small) endpoint entry until
  it does, instead of having it deleted on takeover.

## Verification

`test/gt06-session-race.mjs` drives raw GT06 frames at a throwaway Traccar
container and reads back what was actually stored through Traccar's REST API.
`test/run-regression.sh` runs it against the stock image and the patched jar.

| Scenario | Stock 6.15.3 | Patched |
|---|---|---|
| single connection (control) | 3/3 | 3/3 |
| legitimate reconnect: old socket closes, new logs in | 4/4 | 4/4 |
| stale login replayed from abandoned socket, then it closes | **1/4**, device `offline` while live | 4/4, `online` |
| stale login replayed from abandoned socket, it stays open | **0/3** | 3/3 |
| newer socket is the dead one, older socket keeps reporting | **0/4**, device `offline` while live | 4/4, `online` |

Run (needs docker, node ≥ 20, python3, curl, patch):

```bash
cd backend/traccar-patch
./build-patched-jar.sh          # -> out/tracker-server.jar (git-ignored)
./test/run-regression.sh        # stock must reproduce the race, patched must not lose frames
```

The runner fails if the **stock** image stops reproducing the race (the test
would otherwise prove nothing) and if the patched one drops anything. The test
refuses any non-loopback target: it registers a user and devices.

No JDK is required: the class is compiled with the Eclipse compiler (ECJ, pinned
version and SHA-1) running on the base image's own JRE.

## Rollout (not performed)

`traccar` is a *protected* service in the production deploy wrapper
(`numzfleet-deploy` verifies there is no compose drift for it), so this is an
operations change outside the normal CI deploy:

1. Build the jar on a trusted host: `./build-patched-jar.sh`.
2. Either build/push an image from `Dockerfile`, or mount the jar read-only at
   `/opt/traccar/tracker-server.jar` through the server-local compose override.
3. Restart **only** the `traccar` container. Every tracker drops and re-logs-in;
   do it outside peak hours.
4. Confirm the version still reads 6.15.3 at `/traccar/api/server`, and watch that
   `tracker-server.log` shows decoded positions after each login.
5. **Rollback:** point the service back at the stock digest in
   `docker-compose.prod.yml` and restart `traccar`.

Do not run `test/gt06-session-race.mjs` against production.

## What this does not fix

* **Downlink loss to the tracker.** The investigation found server→tracker
  payload not reaching ALLION (and HONDA-FIT for 19.5 h) while uplink worked —
  located beyond the VPS. The cause (carrier policy/CGNAT, bundle state, radio or
  modem firmware) is **unproven**; nothing in this repo can establish it. This
  patch makes Traccar robust to the *consequence* (many sockets, late logins); it
  does not make the downlink work.
* **ALLION (id 5)** was login-only for other reasons (no non-login frames to
  mis-attribute) and is unaffected by this patch.
* **"Online" semantics.** Traccar marks a device online on any decoded message,
  logins included, so a device can be online with an old position. Position age,
  not `status`, is the signal for "is it reporting".

## Maintenance

* The patch is pinned to **v6.15.3**. On a Traccar upgrade re-check
  `ConnectionManager.getDeviceSession` and rerun the regression; if the stock
  image no longer reproduces the race, drop the patch.
* Dev still pins 6.14.5 (`docker-compose.dev.yml`) while production runs 6.15.3.
  6.14.5 has the same race plus the unconditional `sessionsByDeviceId.remove`
  on disconnect.
* This is an upstream defect; worth reporting to Traccar with the regression as
  the reproduction.
