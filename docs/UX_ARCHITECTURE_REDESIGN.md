# NUMZTRAK — Frontend UX & Information Architecture Redesign

**Status:** Proposal (design only — no implementation)
**Scope:** Information architecture, navigation, page system, visual hierarchy, design system, RBAC experience
**Evidence base:** `traccar-fleet-system/frontend/src` (421 JS/JSX files), `Navigation.jsx`, `UnifiedSidebar.jsx`, `settingsSectionRegistry.js`, `fuel-api/src/permissions/permissionCatalog.js`

---

## 0. Method

I read the actual frontend before critiquing it. Everything in §1 cites real code. Numbers are counts from the tree, not impressions.

---

## 1. Critique of the current architecture

The app is not badly built. It is **well-built to the wrong shape** — the engineering quality is visibly higher than the information architecture, which is the classic signature of a product that grew feature-by-feature under delivery pressure. Nine specific problems, in descending order of damage.

### 1.1 The sidebar is organized by system provenance, not by user workflow

`UnifiedSidebar.jsx:330-338`:

```
INTELLIGENCE
  Fuel reports        → /reports/fuel-operations
  Analytics           → /reports/statistics
  Traccar reports     → /reports/summary
```

Three sibling entries whose only real difference is *which backend produced them*. "Traccar reports" ships your GPS vendor's brand name into the navigation of a fleet manager who has never heard of Traccar and should never have to. A fleet manager does not think "I want a Traccar report." They think "why did this truck stop for 40 minutes yesterday."

This is the single most telling defect, because it proves the IA was derived from the service topology rather than from the job.

### 1.2 There are three competing navigation registries and no single source of truth

| Registry | Form | Location |
|---|---|---|
| Primary sidebar | Hardcoded `useMemo` array inside a rendering component | `UnifiedSidebar.jsx:279-353` |
| Settings sections | Declarative array with `category`, `keywords`, `requiresRole` | `settingsSectionRegistry.js` |
| Vehicle workspace tabs | Third registry | `fleet/vehicleDetail/vehicleWorkspaceTabRegistry.js` |

The settings registry is genuinely good work — searchable, gated, self-describing. It is also the *least* important of the three surfaces, and the most important one (the primary sidebar) has none of those properties. The good pattern was applied to the small problem.

Consequence: there is no object in the codebase that can answer "what are all the destinations in this app, and who can see them?" That question must be answerable in one place before you can scale to 100 modules.

### 1.3 The sidebar fetches data

`UnifiedSidebar.jsx:204-219` — the navigation component performs `fetch('/api/fleet/maintenance/dashboard')` on mount to compute a badge count.

Navigation is now coupled to a domain endpoint's availability and shape. Every future badge repeats this. At 20 modules the sidebar makes 20 requests before the user has navigated anywhere.

### 1.4 URL vocabulary contradicts UI vocabulary

| URL | Label shown to user |
|---|---|
| `/fleet/operation-sessions/prepare` | "Fueling Day" |
| `/reports/statistics` | "Analytics" |
| `/reports/summary` | "Traccar reports" |

`operation-sessions` is a database table name. Users see, bookmark, and share URLs; they are part of the interface. Three different words for one concept (`operation-sessions` / "Fuel" / "Fueling Day") means support conversations require translation.

### 1.5 "Maintenance" means four different things at four different paths

```
/maintenance                     → MaintenanceDashboardPage    (the real product)
/settings/maintenances           → MaintenancesPage            (Traccar rule templates)
/settings/maintenance/:id        → MaintenancePage             (edit a Traccar rule)
sidebar "Maintenance"            → /maintenance
settings registry "Maintenance Schedules" → /settings/maintenances
```

The registry comment at `settingsSectionRegistry.js:171-176` shows the team already *identified* this collision class for Notifications and worked around it by inventing `/settings/notification-preferences`. The workaround is correct; the underlying problem — no naming authority — was never fixed, so it recurs.

Same pattern for Geofences: listed under **Fleet** in the sidebar, routed at top-level `/geofences`, edited at `/settings/geofence/:id`. Three locations, one concept.

### 1.6 Settings has become a second application

17 sections spanning *"change your avatar"* to *"edit raw Traccar server configuration"* (`settingsSectionRegistry.js`). It has its own shell, its own sub-nav, its own category taxonomy, its own search index — and it sits in the sidebar as a peer of "Fleet."

Settings is never the user's goal. It is where users go when something is wrong. Giving it permanent real estate in the primary nav, at the same level as the work itself, inverts the value hierarchy. Stripe, Linear, GitHub, and Notion all treat settings as an **overlay or a separate context**, never a primary nav peer. They are right.

### 1.7 There is no page layout system at all

Across 421 files:

- **0** shared `PageHeader` component
- **0** breadcrumb component
- **28** independent `<Table>` implementations
- **1,091** inline `sx={{ }}` blocks
- **4** files with any empty-state handling
- **54** files with ad-hoc loading states

The only two things resembling a page shell — `VehicleWorkspaceHeader.jsx` and `SettingsSectionPanel.jsx` — are local to their own feature and do not compose.

Every new page is therefore a from-scratch layout decision. This is the mechanism by which "cluttered and inconsistent" happens; it is not a taste problem, it is a missing abstraction.

**4 empty states out of 28 tables** is the number I would put in front of an exec. Empty state is the *first* thing every new customer sees on every screen. Right now, for ~24 of your tables, a brand-new fleet's first impression is a blank rectangle.

### 1.8 Permission checks in the nav layer are done three incompatible ways

1. Inline hooks — `useManager()`, `useAdministrator()`, `useRestriction('readonly')` (`UnifiedSidebar.jsx:197-200`)
2. Route wrapper — `<TechnicianRoute>` (`Navigation.jsx:201-206`)
3. Declarative string — `requiresRole: 'manager'` (`settingsSectionRegistry.js`)

Three mechanisms means three places to get it wrong, and the frontend gap is already documented in `PLATFORM_ARCHITECTURE.md`: `useSuperAdmin` disagrees with the backend's definition.

### 1.9 The Roles experience is honest but inert

`EditRolesDialog.jsx` renders a banner to the user reading:

> *"Roles here are for visibility and planning only — they don't yet change what this person can actually do."*

That is admirable engineering honesty and terrible product. An admin is being asked to operate a control that announces it does nothing. Meanwhile `RolesSection.jsx` is read-only cards, and `permissionCatalog.js` already defines **28 permissions across 8 categories and 6 system roles** — a fully-formed model with no usable interface on top of it.

You are one design away from a real RBAC product. See §5.

### 1.10 Sidebar dimensions are inverted

`SIDEBAR_WIDTH_EXPANDED = 168`, `SIDEBAR_WIDTH_COLLAPSED = 68` (`UnifiedSidebar.jsx:182-183`).

168px expanded is too narrow — it forces truncation and blocks badges/secondary metadata. 68px collapsed is too wide — it wastes 12px per row versus a proper icon rail. Reference points: Linear 240/54, Stripe 240/0 (no collapse), GitHub 296. **Nobody ships 168.**

---

## 2. Task 1 — Navigation & Information Architecture

### 2.1 Assessment of your proposed sidebar

Your proposal is a clear improvement on what exists — it is workflow-shaped and it kills the "Traccar reports" leak. But I would not ship it, for two reasons:

**It has ~28 destinations across 6 accordion groups.** That is the same trap the current sidebar has, at a larger scale. Every group you add makes every *other* group's contents less discoverable, because the user must first decide which group a thing lives in. At 100 modules this structure needs 15 groups and becomes a filing cabinet.

**It groups by department, not by rhythm.** "Operations / Fuel / Maintenance / Compliance / Intelligence / Administration" mirrors an org chart. But a fleet manager running the morning fuel day needs *Vehicles* (Operations) and *Fuel Day* (Fuel) within the same 90 seconds — two different groups, two accordion expansions. The IA fights the task.

### 2.2 The core principle: **navigation depth is not the enemy — navigation *breadth* is**

