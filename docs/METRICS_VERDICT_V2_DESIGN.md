# SeqPulse Metrics Verdict v2 (Percentile-First)

## Purpose
This document defines the updated post-deployment metrics analysis for SeqPulse.
The goal is to increase verdict reliability while keeping the current sampling cadence
(sequences with fixed periods) and preserving existing pipeline endpoints.

Key goals:
- Reduce false positives/negatives caused by sparse sampling or traffic gaps.
- Make the verdict more robust by using percentiles and tolerances instead of averages.
- Keep the logic transparent, deterministic, and O(n).

## Current Pipeline (Unchanged)
- During deployment: pipeline calls `POST /trigger`.
  - SeqPulse captures **baseline PRE** metrics (snapshot per metric).
- After deployment: pipeline calls `POST /finish`.
  - SeqPulse collects **POST** metrics in fixed sequences (e.g., 60s per sequence)
    over the project observation window.

Only the **analysis logic** changes.

## Definitions
- **Sequence**: One aggregated point per fixed period (e.g., 60s), built from
  multiple scrapes (e.g., 10s scrape => 6 points aggregated into one sequence value).
- **Baseline PRE**: Snapshot metric values captured during `/trigger`.
- **Industrial threshold**: Industry reference threshold per metric.
- **Secured threshold**: `industrial_threshold × 0.9`.
- **Tolerance**: Maximum percentage of sequences allowed to exceed the secured threshold.

## Metrics and Percentiles
Use the following percentile for each metric in POST analysis:
- `latency` -> p95
- `error_rate` -> p99
- `cpu_usage` -> p95
- `memory_usage` -> p99
- `requests_per_sec` -> p95

## Secured Thresholds (x0.9 Rule)
Apply the rule: `secured_threshold = industrial_threshold × 0.9`.

Examples:
- latency: 300ms -> 270ms
- cpu_usage: 80% -> 72%
- memory_usage: 80% -> 72%
- error_rate: 1% -> 0.8%

## Tolerances (Max Exceed Ratio)
A metric passes if the ratio of sequences that exceed the secured threshold
is less than or equal to its tolerance.

- latency(p95) <= 20%
- error_rate(p99) <= 5%
- cpu_usage(p95) <= 20%
- memory_usage(p99) <= 10%
- requests_per_sec(p95) <= 20%

## Special Case: requests_per_sec (Two Thresholds)
We separate **severity** of a drop from **persistence**.

Inputs:
- `baseline_pre` (snapshot at /trigger)
- `seq_value` (per sequence)

Calculations per sequence:
- `drop = (baseline_pre - seq_value) / baseline_pre`

Rules:
- **Drop severity threshold**: `drop > 20%` marks this sequence as bad.
- **Persistence tolerance**: max 20% of sequences can be bad.

This prevents mixing “how bad” a drop is with “how long it lasts.”

## Decision Rules
For each metric `m`:

1. Compute secured threshold:
   - `secured_threshold[m] = industrial_threshold[m] * 0.9`

2. For each sequence value `seq_values[m][i]`:
   - If `m != requests_per_sec`:
     - `exceed_i = seq_values[m][i] > secured_threshold[m]`
   - If `m == requests_per_sec`:
     - `drop_i = (baseline_pre[m] - seq_values[m][i]) / baseline_pre[m]`
     - `exceed_i = drop_i > drop_severity_threshold`

3. Compute exceed ratio:
   - `exceed_ratio = count(exceed_i) / total_sequences`

4. Metric verdict:
   - `metric_pass = exceed_ratio <= tolerance[m]`

Final verdict:
- `verdict_pass = ALL(metric_pass)`

If any metric fails its tolerance, final verdict is negative.

## Complexity
- Time: O(n) per metric (n = number of sequences)
- Space: O(1) or O(n) depending on streaming vs in-memory sequence handling

## NFR Compliance
- Performance: verdict < 1s after observation window completes; SDH < 200ms
- Scale: 1000 projects, 100 metrics/project, O(n) analysis
- Security: avoid long-term storage of raw metrics; per-project tokens; tenant isolation
- Reliability: verdict is idempotent and retry-safe
- Ownership: thresholds configurable later; backward compatible

## Edge Cases
- Baseline PRE is zero for `requests_per_sec`:
  - Define drop as 0 (or mark metric as “insufficient baseline”) to avoid division by zero.
- Low/no traffic during observation:
  - Requests_per_sec may legitimately be low; tolerance logic prevents single blips
    from invalidating the verdict.
- Missing sequences:
  - If sequence count is too low, surface “insufficient data” rather than force a verdict.

## Pseudocode
```pseudo
for each metric m:
  secured_threshold[m] = industrial_threshold[m] * 0.9

for each metric m:
  exceed_count = 0
  total = number_of_sequences

  for i in 1..total:
    if m != requests_per_sec:
      exceed_i = seq_values[m][i] > secured_threshold[m]
    else:
      drop = (baseline_pre[m] - seq_values[m][i]) / baseline_pre[m]
      exceed_i = drop > 0.20

    if exceed_i:
      exceed_count += 1

  exceed_ratio = exceed_count / total

  if m == requests_per_sec:
    metric_pass = exceed_ratio <= 0.20
  else:
    metric_pass = exceed_ratio <= tolerance[m]

final_verdict = ALL(metric_pass)
```

## Implementation Notes
- The analysis should run after observation window closes (end of /finish workflow).
- The SDH generation happens immediately after verdict, without persisting raw metrics.
- Keep current API surface (`/trigger`, `/finish`) unchanged.
- Store only summary aggregates needed for audit/debug, not raw sequences, unless configured.

## Future Extensions (Out of Scope)
- Dynamic thresholds per project
- Adaptive sampling
- Multi-window trend analysis
- Weighted score or composite health indices
