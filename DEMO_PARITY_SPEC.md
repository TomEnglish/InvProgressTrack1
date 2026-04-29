# Demo Parity Spec — Invenio ProgressTracker

Consolidated specification for bringing the dev app to feature parity with the demo at https://kindredprojectdemo.netlify.app/ while extending the auth/tenancy model to support multiple ProgressTracker instances per client with variable user access.

Companion to [ARCHITECTURE.md](ARCHITECTURE.md). This doc is the source of truth for the parity work; once items ship, fold them back into ARCHITECTURE.md and prune from here.

---

## 1. Goal

Bring the dev app to demo-feature parity, plus a real multi-tenant / multi-project access model. After this work:

- A client (tenant) can host multiple ProgressTracker instances (projects).
- Users within a tenant have variable per-project access with project-level roles.
- The full demo feature set — six-discipline coverage, weekly xlsx ingestion, dual baselines, period comparison with grouping, foreman tracking, qty metrics — is implemented.

---

## 2. Feature gap summary

| # | Feature | Status today | Demo expectation |
|---|---|---|---|
| 1 | Discipline coverage | 4 (Civil, Piping, Structural, Electrical) | 6 (Civil, Pipe, Steel, Electrical, Mechanical, Instrumentation) |
| 2 | Foreman tracking | absent | "By Foreman" grouping; foreman = user (hybrid) |
| 3 | Earned QTY metric | absent | per-row qty + per-discipline rollup + project composite % |
| 4 | Period Tracking page | aggregate KPI delta only | period dropdowns, custom date range, filters, grouping, per-row comparison table |
| 5 | Weekly Snapshot upload | single CSV, no metadata | multi-file xlsx, week-ending date, label, explicit per-file audit-type picker, history panel |
| 6 | Audits page hierarchy | flat filterable table | expandable per-discipline sections + Expand/Collapse All |
| 7 | Baseline | none | dual baseline: Planned + 1st Audit, both rendered on charts |
| 8 | Multi-project access | hardcoded fixture project | project picker, project URL routing, per-project member access |
| 9 | Discipline Progress page | chart on Overview only | dedicated route with per-discipline cards + curves |
| 10 | xlsx ingestion | CSV only | xlsx (transversal — required by #5) |

---

## 3. Access model

Two-tier access. Tenant is the outer boundary; per-project membership controls visibility within a tenant.

### 3.1 Tables

```sql
-- existing
app_users (id, tenant_id, role, created_at)
projects  (id, tenant_id, name, planned_start, planned_end, status, …)

-- new
project_members (
  user_id    uuid not null references app_users(id) on delete cascade,
  project_id uuid not null references projects(id)  on delete cascade,
  role       text not null check (role in ('admin','editor','viewer')) default 'viewer',
  added_by   uuid references app_users(id),
  added_at   timestamptz not null default now(),
  primary key (user_id, project_id)
);
create index on project_members (project_id);
```

### 3.2 Roles and capabilities

`app_users.role` becomes `tenant_admin` | `member`. Per-project role lives on `project_members`.

| Capability | tenant_admin | project admin | editor | viewer |
|---|:-:|:-:|:-:|:-:|
| See project | all in tenant | this project | this project | this project |
| Upload audits | ✓ | ✓ | ✓ | — |
| Edit project settings (name, dates, weights, baseline reset) | ✓ | ✓ | — | — |
| Manage project members | ✓ | ✓ (own project) | — | — |
| Create/delete tenant users | ✓ | — | — | — |

Tenant admins are not stored in `project_members`; their visibility is inherited and surfaced as a separate "Tenant admins" section in the Members UI.

### 3.3 Authorization helper

```sql
create or replace function user_can_access_project(p_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from app_users u
    where u.id = auth.uid()
      and u.role = 'tenant_admin'
      and u.tenant_id = (select tenant_id from projects where id = p_id)
  )
  or exists (
    select 1 from project_members
    where user_id = auth.uid() and project_id = p_id
  );
$$;
```

### 3.4 RLS

Swap data-table policies from tenant-based (`tenant_id = get_auth_tenant_id()`) to project-membership-based (`user_can_access_project(project_id)`). The `tenant_admin` branch inside the helper preserves tenant-wide visibility for admins.

Tables affected: `progress_items`, `disciplines`, `iwps`, `period_snapshots`, `period_snapshot_items`, `project_discipline_weights`. `app_users` and `projects` keep tenant-scoped policies.

### 3.5 RPC guards

Every existing RPC taking `p_id` (`get_project_metrics`, `get_discipline_metrics`, `create_period_snapshot`, etc.) gains:

```sql
if not user_can_access_project(p_id) then
  raise exception 'access denied';
end if;
```

### 3.6 Backfill

- `app_users.role = 'admin'` → `tenant_admin` (visibility unchanged via inheritance).
- `app_users.role = 'viewer'` → `member`, plus a `project_members` row for every project in their tenant with `role='viewer'` (preserves current "see everything" behavior).

---

## 4. Data model changes (single migration bundle)

```sql
-- 4.1 Auth/tenancy (see §3)
create table project_members (...);

-- 4.2 Disciplines: ensure all six exist
insert into disciplines (project_id, name, code) values …;
-- rename Piping→Pipe, Structural→Steel for label parity, or store dual name/code

-- 4.3 Foreman (hybrid)
alter table progress_items
  add column foreman_user_id uuid references app_users(id),
  add column foreman_name    text;

create table foreman_aliases (
  name    text primary key,
  user_id uuid references app_users(id) on delete cascade
);

-- 4.4 Earned QTY (per-row unit)
alter table progress_items
  add column budget_qty numeric,
  add column actual_qty numeric,
  add column unit text;
update progress_items set unit = 'HRS' where unit is null;
alter table progress_items alter column unit set not null;
alter table progress_items
  add column earned_qty numeric generated always as
    (coalesce(budget_qty,0) * percent_complete / 100) stored;

-- 4.5 Qty rollup config (project-level)
alter table projects
  add column qty_rollup_mode text not null default 'hours_weighted'
    check (qty_rollup_mode in ('hours_weighted','equal','custom'));

create table project_discipline_weights (
  project_id    uuid not null references projects(id) on delete cascade,
  discipline_id uuid not null references disciplines(id) on delete cascade,
  weight        numeric not null check (weight >= 0 and weight <= 1),
  primary key (project_id, discipline_id)
);

-- 4.6 Per-item snapshot rows + dual baseline
alter table period_snapshots
  add column kind text not null default 'weekly'
    check (kind in ('weekly','baseline_first_audit')),
  add column week_ending  date,
  add column label        text,
  add column source_filename text,
  add column uploaded_by  uuid references app_users(id),
  add column uploaded_at  timestamptz default now();

create unique index one_first_audit_per_project
  on period_snapshots (project_id) where kind = 'baseline_first_audit';

create table period_snapshot_items (
  snapshot_id      uuid not null references period_snapshots(id) on delete cascade,
  progress_item_id uuid not null references progress_items(id),
  percent_complete numeric,
  earned_hrs       numeric,
  earned_qty       numeric,
  actual_hrs       numeric,
  actual_qty       numeric,
  primary key (snapshot_id, progress_item_id)
);
```

All migrations land as one ordered set so RLS, RPCs, and frontend can be cut over together. Weight changes apply going-forward only — historical snapshots are frozen with the composite they were written with (achieved by storing a `composite_pct` on `period_snapshots` at write time).

---

## 5. Feature specs

### 5.1 Disciplines: 4 → 6

- Seed Mechanical and Instrumentation; align names (Pipe, Steel) with demo.
- Frontend: drive every discipline filter pill / dropdown from the `disciplines` table — no enums.

### 5.2 Foreman (hybrid)

- Imports always populate `foreman_name` from the audit file (raw).
- Matcher resolves `foreman_name` → `foreman_user_id` via:
  1. Direct match on user's display name.
  2. Lookup in `foreman_aliases`.
- Unmatched rows leave `foreman_user_id` NULL but keep `foreman_name`.
- New **Admin → Foreman Reconciliation** panel: lists unmatched names with row counts and actions: *Link to existing user*, *Create new user (member, project-scoped)*, *Mark as external*. Linking writes a `foreman_aliases` row and backfills affected items.
- "By Foreman" grouping uses `foreman_user_id` if present, otherwise `foreman_name` — feature works on day one even before reconciliation.

### 5.3 Earned QTY

**Per-row unit; one unit per discipline by convention.**

- New columns on `progress_items`: `unit`, `budget_qty`, `actual_qty`, generated `earned_qty`.
- Imports validate that incoming rows match the discipline's existing unit (warn + reject mismatches).
- If a discipline genuinely needs mixed units (e.g., Mechanical = pumps EA + pipe LF), split into two disciplines.

**Where qty appears:**

| Surface | Qty shown? |
|---|---|
| Discipline Progress page | ✓ per-discipline KPI |
| Audits filtered to one discipline | ✓ |
| Period Tracking with discipline filter active | ✓ |
| Executive Overview | composite % only (see §5.3.1) |
| Project EV table | hours only |
| Audits with "All disciplines" | qty column hidden / "—" |

**5.3.1 Cross-discipline composite %**

Project-level qty rollup expressed as a 0–100% number (units cancel).

- `pct_qty_i = sum(earned_qty) / sum(budget_qty)` per discipline.
- `composite_pct = Σ (weight_i × pct_qty_i)`.
- Modes: `hours_weighted` (default, weight = budget_hrs share), `equal` (1/N), `custom` (PM-defined, must sum to 1.0).
- New RPC `get_project_qty_rollup(p_id)` returns mode, composite, and per-discipline contributions.
- Surfaces as a KPI card on Executive Overview labeled with active mode; tooltip lists per-discipline contributions.
- Settings UI: **Project Settings → Qty Rollup tab** with mode radio + editable weights table (enabled only when `mode = custom`); live "Sum: 100%" validator.

### 5.4 Period Tracking page rebuild

Replace [Periods.tsx](frontend/src/pages/Periods.tsx) entirely.

**Controls (top of page):**
- Current period dropdown (defaults to most recent snapshot)
- Previous period dropdown (defaults to prior snapshot)
- Custom date range pickers + "Apply Range" button (alternative to dropdowns)
- Discipline filter pills: All / Civil / Pipe / Steel / Electrical / Mechanical / Instrumentation
- Grouping toggle: No Grouping | By IWP | By Foreman

**Comparison table columns:**
Discipline | IWP | DWG | Description | Prev % | Curr % | Δ% | Prev Hrs | Curr Hrs | ΔHrs | Movement

**Summary badges:** ▲ Items That Progressed (n) · ▬ Items With No Movement (n)

**Backend:**
```sql
get_period_comparison(
  p_id          uuid,
  prev_snap_id  uuid,
  curr_snap_id  uuid,
  discipline_id uuid default null,
  group_by      text default null  -- 'iwp' | 'foreman' | null
) returns setof <comparison row>;
```
Joins `period_snapshot_items` for prev and curr, joins `progress_items` for description/dwg, applies discipline filter, returns rows sorted appropriately for grouping.

**Movement indicator:** sign of Δ% (▲ for >0, ▬ for =0; negative theoretically possible from corrections — render in a warning color).

### 5.5 Weekly Snapshot upload

Replace [Upload.tsx](frontend/src/pages/Upload.tsx).

**Form:**
- "Week Ending (Sunday)" date input — defaults to most recent Sunday.
- Optional snapshot label.
- Drop zone + browse — accepts multiple `.xlsx` files in one submission.
- Per-file audit-type dropdown (Civil / Pipe / Steel / Electrical / Mechanical / Instrumentation Audit). Filename pattern is a hint, not authoritative.
- "Save Snapshot" commits all files atomically.

**Saved Snapshots panel:**
List of past snapshots with date, label, record count, kind (weekly / 1st-audit), uploader. Empty state: "No snapshots yet."

**Edge function `import-progress-data`:**
- Accept payload `[{file, audit_type}]` plus `week_ending`, `label`, `project_id`.
- Add xlsx parsing (e.g., `xlsx` npm package).
- Per file: validate audit_type maps to a discipline; upsert rows into `progress_items`; collect ids for snapshot.
- After upload commits: write `period_snapshots` (kind=`weekly`) + `period_snapshot_items`. If this is the project's first snapshot, ALSO write a `baseline_first_audit` snapshot with the same items.
- Return per-file row counts and any reconciliation warnings (unmatched foreman names, unit mismatches).

**New RPC `list_snapshots(p_id)`** for the history panel.

### 5.6 Audits page hierarchy

[Audits.tsx](frontend/src/pages/Audits.tsx) — convert flat table to grouped accordions: Discipline → IWP → items.

- Per-discipline quick-filter buttons at top (matches demo's "Civil Audit / Pipe Audit / …" affordance).
- "Expand All" / "Collapse All" controls.
- Optional new RPC `get_audit_tree(p_id, discipline_filter)` if client-side grouping over many rows is slow; v1 can group client-side.

### 5.7 Baseline (dual)

Two distinct baselines, both rendered on charts with explicit labels.

| Baseline | Source | Frozen at |
|---|---|---|
| **Baseline – Planned** | `projects.planned_start/end` + `progress_items.budget_hrs/qty` | Project setup |
| **Baseline – 1st Audit** | First `weekly` snapshot of the project | First successful upload |

**S-curve (4 lines):**
1. Baseline – Planned (dashed)
2. Baseline – 1st Audit (faint solid)
3. Earned (EV)
4. Actual (AC)
Legend toggles per line.

**Variance metrics:**
- Schedule Variance = Earned − Planned (existing)
- Drift from 1st Audit = Earned − 1st Audit Earned (new — per period and per item; surfaces as a column on the Period comparison table)

**Capture:** automatic on first successful upload.
**Reset:** "Reset 1st-Audit Baseline" admin action (tenant_admin or project admin) on Project Settings → Baseline. Confirmation modal because every chart shifts.

**Upload page status line:** mirrors demo: "Baseline – 1st Audit: N records across M disciplines" or empty-state copy if not yet set.

### 5.8 Multi-project access

- After login, call `list_my_projects()`:
  - 0 → empty state ("No projects assigned — contact your admin").
  - 1 → auto-route to that project's overview.
  - 2+ → project picker landing page.
- All routes scoped under `/p/:projectId/...` — bookmarkable, sharable, the React Query cache key.
- Top nav shows current project name with switcher dropdown.
- Project Settings page at `/p/:projectId/settings` (tabs: General, Members, Qty Rollup, Baseline) — visible to tenant_admin and project admins.

### 5.9 Discipline Progress page

New route `/p/:projectId/discipline-progress`. Per-discipline cards showing:
- budget vs earned vs actual hours
- budget vs earned vs actual qty (with unit)
- completion %
- item count
- per-discipline S-curve

Existing `get_discipline_metrics()` covers most fields after the qty additions; new `get_discipline_curve(p_id, discipline_id)` for per-discipline trend.

### 5.10 xlsx support

Transversal requirement. Drives §5.5 edge function. `import-progress-data/parser.ts` becomes parser-per-format with shared validation.

---

## 6. RPC catalog

**New:**
- `user_can_access_project(p_id)` — auth helper
- `list_my_projects()` — projects current user can see
- `list_snapshots(p_id)` — snapshot history
- `get_period_comparison(p_id, prev, curr, discipline?, group_by?)` — per-row diff
- `get_project_qty_rollup(p_id)` — composite qty %
- `get_discipline_curve(p_id, discipline_id)` — per-discipline trend
- `admin_list_project_members(p_id)`
- `admin_add_project_member(target_user_id, p_id, role)`
- `admin_remove_project_member(target_user_id, p_id)`
- `admin_set_project_member_role(target_user_id, p_id, role)`
- `admin_reset_first_audit_baseline(p_id)`
- `admin_set_qty_rollup(p_id, mode, weights jsonb)` — validates weights sum to 1.0 in custom mode

**Modified:**
- `get_project_metrics(p_id)` — add `composite_pct_qty` field; add access guard
- `get_discipline_metrics(p_id)` — add `unit`, `budget_qty`, `earned_qty`, `actual_qty`, `pct_qty`; add access guard
- `create_period_snapshot(p_id, label)` — also writes `period_snapshot_items`; on first call for a project also writes `baseline_first_audit`; freezes `composite_pct`
- `admin_create_user(email, password, role)` — accept optional `project_ids[]` for immediate assignment

---

## 7. Frontend route map (post-change)

```
/login
/forgot-password
/reset-password
/                            → project picker (or auto-redirect if 1 project)
/admin                       → tenant_admin only: user CRUD, foreman reconciliation
/p/:projectId/
  overview                   → executive KPIs + S-curve (4 lines) + composite qty %
  ev                         → earned-value table
  audits                     → expandable hierarchy
  discipline-progress        → NEW: per-discipline cards + curves
  periods                    → REBUILT: period comparison + grouping
  upload                     → REBUILT: weekly snapshot, multi-file xlsx, history
  settings/                  → tenant_admin + project admin only
    general                  → name, dates
    members                  → project_members CRUD
    qty-rollup               → mode + weights
    baseline                 → reset 1st-audit baseline
```

---

## 8. UI surface changes by page

| Page | Change |
|---|---|
| Login | unchanged |
| Project Picker | NEW — list of projects user can access |
| Top nav | + project switcher dropdown |
| Executive Overview | + Composite % (qty) KPI; S-curve gains 4th line (1st Audit); discipline pills include Mechanical + Instrumentation |
| EV table | unchanged shape; access guard added |
| Audits | flat → grouped accordions; per-discipline quick filters; Expand/Collapse All |
| Discipline Progress | NEW page |
| Periods | REBUILT — see §5.4 |
| Upload | REBUILT — see §5.5 |
| Project Settings | NEW — General / Members / Qty Rollup / Baseline tabs |
| Admin Hub | + Foreman Reconciliation panel; user creation gains optional project assignments; per-user "Projects" column |

---

## 9. Migration / backfill plan

1. Schema migration bundle (§4) — single migration file.
2. Backfill script (post-migration):
   - `app_users.role`: `admin` → `tenant_admin`, `viewer` → `member`.
   - For each `member`: insert `project_members` row (role=`viewer`) for every project in their tenant.
   - Seed Mechanical + Instrumentation disciplines.
   - Set `progress_items.unit = 'HRS'` placeholder (or import-time backfill if real units are available).
3. RPC redeployment with access guards.
4. Frontend cutover — must ship with backend (route restructure is breaking).

Single-shot deploy. No partial cutover; URL scheme change makes feature flagging awkward.

---

## 10. Suggested sequencing

| Phase | Includes | Why first/last |
|---|---|---|
| **1. Foundations** | §3 access model · §4 full migration · RPC guards · backfill | Unblocks everything; must ship as one bundle |
| **2. Project routing & admin** | §5.8 multi-project picker + URL routing · Project Settings page (Members tab) · admin RPCs · Admin Hub project assignments | Makes onboarding non-admins possible before any feature work |
| **3. Ingestion** | §5.5 weekly upload rebuild · §5.10 xlsx · §5.7 baseline 1st-audit auto-capture · §5.2 foreman matcher (basic) | Without this, no realistic data to populate the new pages |
| **4. Period rebuild** | §5.4 period comparison · per-item snapshot RPCs | Highest-value single user-facing feature; needs §3 + #5 |
| **5. Page work** | §5.6 Audits hierarchy · §5.9 Discipline Progress page · S-curve 4th line · §5.3.1 composite % KPI · qty rollup settings | Mostly frontend; low schema risk |
| **6. Polish** | Foreman Reconciliation UI · baseline reset action · variance vs 1st-audit columns | Quality-of-life after the core works |

---

## 11. Out of scope / deferred

- **Foreman-scoped RLS** (foreman only sees their own items). Easy to add later via `user_can_access_project` extension; not required for parity.
- **Per-discipline mixed units** (grouped rollup). Convention: split into two disciplines.
- **Custom planned curves** (non-linear PV between start/end). Default to linear interpolation; add `planned_periods` table only if requested.
- **Recompute history on weight change.** Snapshots are frozen at write time; weight changes apply going-forward only.
- **Promote arbitrary past snapshot to baseline.** Auto-capture on first upload; manual override is "Reset 1st-Audit Baseline" only.

---

## 12. Resolved decisions log

For traceability — every decision baked into this spec:

1. ✅ **Earned QTY units**: per-row, one unit per discipline by convention.
2. ✅ **Cross-discipline qty rollup**: composite % (not summed qty); default mode `hours_weighted`; equal/custom available.
3. ✅ **Weight changes vs history**: going-forward only; snapshots freeze their composite at write time.
4. ✅ **Baseline**: dual — Planned + 1st Audit, both labeled on charts.
5. ✅ **1st-audit capture**: automatic on first upload; admin reset action available.
6. ✅ **Multi-file ingest**: explicit per-file audit-type picker.
7. ✅ **Snapshot granularity**: per-item rows (`period_snapshot_items`).
8. ✅ **Foreman model**: hybrid (`foreman_user_id` + `foreman_name` + `foreman_aliases`) with reconciliation UI.
9. ✅ **Project-level admin role**: ships from day one with capability matrix.
10. ✅ **Project URL scheme**: `/p/:projectId/...` path segment.