The industry insight that Linear and Stripe both encode: you do not scale a sidebar by adding items. You scale it by **freezing the sidebar at 8–10 entries forever** and moving all growth into three other channels:

| Channel | Carries | Grows to |
|---|---|---|
| **Primary sidebar** | Places you *inhabit* | Frozen at ~9. Never grows. |
| **Workspace tabs** | Aspects of the thing you're inhabiting | 5–8 per workspace |
| **Command palette (⌘K)** | Every destination, action, and record in the app | Unbounded |
| **Settings overlay** | Configuration | Unbounded |

The sidebar is not a table of contents. It is a set of **rooms**. You add furniture to rooms; you do not add rooms.

You already have `CommandPalette.jsx` and the settings registry already carries `keywords` for it. The foundation exists — it is currently a nice-to-have that should be promoted to a load-bearing part of the IA.

### 2.3 Recommended primary navigation

```
┌────────────────────────────┐
│  NUMZTRAK      ⌄ Acme Ltd  │   ← org / context switcher (platform mode ready)
├────────────────────────────┤
│  ⌘K  Search or jump to…    │   ← promoted, always visible, not hidden in a menu
├────────────────────────────┤
│                            │
│  ◈  Today                  │   ← the operating picture (replaces "Dashboard")
│  ◉  Live Map               │
│                            │
│  RUN                       │
│  ⛽  Fuel Day          (3)  │
│  🔧  Maintenance      (12)  │
│  📋  Requests          (5)  │
│                            │
│  MANAGE                    │
│  🚚  Vehicles              │
│  👤  Drivers               │
│  🛡  Compliance            │
│                            │
│  UNDERSTAND                │
│  📊  Insights              │
│                            │
├────────────────────────────┤
│  ⚠ 2 alerts                │   ← single alert surface, not per-item badges
│  ◐ Numeri N.      ⚙  🔔    │   ← settings = icon, NOT a nav row
└────────────────────────────┘
```

**Nine destinations. Zero accordions. Frozen.**

### 2.4 Why group by verb (Run / Manage / Understand)

This is the opinionated call and I will defend it directly.

Departmental grouping ("Operations", "Compliance") asks the user: *which department owns this feature?* That is an org-chart question, and the user does not work at your org chart.

Verb grouping asks: *what am I doing right now?* — which is the question they already have in their head.

| Group | Question it answers | Frequency | Session shape |
|---|---|---|---|
| **RUN** | "What has to happen today?" | Many times daily | Short, transactional, mobile-likely |
| **MANAGE** | "What do we own, and is the record correct?" | Weekly | Longer, desk-based, editing |
| **UNDERSTAND** | "What happened, and what does it cost?" | Monthly | Long, analytical, export-oriented |

These three groups have genuinely different interaction models, different device profiles, and different users. That is what makes them a real taxonomy rather than a label. Departmental groups do not have that property — "Fuel" contains both a daily transactional flow *and* a monthly report.

**Conservative fallback:** if "Run/Manage/Understand" tests poorly with your users, keep the identical structure and relabel to `TODAY / FLEET / INSIGHT`. Do not revert to departmental groups — that reintroduces the two-expansion problem.

### 2.5 What happened to everything else

| Currently in nav | New home | Why |
|---|---|---|
| Fuel reports, Analytics, Traccar reports | **Insights** (one destination, tabbed) | Users want answers, not report engines |
| Settings (17 sections) | **Settings overlay** (⚙ icon, or `⌘,`) | Never a goal; never a nav peer |
| Geofences | **Live Map → Geofences** tab | It is a map concept; it lives on the map |
| Groups, Calendars, Computed Attributes, Saved Commands, Server, Announcement | **Settings overlay → Advanced** | Admin plumbing; ⌘K-reachable |
| Fuel Day sub-steps (prepare/fuel/invoices/review) | **Fuel Day → stepper**, not sidebar children | It is a linear workflow, not a menu |
| Vehicle sub-pages (setup, immobilizer, detail) | **Vehicle workspace tabs** | Already correct; keep and extend |

### 2.6 The scaling mechanism: **Object → Aspect**

This is how you get to 100 modules without a 15-group sidebar.

Model the domain as a small, closed set of **Objects** and an open set of **Aspects** attached to them:

```
OBJECTS  (closed set — adding one is an architectural decision)
  Vehicle   Driver   Trip   Work Order   Fuel Day   Site   Document

ASPECTS  (open set — this is where 100 modules live)
  Vehicle  → Overview · Activity · Fuel · Maintenance · Documents · Costs · Devices · Setup
  Driver   → Overview · Assignments · Licences · Behaviour · Hours · Costs
  Trip     → Route · Events · Stops · Fuel · Cost
```

**The rule: a new feature is an aspect of an existing object until proven otherwise. It does not get a sidebar entry.**

Tyre Management? → `Vehicle → Tyres`. Not a sidebar item.
Driver scorecards? → `Driver → Behaviour`. Not a sidebar item.
Fuel card reconciliation? → `Fuel Day → Reconciliation`. Not a sidebar item.

This is exactly what Fleetio and Samsara do, and it is why their sidebars are ~10 items despite hundreds of features. Your codebase already has the instinct — `fleet/vehicleDetail/vehicleWorkspaceTabRegistry.js` is precisely this pattern. **Promote it from a local file to the app's organizing principle.**

### 2.7 Single navigation registry

Replace all three registries with one declarative tree:

```js
// navigationRegistry.js — the ONLY place destinations are declared
{
  id: 'vehicles',
  label: 'Vehicles',
  group: 'manage',
  path: '/vehicles',
  icon: TruckIcon,
  permission: 'fleet.vehicles.read',   // ← keys from permissionCatalog.js
  keywords: ['fleet', 'trucks', 'assets', 'registry'],
  aspects: [ /* workspace tabs, same shape, recursive */ ],
}
```

Properties this buys you:
- One place answers "what exists and who can see it"
- ⌘K, sidebar, breadcrumbs, and mobile nav all derive from it — no drift
- Permission strings come from the backend catalog, killing the three-mechanism problem in §1.8
- Badges declared as `badge: 'maintenance.dueCount'` resolved by **one** shared badge service — the sidebar stops fetching

### 2.8 URL contract

Freeze a naming rule: **URLs use the user's word, always.**

| Now | Proposed |
|---|---|
| `/fleet/operation-sessions/prepare` | `/fuel-day/plan` |
| `/reports/statistics` | `/insights/analytics` |
| `/reports/summary` | `/insights/activity` |
| `/fleet/vehicles/:id` | `/vehicles/:id` |
| `/settings/maintenances` | `/settings/automation/service-rules` |
| `/geofences` | `/map/geofences` |

Ship permanent redirects from every old path. Never break a bookmark.

---

## 3. Task 2 — The page layout system

### 3.1 Assessment of your proposed structure

Your proposal (Breadcrumb → Title → Description → Actions → Filters → Content → Side info → Footer actions) is a reasonable *checklist* but not a *system*, because it assumes every page is the same page. It isn't. A live map, a data table, a linear workflow, and a settings form have genuinely different needs, and forcing one template on all four produces empty chrome (a "Filters" slot on a settings page, a "Description" nobody reads on a table they visit daily).

Two specific objections:

- **"Description" as a standing slot** is a mistake. On a page a user visits daily it becomes permanent noise. Make it optional and default it off for frequently-visited pages.
- **"Footer actions"** on a scrolling page means the primary action is below the fold. Use a **sticky action bar** that appears only when there are unsaved changes (your `SettingsSaveBar.jsx` already does this correctly — generalize it).

### 3.2 Recommended: four page archetypes, one shell

