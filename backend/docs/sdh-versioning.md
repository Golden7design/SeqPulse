# SDH Versioning (Future Adaptation)

## Current Behavior
- On each analysis run, existing SDH hints for the deployment are deleted and regenerated.
- This keeps SDH consistent with the latest metrics, but loses history.

## Goal: Keep SDH History Per Analysis Run
To support versioning later, introduce an "analysis run" entity and attach SDH (and verdicts) to it.

### Suggested Schema Changes
1. Create `analysis_runs`
   - `id` (UUID, PK)
   - `deployment_id` (UUID, FK)
   - `created_at` (timestamp)
   - `source` (string, optional: `scheduled`, `manual`, `replay`)
   - `config_version` (string, optional: thresholds or ruleset version)

2. Update `sdh_hints`
   - Add `analysis_run_id` (UUID, FK -> `analysis_runs.id`)
   - Add index on `(analysis_run_id)`
   - Optional unique constraint on `(analysis_run_id, metric)`

3. Update `deployment_verdicts`
   - Add `analysis_run_id` (UUID, FK -> `analysis_runs.id`)
   - Optional unique constraint on `(analysis_run_id)`

### API Behavior (Suggested)
- Default: return hints from the latest `analysis_run` per deployment.
- Allow `analysis_run_id` filter to fetch history.
- Add endpoint `GET /sdh/runs?deployment_id=...` to list runs.

### Implementation Notes
- In `analyze_deployment`, create an `analysis_run` row first, then attach all SDH + verdicts to it.
- If you want to keep existing behavior as default, keep the API returning only the most recent run.

## Migration Plan (Later)
1. Add `analysis_runs` table.
2. Add `analysis_run_id` columns to `sdh_hints` + `deployment_verdicts` (nullable).
3. Backfill: create one run per deployment with existing hints.
4. Make `analysis_run_id` non-null after backfill.
