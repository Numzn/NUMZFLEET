-- One NUMZFLEET company = exactly one dedicated Traccar group, and no Traccar
-- group is ever shared by two companies (docs/TENANCY_ARCHITECTURE.md §2).
--
-- companies.traccar_group_id already expressed "one group per company" by being
-- a single column, but nothing stopped two company rows from pointing at the
-- SAME group — which would put two companies' devices behind one group's
-- permissions and break the isolation the group model exists to provide.
-- ensureCompanyTraccarGroup now refuses a contested id at the application
-- level; this makes it impossible at the storage level too.
--
-- Partial index because traccar_group_id is legitimately NULL for a company
-- that has not been provisioned into Traccar yet, and Postgres treats NULLs as
-- distinct in a plain unique constraint anyway.
--
-- Safe to apply: verified no duplicate non-null traccar_group_id values exist
-- in dev or production (production holds exactly group 1 = default fleet and
-- group 2 = I-TRACK). Re-runnable.

CREATE UNIQUE INDEX IF NOT EXISTS companies_traccar_group_id_unique
  ON companies (traccar_group_id)
  WHERE traccar_group_id IS NOT NULL;