```
┌──────────────────────────────────────────────────────────────┐
│ ← Vehicles / ABC 1234                          [⌘K]  ⚙  ◐    │  AppBar (fixed, 52px)
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ABC 1234  ● Moving                    [Assign] [ Actions ▾ ]│  PageHeader (72px)
│  Toyota Hilux · Depot North · Kabwe Route                    │  ← metaline, not "description"
│                                                              │
│  Overview   Fuel   Maintenance   Documents   Costs   Setup   │  AspectTabs (44px)
├──────────────────────────────────────────────────────────────┤
│  [Search…]  [Status ▾] [Depot ▾] [Date ▾]      3 filters  ✕ │  Toolbar (48px, optional)
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                        CONTENT                               │  Content (fills)
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ⚠ 3 unsaved changes            [ Discard ]  [ Save changes ]│  SaveBar (sticky, conditional)
└──────────────────────────────────────────────────────────────┘
```

**Every region except Content and AppBar is optional. The shell is one component; the archetypes are configurations of it.**

| Archetype | Header | Tabs | Toolbar | Content | SaveBar | Example |
|---|---|---|---|---|---|---|
| **Index** | ✓ | — | ✓ | DataTable | — | Vehicles, Drivers |
| **Workspace** | ✓ | ✓ | contextual | Aspect panel | contextual | Vehicle detail |
| **Workflow** | ✓ + stepper | — | — | Step body | — | Fuel Day |
| **Canvas** | overlay | — | overlay | Full-bleed | — | Live Map |

### 3.3 Breadcrumbs: use them sparingly

Breadcrumbs are only useful when hierarchy is deep and variable. In this IA, depth is capped at 3 (`Group → Object → Aspect`), and the aspect is already shown as a tab. So:

- **Index pages:** no breadcrumb. The sidebar shows where you are.
- **Detail pages:** a single **back-link** — `← Vehicles` — not a chain. One target, larger hit area, no truncation.
- **Settings overlay:** breadcrumb *inside* the overlay only.

This is the Linear approach and it is correct: breadcrumbs on a 2-level hierarchy are decoration.

### 3.4 The metaline replaces "description"

Instead of prose, render a **metaline** of structured facts:

```
Toyota Hilux · Depot North · Kabwe Route · Last seen 4 min ago
```

Scannable, dense, always current, never stale copy. Prose descriptions belong in empty states and settings — nowhere else.

---

## 4. Task 3 — UI hierarchy and visual system

Your existing tokens (`designTokens.js`) are a solid start — Inter, a real scale, CSS variables, dark-mode-aware surfaces. The problems are that the scale has **15 typography tokens that collapse to 6 real sizes**, and that 1,091 inline `sx` blocks mean the tokens aren't actually the source of truth.

### 4.1 Spacing — 4px base, 6 steps, no exceptions

```
space-1   4px    icon↔label, chip padding
space-2   8px    inside a card, between form label and input
space-3   12px   between rows in a list
space-4   16px   card padding, between cards
space-6   24px   page gutter, between sections
space-8   32px   between major page regions
```

**Delete `space-5` (20px) and `space-12` (48px).** 20px and 24px are indistinguishable and force a decision every time; 48px is `space-6 × 2`. Six steps is enough — Linear ships four.

**Enforcement rule:** any spacing value not from this scale fails review. That is the only way `sx={{ mb: 0.75 }}` (seen throughout `UnifiedSidebar.jsx`) stops happening.

### 4.2 Typography — collapse 15 tokens to 6 roles

Current `designTokens.js` has `display`, `h1`, `h2`, `bodyLarge`, `body`, `bodySmall`, `caption`, `metricValue`, `metricSmall`, `buttonLabel`, `pageTitle`, `tableHeader`, `metricTile`, `metricTileLabel`. `bodyLarge` (16/600) and `h2` (16/600) are **identical**. `pageTitle` (18/500) and `metricSmall` (18/700) differ only in weight.

Replace with:

| Role | Size / Line / Weight | Used for |
|---|---|---|
| `title-lg` | 20 / 28 / 600 | Page title (one per page) |
| `title` | 16 / 24 / 600 | Card & section headings |
| `body` | 14 / 20 / 400 | Everything by default |
| `body-strong` | 14 / 20 / 500 | Table primary cell, active nav |
| `label` | 12 / 16 / 500 | Field labels, table headers, nav group headers |
| `metric` | 28 / 32 / 600 tabular-nums | KPI values only |

Two families: **Inter** (UI), **JetBrains Mono** (IDs, plate numbers, permission keys, coordinates). Both already configured.

**One mandatory change:** every number that appears in a column or updates live gets `font-variant-numeric: tabular-nums`. Fuel litres, odometer, costs, timestamps. Without it, aligned numeric columns visibly jitter. This is the cheapest single upgrade to perceived quality in the entire document.

### 4.3 Elevation & cards — flat, borders not shadows

Enterprise dashboards are dense. Shadows on a dense grid create visual mud.

```
Level 0  page background     var(--surface-app)
Level 1  card                surface-card + 1px border, radius 8, NO shadow
Level 2  popover / dropdown  surface-card + border + shadow-sm
Level 3  modal / drawer      surface-card + shadow-md + scrim
```

Cards get **one** border and **no** shadow. Reserve shadow to mean "this floats above the page" — modals, popovers, drag states. Right now `shadows.subtle` on cards spends the signal on things that don't move.

Radius: `4` (chips, inputs), `8` (cards, buttons), `12` (modals), `full` (avatars, status dots). Four values, no others.

### 4.4 Tables — this is where the product lives

Fleet management **is** a table application. 28 hand-rolled tables is the biggest single source of inconsistency in the app. One `DataTable` primitive, non-negotiable:

```
┌───────────────────────────────────────────────────────────────────┐
│ ☐ │ VEHICLE ▾   │ STATUS   │ DRIVER    │ FUEL      │ LAST SEEN │ ⋮ │  36px, label token, sticky
├───────────────────────────────────────────────────────────────────┤
│ ☐ │ ABC 1234    │ ● Moving │ J. Mwale  │    78 L   │ 4 min ago │ ⋮ │  44px rows
│   │ Toyota Hilux│          │           │           │           │   │  ← optional 2nd line
├───────────────────────────────────────────────────────────────────┤
│ ☐ │ XYZ 9876    │ ○ Idle   │ —         │    12 L   │ 2 hrs ago │ ⋮ │
└───────────────────────────────────────────────────────────────────┘
  ← 1px row separators only. No zebra striping. No vertical rules. →
```

Rules:
- **44px rows** default, 36px in a "compact" density toggle. Not 52 — you lose 4 rows per screen.
- **Numbers right-aligned, tabular-nums.** Text left. Status centered never — left-align with the dot.
- **Row separators only** — no zebra stripes (they fight status colors), no column rules.
- **Sticky header + sticky first column** on horizontal scroll.
- **Row click opens the workspace. Never a modal.** The `⋮` menu holds destructive/secondary actions.
- **Selection enables a contextual action bar** that replaces the toolbar — no floating buttons.
- **Empty, loading, error, and no-results-for-filter are four distinct states.** See §4.9.

### 4.5 Layout dimensions

| Element | Value | Reason |
|---|---|---|
| Sidebar expanded | **240px** | Fits "Maintenance" + badge without truncation |
| Sidebar collapsed (rail) | **56px** | 40px icon target + 8px gutters |
| AppBar height | **52px** | Enough for a 32px control + padding |
| Page gutter | **24px** desktop, 16px tablet, 12px mobile | |
| Content max-width — tables | **none** (full bleed to gutters) | Columns need the room |
| Content max-width — dashboards | **1440px**, centered | Beyond this, cards stretch absurdly |
| Content max-width — forms / reading | **720px** | Line length |
| Drawer (detail panel) | **480px**, resizable to 720 | |
| Modal | **480 / 640 / 880** — three sizes only | |

Current 168px expanded is the most immediately visible defect in the app. Change it first.

### 4.6 Color — 90% neutral

The discipline that separates enterprise-grade from amateur: **color means something, or it isn't used.**

```
Neutral (90% of pixels)   backgrounds, borders, text, icons, table chrome
Primary  #1A56DB          exactly ONE primary action per view, active nav, links
Success  #059669          state only: healthy, completed, compliant
Warning  #D97706          state only: due soon, low, attention
Critical #DC2626          state only: overdue, fault, expired
Info     #3B82F6          neutral informational state
```

