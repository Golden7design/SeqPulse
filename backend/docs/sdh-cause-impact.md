# SDH Cause vs Impact (Future V2/V3)

## Why Split Cause and Impact?
Today, SDH hints mix technical causes with user/business impact in a single diagnosis.
Splitting them improves clarity and UI presentation:
- **Cause**: what the system thinks is happening technically
- **Impact**: how users/business are affected

## Suggested Fields (Future)
Add to `sdh_hints`:
- `cause_hypothesis` (text)
- `impact` (text)
- Optional: `evidence` (array of strings)

Example payload:
```json
{
  "metric": "composite",
  "severity": "critical",
  "cause_hypothesis": "CPU saturation causing request queuing",
  "impact": "Users may experience slow responses or timeouts",
  "evidence": [
    "latency_p95 > threshold",
    "cpu_usage > threshold",
    "error_rate increased"
  ]
}
```

## UI Ideas
- Two blocks: "Likely Cause" and "User Impact"
- Optional evidence badges below

## Migration Sketch (Later)
1. Add nullable columns: `cause_hypothesis`, `impact`, `evidence`
2. Backfill from current `diagnosis` if needed
3. Update API + frontend to display separately