Explicit prohibitions:
- No colored card headers
- No colored section backgrounds
- No brand color on non-interactive elements
- No more than one filled primary button visible at once
- **Never encode status by color alone** — always color + shape/icon + text. Roughly 1 in 12 of your users has a color vision deficiency, and fleet software is used in bright sunlight on cheap screens.

Keep `fuelBar: #FFB800` — a domain-specific accent for fuel level is legitimate.

### 4.7 Status badges — three tiers

Don't use one chip for everything. Match the visual weight to the meaning:

**Tier 1 — Live state (dot + text, no container).** For things that change continuously.
```
● Moving      ● Idle      ○ Offline      ● Fault
```
No pill. Pills imply a discrete labelled category; live telemetry isn't that.

**Tier 2 — Workflow state (soft pill).** For record lifecycle.
```
( Draft )  ( Approved )  ( Locked )  ( Overdue )
background: color-light, text: color-dark, no border, radius 4
```

**Tier 3 — Attention (solid).** For things needing action *now*. Use sparingly — a screen with ten solid badges has none.
```
[ OVERDUE ]  [ EXPIRED ]
```

Your Fuel Day `effectiveStatus` (`draft`/`approved`/`locked`) is Tier 2. Vehicle motion state is Tier 1. Maintenance overdue is Tier 3.

### 4.8 Buttons — four variants, three sizes, one rule

| Variant | Use | Per view |
|---|---|---|
| **Primary** (filled) | The one thing this page is for | Max 1 |
| **Secondary** (outlined) | Common alternatives | 0–2 |
| **Ghost** (text) | Tertiary, toolbar, table row actions | Any |
| **Danger** (outlined red → filled on confirm) | Destructive | Behind confirmation |

Sizes: `sm 28px` (table rows, toolbars), `md 36px` (default), `lg 44px` (mobile primary, empty-state CTA). No other heights.

**Rule: destructive actions are never adjacent to their safe counterpart.** Put Delete in the `⋮` menu or on the opposite side of the dialog.

### 4.9 Empty, loading, and error states

This is your largest quality gap — 4 empty states across 28 tables.

**Four distinct empty states. They are not interchangeable:**

```
1. FIRST RUN — no data has ever existed
   ┌─────────────────────────────────────┐
   │            [ illustration ]         │
   │         No vehicles yet             │
   │  Add your first vehicle to start    │
   │  tracking fuel and maintenance.     │
   │      [ + Add vehicle ]              │   ← primary CTA, this is onboarding
   │      Import from CSV                │   ← secondary path
   └─────────────────────────────────────┘

2. NO RESULTS — data exists, filters exclude it
   ┌─────────────────────────────────────┐
   │  No vehicles match these filters    │
   │  Status: Moving · Depot: North      │   ← echo the active filters back
   │      [ Clear filters ]              │
   └─────────────────────────────────────┘

3. EMPTY BY DESIGN — a good outcome
   ┌─────────────────────────────────────┐
   │  ✓  No overdue maintenance          │   ← celebrate, don't apologize
   └─────────────────────────────────────┘

4. NO ACCESS — exists, not permitted
   ┌─────────────────────────────────────┐
   │  🔒 You don't have access to Fuel   │
   │  Ask an administrator for the       │
   │  Fuel Operator role.                │   ← name the exact role needed
   └─────────────────────────────────────┘
```

State 3 matters more than teams expect: showing "0" in a red-tinged empty box for *"overdue inspections"* trains users to read good news as failure.

**Loading — skeletons, never spinners, for known layouts.** You have `TableShimmer.jsx` already; it should be the only table loading state. Spinners are acceptable only for indeterminate in-place actions (a button's own busy state). Never a full-page spinner — it destroys perceived performance and loses scroll position.

**Progressive loading:** render the shell (header, tabs, toolbar) immediately from the route definition; skeleton only the data region. The page should feel present in <100ms even when data takes 2s.

### 4.10 Icon strategy

- **One family, one weight.** Currently `@mui/icons-material` mixes `MapOutlinedIcon` with the filled `HelpIcon` and `PaymentIcon` in the same sidebar (`UnifiedSidebar.jsx:28-29`). Pick **Outlined**, apply everywhere, no exceptions.
- **20px in nav and buttons. 16px inline with text. 24px in empty states.** Three sizes.
- **Icons never appear alone without a tooltip or a visible label** — except in the collapsed rail, where the tooltip is mandatory.
- **An icon must mean one thing app-wide.** A wrench is maintenance and nothing else, ever.
- Consider migrating to **Lucide** long-term — lighter, more consistent stroke, better at 20px. Not urgent.

---

## 5. Task 4 — Role and permission experience

### 5.1 What's actually wrong

Your instinct ("I dislike the giant checklist") is right, but the real problem is deeper than presentation. Three defects:

1. **`RolesSection.jsx` is read-only.** You can view roles; you cannot create or edit one.
2. **`EditRolesDialog.jsx` is a flat checkbox list** that tells the user it has no effect.
3. **The permission model is inverted for the user.** `permissionCatalog.js` has 28 permissions as `<module>.<resource>.<action>` pairs — `fleet.vehicles.read` and `fleet.vehicles.manage` are two independent checkboxes, but `manage` obviously implies `read`. Presenting them as independent forces the admin to reason about an implication the system already knows.

### 5.2 Recommendation: **Access Levels on Domain Cards**, with a Matrix as a secondary compare view

**Not** a permission matrix as the primary interface. Here is why, since you listed it first:

A matrix is an **auditor's** tool — it answers "who can do X?" across all roles. But the daily job is a **role editor's** task — "what should a Fuel Operator be able to do?" — which is a single-column question. A matrix makes the common task (edit one role) hard in order to make the rare task (compare all roles) easy. Wrong trade.

A matrix also does not survive scale. Your catalog is 28 permissions × 6 roles today. At 100 modules it is ~300 × 12 — a grid nobody can read, and one that cannot express the read/manage implication without doubling every row.

**The recommended primary interface:**

```
Roles ›  Fuel Operator                          [ Duplicate ]  [ Save ]

  Fuel Operator                              👥 4 members
  Plans and records the daily fueling run.
  ─────────────────────────────────────────────────────────

  ACCESS BY AREA

  ┌─────────────────────────────────────────────────────┐
  │ 🚚  Fleet                                           │
  │     Vehicles, drivers, geofences                    │
  │                                                     │
  │     ( None )  ( • View )  (  Manage  )              │  ← 3-state segmented
  │                                                     │
  │     ✓ Can see the vehicle registry and driver list  │  ← plain-English echo
  │     ✕ Cannot add, edit, or remove vehicles          │
  │                                          Details ⌄  │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │ ⛽  Fuel                                            │
  │     Fueling Day, driver requests, fuel reports      │
  │                                                     │
  │     ( None )  ( View )  ( • Manage )   ⚠ Custom     │  ← badge if not a clean level
  │                                                     │
  │     ✓ Plan, approve, and record Fueling Day         │
  │     ✓ View fuel reports                             │
  │     ✕ Cannot approve driver fuel requests           │  ← the exception, surfaced
  │                                          Details ⌃  │
  │     ┌───────────────────────────────────────────┐   │
  │     │ ☑ View Fueling Day    fuel.operations.read│   │  ← expert layer, opt-in
  │     │ ☑ Manage Fueling Day  fuel.operations.man…│   │
  │     │ ☐ Approve requests    fuel.requests.approve│  │
  │     │ ☑ View fuel reports   fuel.reports.read   │   │
  │     └───────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │ 🔒  Organization        ( • None )  ( View ) ( Man…)│  ← collapsed when None
  └─────────────────────────────────────────────────────┘
```

**Why this is the right answer:**

| Property | Effect |
|---|---|
| **8 cards, not 28 checkboxes** | The catalog's `category` field already defines these exactly: platform, fleet, fuel, reporting, organization, automation, integrations, system |
| **3-state access level** | Encodes `manage ⊃ read`, which the model already implies. One control replaces two checkboxes and removes an invalid state (`manage` without `read`) |
| **Plain-English echo under every control** | The admin reads consequences, not permission keys. This is the single biggest usability win |
| **Custom state is legal, not hidden** | Real roles have exceptions. Show `⚠ Custom`, don't force the admin into a clean level |
| **Expert layer behind `Details ⌄`** | Power users get exact keys; nobody else pays for them. `RolesSection.jsx` already has this "Show technical permissions" pattern — keep it |
| **Collapses when None** | A role with no Organization access shows one line, not eight |
| **Scales to 100 modules** | New permissions join an existing domain card. Adding a *domain* is rare and deliberate — same discipline as adding a sidebar room |

**The Matrix stays — as a secondary tab.** `Roles › Compare`. Read-only, exportable, 6 columns × 8 domain rows showing the access level (not 28 permission rows of checkmarks). That serves the auditor without taxing the editor.

### 5.3 Three additions that separate this from every fleet product on the market

**1. "What changes?" preview before save.**
```
  You're about to change Fuel Operator

  4 people are affected:  J. Mwale, P. Banda, +2

  They will GAIN                    They will LOSE
  ✓ Approve driver fuel requests    ✕ View fuel reports
                                    ⚠ 2 saved report schedules
                                      will stop running

              [ Cancel ]  [ Apply to 4 people ]
```
Nobody does this well. Permission changes are the highest-consequence, lowest-feedback action in enterprise software.

**2. "View as this role."** A preview toggle that renders the actual app navigation as that role sees it. Your single `navigationRegistry` (§2.7) makes this nearly free — filter the tree by the role's permissions and render it. This turns an abstract list into something the admin can *see*.

**3. Effective-permission trace on the person.** On a team member: not just "has role X", but *why* they can do something — and, critically, an explicit reconciliation of the Traccar-vs-NUMZ conflict that `PLATFORM_ARCHITECTURE.md` already flags as a live gap:
```
  J. Mwale can approve fuel requests
    ← via role: Fuel Operator
    ← granted by: fuel.requests.approve

  ⚠ This person is also a Traccar administrator, which
    currently overrides role-based restrictions.
```
Do not hide that conflict. Surfacing it is what makes the page trustworthy while the migration is incomplete — and it is a far better use of that space than the current "this doesn't do anything yet" banner.

### 5.4 Where Roles lives

`Settings → Organization → Roles`, with **Team** as the sibling that answers "who has which role" and **Roles** answering "what does each role mean." That split is already correct in `settingsSectionRegistry.js`. Keep it.

---

## 6. Task 5 — Design system

### 6.1 Layer model

```
L0  TOKENS       color · space · type · radius · motion · elevation      (no JSX)
L1  PRIMITIVES   Button Input Select Checkbox Radio Switch Chip Avatar
                 Icon Tooltip Spinner Skeleton Divider
L2  PATTERNS     DataTable Card KpiTile Toolbar FilterBar SearchField
                 Tabs Drawer Modal Toast Timeline ActivityFeed
                 EmptyState StatusBadge Stepper PropertyList
L3  SHELLS       AppShell PageHeader AspectTabs SaveBar CommandPalette
L4  FEATURES     VehicleTable FuelDayStepper RoleEditor …
```

**Enforcement rule: L4 may not contain raw `sx` for layout or color.** That rule alone is what prevents the 1,091-inline-`sx` situation from recurring. Feature code composes L1–L3; it does not style.

### 6.2 Core component contracts

**`<DataTable>`** — one implementation, replacing all 28
```
columns          [{ id, header, accessor, align, width, sortable, sticky, render }]
rows, rowKey
density          'comfortable' | 'compact'
selection        'none' | 'single' | 'multi'
onRowClick       → opens workspace (never a modal)
state            'loading' | 'empty' | 'no-results' | 'error' | 'ready'
emptyState       <EmptyState> config per state — REQUIRED, not optional
bulkActions      renders the contextual selection bar
virtualized      auto above 200 rows
```
Making `emptyState` a required prop is deliberate: it is how you get from 4 empty states to 28 without relying on discipline.

**`<PageHeader>`**
```
backTo           { label, path }  — single back-link, not a breadcrumb chain
title            string
status           <StatusBadge>
meta             string[]  — the metaline, joined with ·
primaryAction    one, or null
actions          overflow menu items
```

**`<EmptyState>`**
```
variant   'first-run' | 'no-results' | 'all-clear' | 'no-access' | 'error'
```
The variant drives illustration, tone, and CTA. An `all-clear` renders green with a check; a `first-run` renders an onboarding CTA. Same component, opposite emotional register — that distinction is the whole point.

**`<StatusBadge>`**
```
tier      'live' | 'workflow' | 'attention'
tone      'neutral' | 'success' | 'warning' | 'critical' | 'info'
```
Never accepts a raw color. That is how color discipline is enforced structurally rather than by review.

**`<DetailDrawer>`** — 480px, resizable, keeps the list visible behind it. Use for quick inspection and light edits. **Rule: if the drawer needs tabs, it should have been a workspace page.**

**`<Modal>`** — three sizes. Use *only* for: destructive confirmation, focused creation (≤6 fields), and blocking decisions. Everything else is a drawer or a page. Modals that contain tables or tabs are an architecture smell.

**`<Timeline>` / `<ActivityFeed>`** — distinct components. Timeline is *this object's* chronology (vehicle service history). ActivityFeed is *the org's* recent events. They look similar and behave differently: timeline is dense, filterable by aspect, and anchors to the object; the feed is realtime, paginated, and cross-object.

**`<FilterBar>`** — filters are URL state, always. Every filtered view must be shareable by copying the address bar. This is table stakes for enterprise and currently absent.

**`<CommandPalette>`** — promote the existing component to L3 and make it the primary deep-nav mechanism: navigate, act (`Create work order`), search records (`ABC 1234`), and jump to settings. Register entries from `navigationRegistry`.

### 6.3 Motion

```
instant   0ms      state changes, checkboxes, toggles
fast      120ms    hover, focus ring, tooltip
base      180ms    dropdown, tab switch, drawer
slow      240ms    modal, page transition
easing    cubic-bezier(0.2, 0, 0, 1)
```
Nothing animates longer than 240ms. Nothing bounces. Respect `prefers-reduced-motion` by dropping to `instant`. Enterprise users open a screen 200 times a day — every animation is a tax.

---

## 7. Task 6 — Wireframes

### 7.1 Sidebar (expanded 240 / rail 56)

```
┌──────────────────────────┐   ┌────────┐
│ ◆ NUMZTRAK    ⌄ Acme Ltd │   │   ◆    │
├──────────────────────────┤   ├────────┤
│ ┌──────────────────────┐ │   │        │
│ │ 🔍 Search…       ⌘K  │ │   │  🔍    │
│ └──────────────────────┘ │   │        │
│                          │   │        │
│  ◈  Today                │   │  ◈     │  ← active: 3px left bar
│  ◉  Live Map             │   │  ◉     │
│                          │   │  ──    │  ← group = divider only in rail
│  RUN                     │   │        │
│  ⛽  Fuel Day        (3)  │   │  ⛽ ³   │
│  🔧  Maintenance    (12)  │   │  🔧ⁱ²  │
│  📋  Requests        (5)  │   │  📋 ⁵  │
│                          │   │  ──    │
│  MANAGE                  │   │        │
│  🚚  Vehicles            │   │  🚚    │
│  👤  Drivers             │   │  👤    │
│  🛡  Compliance          │   │  🛡    │
│                          │   │  ──    │
│  UNDERSTAND              │   │        │
│  📊  Insights            │   │  📊    │
│                          │   │        │
│         (empty space —   │   │        │
│          this is a       │   │        │
│          feature)        │   │        │
├──────────────────────────┤   ├────────┤
│  ⚠  2 alerts             │   │  ⚠ ²   │
│  ◐ Numeri N.      ⚙  🔔  │   │  ◐     │
└──────────────────────────┘   └────────┘
```
No accordions. No scrolling. The empty space below "Insights" is deliberate — it is the visible promise that this list will not grow.

### 7.2 Today (replaces Dashboard)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Today                                    Thu 6 Aug · 07:14   [⌘K] ⚙ ◐ │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Good morning, Numeri                                                  │
│  3 things need you today                            [ Start fuel day ] │
│                                                                        │
│  ┌── NEEDS YOU ────────────────────────────────────────────────────┐  │
│  │ ⚠  Fuel Day FD-20260806-001 awaiting approval    620 L · K22,010│  │
│  │                                              [ Review & approve ]│  │
│  ├─────────────────────────────────────────────────────────────────┤  │
│  │ 🔧  ABC 1234 service overdue by 1,200 km      [ Create order ]  │  │
│  ├─────────────────────────────────────────────────────────────────┤  │
│  │ 📄  2 driver licences expire in 14 days       [ View ]          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─ FLEET NOW ─────┐ ┌─ FUEL TODAY ────┐ ┌─ COST MTD ──────────────┐ │
│  │       24        │ │      310 L      │ │       K 184,220         │ │
│  │  of 31 active   │ │  of 620 planned │ │  ▲ 8% vs last month     │ │
│  │                 │ │  ▓▓▓▓▓▓░░░░ 50% │ │  ▁▂▃▅▄▆▇ sparkline      │ │
│  │ ● 18 moving     │ │                 │ │                         │ │
│  │ ○ 6 idle        │ │ 12 of 20 fueled │ │ Fuel 71% · Service 29%  │ │
│  │ ✕ 7 offline     │ │                 │ │                         │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────────────┘ │
│                                                                        │
│  ┌─ LIVE ACTIVITY ─────────────────────┐ ┌─ ERB FUEL PRICE ────────┐ │
│  │ 07:12  ABC 1234 departed Depot North│ │ Diesel      K 35.50 /L  │ │
│  │ 07:04  XYZ 9876 fuelled 42 L        │ │ Petrol      K 34.10 /L  │ │
│  │ 06:58  DEF 5555 entered Kabwe Route │ │ Updated 06:00 · ERB     │ │
│  │                          View all → │ │                         │ │
│  └─────────────────────────────────────┘ └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```
**"Needs you" is above the KPIs.** Most fleet dashboards lead with metrics. Metrics are a *report*; a manager opening the app at 07:00 needs a *worklist*. Numbers are context for the decisions, not the point.

### 7.3 Vehicles (Index archetype)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Vehicles                                                 [⌘K] ⚙ ◐     │
├────────────────────────────────────────────────────────────────────────┤
│  Vehicles                                    [ Import ] [ + Add ]      │
│  31 vehicles · 24 active · 7 offline                                   │
├────────────────────────────────────────────────────────────────────────┤
│  [🔍 Search plate, model, driver…]  [Status ▾][Depot ▾][Fuel ▾]  ⊞ ☰  │
├────────────────────────────────────────────────────────────────────────┤
│ ☐│ VEHICLE ▾      │STATUS  │DRIVER   │ FUEL │ ODOMETER │LAST SEEN│⋮   │
│──┼────────────────┼────────┼─────────┼──────┼──────────┼─────────┼──  │
│ ☐│ ABC 1234       │● Moving│J. Mwale │ 78 L │  221,450 │ 4 min   │⋮   │
│  │ Toyota Hilux   │        │         │▓▓▓▓░ │          │         │    │
│──┼────────────────┼────────┼─────────┼──────┼──────────┼─────────┼──  │
│ ☐│ XYZ 9876       │○ Idle  │—        │ 12 L │  108,220 │ 2 hrs   │⋮   │
│  │ Isuzu D-Max    │        │         │▓░░░░ │          │         │    │
│──┼────────────────┼────────┼─────────┼──────┼──────────┼─────────┼──  │
│ ☐│ DEF 5555   ⚠   │✕ Offln │K. Phiri │  —   │   87,110 │ 3 days  │⋮   │
│  │ Fuso Canter    │        │         │      │          │         │    │
├────────────────────────────────────────────────────────────────────────┤
│  Showing 1–25 of 31                              ‹ 1 2 ›   25 / page ▾ │
└────────────────────────────────────────────────────────────────────────┘

  When rows are selected, the toolbar is REPLACED:
┌────────────────────────────────────────────────────────────────────────┐
│  3 selected   [ Assign driver ] [ Add to fuel day ] [ Export ]    ✕    │
└────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Vehicle workspace (Workspace archetype)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ← Vehicles                                               [⌘K] ⚙ ◐     │
├────────────────────────────────────────────────────────────────────────┤
│  ABC 1234   ● Moving                    [ Assign driver ] [ Actions ▾ ]│
│  Toyota Hilux 2019 · Depot North · J. Mwale · Last seen 4 min ago      │
├────────────────────────────────────────────────────────────────────────┤
│  Overview │ Fuel │ Maintenance │ Trips │ Documents │ Costs │ Setup     │
├───────────┴────────────────────────────────────────────────────────────┤
│  ┌─ STATUS ──────────────┐  ┌─ POSITION ─────────────────────────────┐│
│  │ Fuel      78 L  ▓▓▓▓░ │  │  [    inline map, 220px tall       ]   ││
│  │ Odometer  221,450 km  │  │  Great East Rd, Chongwe                ││
│  │ Engine    Running     │  │  62 km/h · heading NE                  ││
│  │ Battery   12.6 V      │  └────────────────────────────────────────┘│
│  └───────────────────────┘                                            │
│                                                                        │
│  ┌─ NEEDS ATTENTION ─────────────────────────────────────────────────┐│
│  │ ⚠ Service overdue by 1,200 km                    [ Create order ] ││
│  │ ⚠ Insurance expires in 21 days                   [ Upload ]       ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                        │
│  ┌─ RECENT ACTIVITY ──────────┐  ┌─ 30-DAY COST ─────────────────────┐│
│  │ 07:12  Departed Depot North│  │  Fuel      K 8,420    ▓▓▓▓▓▓▓░    ││
│  │ 06:40  Fuelled 42 L        │  │  Service   K 2,100    ▓▓░░░░░░    ││
│  │ Yest.  Service completed   │  │  Total     K 10,520               ││
│  │              Full history →│  │            ▲ 12% vs prior 30 d    ││
│  └────────────────────────────┘  └───────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────┘
```
Every future vehicle feature becomes a tab here. That is the 100-module answer made concrete.

### 7.5 Fuel Day (Workflow archetype)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ← Fuel Day                                               [⌘K] ⚙ ◐     │
├────────────────────────────────────────────────────────────────────────┤
│  FD-20260806-001   ( Approved )              Locks in 6h 41m  [ Close ]│
│  Thu 6 Aug 2026 · Africa/Lusaka · 620 L planned · K 22,010 budget      │
├────────────────────────────────────────────────────────────────────────┤
│   ①────────②────────③────────④────────⑤                             │
│   Plan   Forecast  Approve   RUN     Review                            │
│    ✓        ✓        ✓       ●                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────────────────┐  ┌─ PROGRESS ────────────────────┐ │
│  │  12 of 20 vehicles fuelled    │  │  Planned      620 L           │ │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  60%   │  │  Recorded     310 L           │ │
│  └───────────────────────────────┘  │  Remaining    310 L           │ │
│                                     │  ─────────────────────────    │ │
│  [🔍 Scan or search plate…]         │  Price      K 35.50 /L (ERB)  │ │
│                                     │  Spent      K 11,005          │ │
│  ┌─ QUEUE ───────────────────────┐  │  Variance   ▬ on budget       │ │
│  │ ABC 1234   Planned 310 L      │  └───────────────────────────────┘ │
│  │ ● Arrived 07:40               │                                    │
│  │           [ Record refuel ]   │  ┌─ VARIANCE ────────────────────┐ │
│  ├───────────────────────────────┤  │ ⚠ XYZ 9876 recorded 58 L vs   │ │
│  │ XYZ 9876   Planned 50 L       │  │   50 L planned  (+16%)        │ │
│  │ ✓ Fuelled 58 L  ⚠ +16%        │  │                    Review →   │ │
│  ├───────────────────────────────┤  └───────────────────────────────┘ │
│  │ DEF 5555   Planned 40 L       │                                    │
│  │ ○ Not arrived      [ Skip ]   │                                    │
│  └───────────────────────────────┘                                    │
└────────────────────────────────────────────────────────────────────────┘
```
Stepper replaces the current sidebar children (`prepare`/`fuel`/`invoices`/`review`). A sequential process should never be a menu — a menu implies free navigation the workflow does not permit.

### 7.6 Insights (replaces 3 report entries)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Insights                                                 [⌘K] ⚙ ◐     │
├────────────────────────────────────────────────────────────────────────┤
│  Insights                                    [ Schedule ] [ Export ▾ ] │
│  Aug 2026 · All depots · 31 vehicles                                   │
├────────────────────────────────────────────────────────────────────────┤
│  Overview │ Fuel │ Utilisation │ Cost │ Maintenance │ Activity │ Audit │
├──────────┴─────────────────────────────────────────────────────────────┤
│  [ Aug 2026 ▾ ]  [ All depots ▾ ]  [ All vehicles ▾ ]      3 filters ✕ │
│                                                                        │
│  ┌─ COST/KM ──┐ ┌─ L/100KM ──┐ ┌─ UTILISATION┐ ┌─ DOWNTIME ─────────┐│
│  │  K 4.82    │ │   12.4 L   │ │    74 %     │ │      3.2 days      ││
│  │  ▼ 3%      │ │   ▲ 0.8    │ │    ▲ 2%     │ │      ▼ 1.1         ││
│  └────────────┘ └────────────┘ └─────────────┘ └────────────────────┘│
│                                                                        │
│  ┌─ FUEL CONSUMPTION ────────────────────────────────────────────────┐│
│  │   L                                                               ││
│  │ 800│           ╭──╮      ╭─╮                                      ││
│  │ 400│   ╭───╮ ╭─╯  ╰──╮╭──╯ ╰───╮                                 ││
│  │   0└───┴───┴─┴───────┴┴────────┴───────────────────────────       ││
│  │     W1    W2     W3      W4                                       ││
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                        │
│  ┌─ BY VEHICLE ──────────────────────────────────────────────────────┐│
│  │ VEHICLE     │ DISTANCE │ FUEL   │ L/100KM │ COST    │ COST/KM     ││
│  │ ABC 1234    │ 4,210 km │ 522 L  │   12.4  │ K18,531 │ K 4.40      ││
│  │ XYZ 9876    │ 2,180 km │ 310 L  │   14.2  │ K11,005 │ K 5.05  ⚠   ││
│  └───────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────┘
```
"Traccar reports" becomes the **Activity** tab. The vendor name never reaches the user.

### 7.7 Team (Settings overlay)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Settings                                                          ✕   │  ← overlay
├────────────────┬───────────────────────────────────────────────────────┤
│ PERSONAL       │  Organization › Team                                  │
│  Profile       │                                                       │
│  Security      │  Team                            [ + Invite member ]  │
│  Preferences   │  12 members · 3 pending invitations                   │
│  Notifications │  ───────────────────────────────────────────────────  │
│                │  [🔍 Search…]      [ Role ▾ ]  [ Status ▾ ]           │
│ ORGANIZATION   │                                                       │
│  General       │  ┌──────────────────────────────────────────────────┐│
│ ▸Team          │  │ ◐ Numeri Nyirenda           Company Admin     ⋮  ││
│  Roles         │  │   numeri@acme.com           ● Active             ││
│  Billing       │  ├──────────────────────────────────────────────────┤│
│                │  │ ◐ James Mwale               Fuel Operator     ⋮  ││
│ FLEET          │  │   james@acme.com            ● Active             ││
│  Depots        │  │                             ⚠ Traccar admin      ││  ← the real conflict
│  Service rules │  ├──────────────────────────────────────────────────┤│
│                │  │ ◐ Peter Banda               Driver           ⋮  ││
│ AUTOMATION     │  │   peter@acme.com            ◷ Invited 2 d ago    ││
│  Alert rules   │  │                             [ Resend ] [ Cancel ]││
│  Calendars     │  └──────────────────────────────────────────────────┘│
│  Commands      │                                                       │
│                │                                                       │
│ ADVANCED       │                                                       │
│  Devices       │                                                       │
│  Integrations  │                                                       │
│  Server        │                                                       │
└────────────────┴───────────────────────────────────────────────────────┘
```
Settings as a full-screen overlay over the current page. `Esc` closes and returns you exactly where you were. This is the Linear/Stripe model, and it is why their settings can hold 40 sections without complicating the product.

### 7.8 Roles

```
┌────────────────────────────────────────────────────────────────────────┐
│  Settings                                                          ✕   │
├────────────────┬───────────────────────────────────────────────────────┤
│ …              │  Organization › Roles                                 │
│ ORGANIZATION   │                                                       │
│  General       │  Roles                              [ + Create role ] │
│  Team          │  What each role can do. Assign roles in Team.         │
│ ▸Roles         │  ───────────────────────────────────────────────────  │
│  Billing       │  Roles │ Compare                                      │
│ …              │  ──────┴──────────────────────────────────────────    │
│                │                                                       │
│                │  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐ │
│                │  │Company Admin │ │Fleet Manager │ │Fuel Operator  │ │
│                │  │👥 2 members  │ │👥 3 members  │ │👥 4 members   │ │
│                │  │              │ │              │ │               │ │
│                │  │Fleet   Manage│ │Fleet   Manage│ │Fleet    View  │ │
│                │  │Fuel    Manage│ │Fuel    Manage│ │Fuel    Manage │ │
│                │  │Reports Manage│ │Reports  View │ │Reports  View  │ │
│                │  │Org     Manage│ │Org      None │ │Org      None  │ │
│                │  │+4 more       │ │+4 more       │ │+4 more        │ │
│                │  │      Edit →  │ │      Edit →  │ │      Edit →   │ │
│                │  └──────────────┘ └──────────────┘ └───────────────┘ │
│                │  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐ │
│                │  │Technician    │ │Driver        │ │  + Create     │ │
│                │  │👥 2 members  │ │👥 1 member   │ │    custom     │ │
│                │  │      Edit →  │ │      Edit →  │ │    role       │ │
│                │  └──────────────┘ └──────────────┘ └───────────────┘ │
│                │                                                       │
│                │  ── Compare tab ────────────────────────────────────  │
│                │  AREA        │Admin│Mgr │Fuel│Tech│Drv│               │
│                │  Fleet       │ ███ │███ │ ▒▒ │ ▒▒ │ ▒ │ ███ Manage   │
│                │  Fuel        │ ███ │███ │███ │ ·  │ ▒ │ ▒▒▒ View     │
│                │  Maintenance │ ███ │███ │ ·  │███ │ · │  ·  None     │
│                │  Reports     │ ███ │ ▒▒ │ ▒▒ │ ·  │ · │              │
│                │  Organization│ ███ │ ·  │ ·  │ ·  │ · │              │
│                │  Automation  │ ███ │ ▒▒ │ ·  │ ▒▒ │ · │              │
│                │  Integrations│ ███ │ ·  │ ·  │███ │ · │              │
│                │  System      │ ███ │ ·  │ ·  │ ·  │ · │              │
└────────────────┴───────────────────────────────────────────────────────┘
```
8 domain rows × 6 roles — a matrix a human can read. Contrast with 28 permission rows of checkmarks, which nobody can.

The role editor detail view is wireframed in §5.2.

---

## 8. Task 7 — Component hierarchy

```
<App>
├── <Providers>                          theme · i18n · store · query · socket
│
├── <AuthGate>                           → <LoginPage> if unauthenticated
│
├── <CommandPalette/>                     ⌘K — global, above everything
├── <ToastHost/>                          bottom-right stack, max 3
├── <SettingsOverlay/>                    ⌘, — full-screen, over any route
│   ├── <SettingsNav/>                    from navigationRegistry.settings
│   └── <SettingsSection/>                Profile · Team · Roles · …
│
└── <AppShell>
    │
    ├── <NavSidebar>                      240 / 56 rail — reads navigationRegistry
    │   ├── <OrgSwitcher/>                platform ↔ company (PLATFORM_ARCHITECTURE)
    │   ├── <NavSearchTrigger/>           opens CommandPalette
    │   ├── <NavGroup>                    Run · Manage · Understand
    │   │   └── <NavItem>                 icon · label · <NavBadge> (from badge service)
    │   └── <NavFooter>                   alerts · user · settings · notifications
    │
    ├── <AppBar>                          52px
    │   ├── <BackLink/>                   single target, no breadcrumb chain
    │   ├── <ContextBanner/>              "Viewing: ABC Logistics [Exit]"
    │   └── <AppBarActions/>              ⌘K · notifications · avatar
    │
    └── <PageContainer>                   route outlet
        │
        ├── ══ INDEX archetype ══
        │   ├── <PageHeader/>             title · metaline · primaryAction · overflow
        │   ├── <Toolbar>
        │   │   ├── <SearchField/>
        │   │   ├── <FilterBar/>          URL-synced
        │   │   └── <ViewToggle/>         table · grid · map
        │   ├── <DataTable>
        │   │   ├── <TableHeader/>        sticky · sortable
        │   │   ├── <TableRow/>           → navigates to workspace
        │   │   ├── <TableSkeleton/>      never a spinner
        │   │   └── <EmptyState/>         REQUIRED prop, 5 variants
        │   ├── <SelectionBar/>           replaces Toolbar when rows selected
        │   ├── <Pagination/>
        │   └── <DetailDrawer/>           480px, optional quick-inspect
        │
        ├── ══ WORKSPACE archetype ══
        │   ├── <PageHeader/>             + <StatusBadge tier="live">
        │   ├── <AspectTabs/>             from registry.aspects
        │   └── <AspectPanel>
        │       ├── <CardGrid>
        │       │   ├── <Card/> <KpiTile/> <PropertyList/>
        │       │   └── <MiniMap/> <Sparkline/>
        │       ├── <AttentionList/>      the "needs you" pattern
        │       ├── <Timeline/>           this object's chronology
        │       └── <SaveBar/>            sticky, only when dirty
        │
        ├── ══ WORKFLOW archetype ══
        │   ├── <PageHeader/> + <WorkflowStatus/>
        │   ├── <Stepper/>                linear, non-skippable
        │   └── <StepBody>
        │       ├── <WorkQueue/>          the run list
        │       ├── <SidePanel/>          running totals, variance
        │       └── <StepActions/>        advance · save · abandon
        │
        └── ══ CANVAS archetype ══
            ├── <MapCanvas/>              full-bleed
            ├── <MapOverlayBar/>          floating, top
            ├── <MapEntityList/>          collapsible left panel
            └── <MapDetailCard/>          floating, on selection

── SHARED PRIMITIVES (L1/L2) ──
   Button Input Select Checkbox Radio Switch Chip Avatar Icon
   Tooltip Skeleton Divider Modal Drawer Tabs Menu Popover
   StatusBadge EmptyState KpiTile Card Timeline ActivityFeed Stepper
```

Three structural rules that make this hold:

1. **`AppShell` never knows about a feature.** It reads `navigationRegistry` and renders. Adding a module touches the registry and adds a route — nothing else.
2. **Archetypes are configurations, not forks.** All four use the same `PageContainer`. There is one place page structure is defined.
3. **L4 feature code composes; it does not style.** No layout or color `sx` below the shell layer.

---

## 9. Scaling to 100 modules

### 9.1 The rules that make it hold

1. **The sidebar is frozen at 9 entries.** Adding one requires proving the feature is a *place*, not an *aspect*. In practice this should happen roughly never.
2. **New features are aspects of existing objects** until proven otherwise (§2.6).
3. **One navigation registry.** Sidebar, ⌘K, breadcrumbs, mobile nav, and "view as role" all derive from it.
4. **Permissions come from `permissionCatalog.js`**, one mechanism, not three.
5. **⌘K is the escape valve.** Anything not in the sidebar is one keystroke away — which is precisely what makes freezing the sidebar acceptable.
6. **Settings is an overlay** and can grow without limit; it is not competing for primary real estate.
7. **Empty states are a required prop**, not a nice-to-have.
8. **Every filtered view is a URL.**

### 9.2 Where you stand against the competition

| | Fleetio | Samsara | Motive | Geotab | **NUMZTRAK today** | **After this** |
|---|---|---|---|---|---|---|
| Sidebar items | ~12 | ~10 | ~9 | ~20 | **~11 + accordions** | **9, frozen** |
| Object-centric workspaces | ✓ | ✓ | ✓ | partial | partial (vehicles only) | ✓ |
| Command palette | ✗ | ✗ | ✗ | ✗ | exists, underused | **✓ load-bearing** |
| Settings as overlay | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |
| Modern RBAC editor | weak | matrix | weak | matrix | **read-only + inert** | **✓ best-in-class** |

**Two places you can genuinely beat all five:** a load-bearing command palette (none of them have one — this is a real gap in the category), and the RBAC experience in §5. Every incumbent ships either a checkbox wall or an unreadable matrix. The permission-change preview and "view as this role" are differentiators, not polish.

Geotab at ~20 sidebar items is the cautionary example — it is what the current trajectory produces.

### 9.3 Sequencing

Ordered by (impact ÷ risk). Each phase is independently shippable.

| Phase | Work | Why here |
|---|---|---|
| **0** | Sidebar 168→240px; single icon weight; tabular-nums on all numeric columns | Hours of work. Largest visible quality jump per unit effort. Zero architectural risk. |
| **1** | `navigationRegistry.js` — one tree, `permissionCatalog` keys. Sidebar reads it. Badges move to a shared service (sidebar stops fetching). | Unblocks everything else. Fixes §1.2, §1.3, §1.8. |
| **2** | Restructure to 9 entries. Merge 3 report entries → Insights. Settings → overlay. Permanent redirects for every old path. | The IA change. Do it after the registry exists so it's a data edit, not a rewrite. |
| **3** | `PageHeader` · `DataTable` · `EmptyState` · `StatusBadge`. Migrate 3 pages as proof, then the rest. | Kills 28 tables, 1,091 `sx`, and the 4-empty-states problem. Biggest consistency win. |
| **4** | Role editor (§5.2) + preview + "view as role". Wire `permissionCatalog` to real enforcement. | Highest differentiation. Needs phases 1 & 3 in place. |
| **5** | URL vocabulary migration with redirects | Low risk once redirects are proven in phase 2. |
| **6** | Promote `CommandPalette` to load-bearing; register everything | Compounding value; needs the full registry. |

**Phase 0 alone will make the app feel materially more expensive to use**, and it can ship this week. Do not skip it while planning the larger phases.

---

## 10. Open questions for you

1. **"Run / Manage / Understand" vs "Today / Fleet / Insight"** — I recommend the former and explained why (§2.4), but this is worth a real test with two or three fleet managers.
2. **Compliance as a top-level entry** — I included it on the bet that Zambian fleet operators face meaningful licence/insurance/inspection obligations. If documents are actually low-volume, fold it into `Vehicle → Documents` and drop to 8 entries.
3. **Platform mode** — `PLATFORM_ARCHITECTURE.md` defines a `/platform` operator context. The `OrgSwitcher` in §8 is the hook for it, but the platform workspace deserves its own IA pass; I have not designed it here.
4. **Mobile** — the fuel-run flow (§7.5) is plainly a phone task. This document assumes desktop-first with a responsive shell. A dedicated mobile IA for RUN-group tasks is a separate exercise and probably a valuable one.
