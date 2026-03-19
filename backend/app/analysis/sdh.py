from datetime import datetime
from typing import Dict, List, Optional, Set

from sqlalchemy.orm import Session

from app.analysis.constants import INDUSTRIAL_THRESHOLDS, MIN_TRAFFIC_THRESHOLD
from app.db.models.deployment import Deployment
from app.db.models.sdh_hint import SDHHint


def generate_sdh_hints(
    db: Session,
    deployment: Deployment,
    pre_agg: Dict[str, float],
    post_agg: Dict[str, float],
    created_at: datetime,
    metrics_audit: Optional[Dict[str, Dict[str, float]]] = None,
) -> List[SDHHint]:
    _ = (
        db.query(SDHHint)
        .filter(SDHHint.deployment_id == deployment.id)
        .delete(synchronize_session=False)
    )

    hints: List[SDHHint] = []
    suppressed_metrics: Set[str] = set()
    audited_metrics = set((metrics_audit or {}).keys())
    metric_labels = {
        "latency_p95": "latency p95",
        "error_rate": "error rate",
        "cpu_usage": "CPU usage",
        "memory_usage": "memory usage",
        "requests_per_sec": "traffic",
    }

    def _deviation_above_threshold(observed: float, threshold: float) -> float:
        if threshold <= 0:
            return 0.0
        return max(0.0, (observed - threshold) / threshold)

    def _deviation_below_baseline(baseline: float, observed: float) -> float:
        if baseline <= 0:
            return 0.0
        return max(0.0, (baseline - observed) / baseline)

    def _confidence_from_deviation(severity: str, deviation: float, signals: int = 1) -> float:
        base = {
            "info": 0.45,
            "warning": 0.55,
            "critical": 0.7,
        }.get(severity, 0.5)

        if deviation >= 1.0:
            base += 0.2
        elif deviation >= 0.5:
            base += 0.15
        elif deviation >= 0.3:
            base += 0.1
        elif deviation >= 0.1:
            base += 0.05

        if signals >= 2:
            base += 0.08
        if signals >= 3:
            base += 0.05

        return round(min(0.95, base), 2)

    def _ratio_deviation(exceed_ratio: Optional[float], tolerance: Optional[float]) -> float:
        if exceed_ratio is None or tolerance is None or tolerance <= 0:
            return 0.0
        return max(0.0, (exceed_ratio - tolerance) / tolerance)

    def add_hint(
        metric: str,
        severity: str,
        observed_value: Optional[float],
        threshold: Optional[float],
        confidence: float,
        title: str,
        diagnosis: str,
        suggested_actions: List[str],
        audit_metrics: Optional[List[str]] = None,
    ) -> None:
        audit = metrics_audit.get(metric, {}) if metrics_audit else {}
        selected_audit_metrics = audit_metrics if audit_metrics is not None else [metric]
        audit_payload = (
            {
                key: value
                for key, value in (metrics_audit or {}).items()
                if key in selected_audit_metrics
            }
            or None
        )
        hints.append(
            SDHHint(
                deployment_id=deployment.id,
                metric=metric,
                severity=severity,
                observed_value=observed_value,
                threshold=threshold,
                secured_threshold=audit.get("secured_threshold"),
                exceed_ratio=audit.get("exceed_ratio"),
                tolerance=audit.get("tolerance"),
                audit_data=audit_payload,
                confidence=confidence,
                title=title,
                diagnosis=diagnosis,
                suggested_actions=suggested_actions,
                created_at=created_at,
            )
        )

    error_threshold = INDUSTRIAL_THRESHOLDS["error_rate"]
    latency_threshold = INDUSTRIAL_THRESHOLDS["latency_p95"]
    cpu_threshold = INDUSTRIAL_THRESHOLDS["cpu_usage"]
    memory_threshold = INDUSTRIAL_THRESHOLDS["memory_usage"]
    pre_traffic = pre_agg.get("requests_per_sec", 0.0)

    error_dev = _deviation_above_threshold(post_agg["error_rate"], error_threshold)
    latency_dev = _deviation_above_threshold(post_agg["latency_p95"], latency_threshold)
    cpu_dev = _deviation_above_threshold(post_agg["cpu_usage"], cpu_threshold)
    memory_dev = _deviation_above_threshold(post_agg["memory_usage"], memory_threshold)
    traffic_drop_dev = _deviation_below_baseline(pre_traffic, post_agg["requests_per_sec"])
    audit_failures: Dict[str, Dict[str, float]] = {}
    for metric, audit in (metrics_audit or {}).items():
        exceed_ratio = audit.get("exceed_ratio")
        tolerance = audit.get("tolerance")
        if (
            isinstance(exceed_ratio, (int, float))
            and isinstance(tolerance, (int, float))
            and exceed_ratio > tolerance
        ):
            audit_failures[metric] = audit

    critical_audit_failures = [
        metric for metric in ("error_rate", "requests_per_sec") if metric in audit_failures
    ]
    audit_critical_composite_added = False
    if len(critical_audit_failures) >= 2:
        suppressed_metrics.update(critical_audit_failures)
        worst_deviation = max(
            _ratio_deviation(
                audit_failures[metric].get("exceed_ratio"),
                audit_failures[metric].get("tolerance"),
            )
            for metric in critical_audit_failures
        )
        add_hint(
            metric="composite",
            severity="critical",
            observed_value=None,
            threshold=None,
            confidence=_confidence_from_deviation(
                "critical",
                worst_deviation,
                signals=len(critical_audit_failures),
            ),
            title="Persistent critical threshold breaches detected",
            diagnosis=(
                "Critical metrics are persistently breaching secured thresholds across post-deploy "
                f"sequences ({', '.join(metric_labels[m] for m in critical_audit_failures)})."
            ),
            suggested_actions=[
                "Inspect failing sequences in metrics audit",
                "Check recent release and infrastructure changes",
                "Run targeted rollback checks for impacted paths",
                "Rollback if critical breaches continue",
            ],
            audit_metrics=critical_audit_failures,
        )
        audit_critical_composite_added = True
    elif len(critical_audit_failures) == 1:
        metric = critical_audit_failures[0]
        exceed_ratio = audit_failures[metric].get("exceed_ratio")
        tolerance = audit_failures[metric].get("tolerance")
        secured_threshold = audit_failures[metric].get("secured_threshold")
        deviation = _ratio_deviation(exceed_ratio, tolerance)
        severity = "critical" if deviation >= 1.0 else "warning"
        add_hint(
            metric=metric,
            severity=severity,
            observed_value=post_agg.get(metric),
            threshold=secured_threshold,
            confidence=_confidence_from_deviation(severity, deviation),
            title="Persistent critical threshold breach detected",
            diagnosis=(
                f"{metric_labels[metric].capitalize()} is persistently breaching secured thresholds "
                "across post-deploy sequences."
            ),
            suggested_actions=[
                "Inspect failing sequences in metrics audit",
                "Check recent release and infrastructure changes",
                "Run targeted rollback checks for impacted paths",
                "Rollback if critical breaches continue",
            ],
            audit_metrics=[metric],
        )

    for metric in ("latency_p95", "cpu_usage", "memory_usage"):
        if metric not in audit_failures:
            continue

        suppressed_metrics.add(metric)
        exceed_ratio = audit_failures[metric].get("exceed_ratio")
        tolerance = audit_failures[metric].get("tolerance")
        secured_threshold = audit_failures[metric].get("secured_threshold")
        deviation = _ratio_deviation(exceed_ratio, tolerance)
        severity = "critical" if deviation >= 1.0 else "warning"

        add_hint(
            metric=metric,
            severity=severity,
            observed_value=post_agg.get(metric),
            threshold=secured_threshold,
            confidence=_confidence_from_deviation(severity, deviation),
            title=f"Persistent {metric_labels[metric]} breaches detected",
            diagnosis=(
                f"{metric_labels[metric].capitalize()} exceeded the tolerated breach ratio across "
                "post-deployment sequences."
            ),
            suggested_actions=[
                "Review sequence-level metrics for this deployment",
                "Compare with the PRE baseline and secured threshold",
                "Investigate recent code and config changes",
                "Scale or rollback if persistence remains high",
            ],
            audit_metrics=[metric],
        )

    # Composite diagnostics (multi-metrics)
    if (
        not audit_critical_composite_added
        and not {"error_rate", "latency_p95"}.issubset(audited_metrics)
        and post_agg["error_rate"] > error_threshold
        and post_agg["latency_p95"] > latency_threshold
    ):
        suppressed_metrics.update({"error_rate", "latency_p95"})
        add_hint(
            metric="composite",
            severity="critical",
            observed_value=None,
            threshold=None,
            confidence=_confidence_from_deviation("critical", max(error_dev, latency_dev), signals=2),
            title="Service degradation detected",
            diagnosis=(
                "Both error rate and latency increased after deployment, suggesting a "
                "major service degradation (likely downstream service failure or resource exhaustion)."
            ),
            suggested_actions=[
                "Check application error logs for 5xx errors or exceptions",
                "Verify database connectivity and query performance",
                "Check external API dependencies for timeouts or failures",
                "Review recent code changes for error handling or timeout config",
                "Consider rollback if errors persist after 5 minutes",
            ],
            audit_metrics=["error_rate", "latency_p95"],
        )

    if (
        not audit_critical_composite_added
        and not {"latency_p95", "cpu_usage"}.issubset(audited_metrics)
        and post_agg["latency_p95"] > latency_threshold
        and post_agg["cpu_usage"] > cpu_threshold
    ):
        severity = "critical" if post_agg["latency_p95"] >= latency_threshold * 1.3 else "warning"
        suppressed_metrics.update({"latency_p95", "cpu_usage"})
        add_hint(
            metric="composite",
            severity=severity,
            observed_value=None,
            threshold=None,
            confidence=_confidence_from_deviation(severity, max(latency_dev, cpu_dev), signals=2),
            title="Compute saturation suspected",
            diagnosis=(
                "Latency and CPU usage both increased after deployment, which often "
                "indicates compute saturation, inefficient code, or blocking operations."
            ),
            suggested_actions=[
                "Profile CPU to identify hot methods or loops (N+1 queries, heavy computations)",
                "Check for blocking I/O operations (sync DB calls, external API waits)",
                "Verify connection pool settings are not exhausted",
                "Consider horizontal scaling if CPU is consistently > 80%",
                "Review recent code changes for algorithmic complexity increases",
            ],
            audit_metrics=["latency_p95", "cpu_usage"],
        )

    if (
        not audit_critical_composite_added
        and not {"error_rate", "requests_per_sec"}.issubset(audited_metrics)
        and pre_traffic >= MIN_TRAFFIC_THRESHOLD
        and post_agg["error_rate"] > error_threshold
        and post_agg["requests_per_sec"] < pre_traffic * 0.6
    ):
        suppressed_metrics.update({"error_rate", "requests_per_sec"})
        add_hint(
            metric="composite",
            severity="critical",
            observed_value=None,
            threshold=None,
            confidence=_confidence_from_deviation("critical", max(error_dev, traffic_drop_dev), signals=2),
            title="Partial outage suspected",
            diagnosis=(
                "Error rate increased while traffic dropped significantly after deployment, "
                "suggesting a partial outage, failed health checks, or routing misconfiguration."
            ),
            suggested_actions=[
                "Check load balancer health checks (are instances marked unhealthy?)",
                "Verify ingress/routing rules point to correct service version",
                "Check application startup logs for crash loops or init failures",
                "Validate environment variables and config maps are correctly set",
                "Consider immediate rollback if > 50% traffic impacted",
            ],
            audit_metrics=["error_rate", "requests_per_sec"],
        )

    # Error rate
    if (
        "error_rate" not in audited_metrics
        and post_agg["error_rate"] > error_threshold
        and "error_rate" not in suppressed_metrics
    ):
        add_hint(
            metric="error_rate",
            severity="critical",
            observed_value=post_agg["error_rate"],
            threshold=error_threshold,
            confidence=_confidence_from_deviation("critical", error_dev),
            title="High error rate after deployment",
            diagnosis=(
                "The service is returning an unusually high number of errors after "
                "deployment, indicating a possible application bug, dependency failure, or config issue."
            ),
            suggested_actions=[
                "Check application logs for exceptions (NullPointer, syntax errors, import failures)",
                "Verify database migrations completed successfully",
                "Check external service dependencies (APIs, caches, message queues)",
                "Review environment variables and secrets configuration",
                "Consider rollback if error rate > 10% for more than 2 minutes",
            ],
        )

    # Latency
    if (
        "latency_p95" not in audited_metrics
        and post_agg["latency_p95"] > latency_threshold
        and "latency_p95" not in suppressed_metrics
    ):
        severity = "critical" if post_agg["latency_p95"] >= latency_threshold * 1.3 else "warning"
        add_hint(
            metric="latency_p95",
            severity=severity,
            observed_value=post_agg["latency_p95"],
            threshold=latency_threshold,
            confidence=_confidence_from_deviation(severity, latency_dev),
            title="High latency detected",
            diagnosis=(
                "Response time increased significantly after deployment, which may "
                "indicate slow database queries, external API latency, or resource contention."
            ),
            suggested_actions=[
                "Check database slow query logs for missing indexes or full table scans",
                "Verify external API response times and timeout configurations",
                "Check for memory pressure causing GC pauses or swapping",
                "Enable distributed tracing to identify bottleneck spans",
                "Consider rollback if p95 latency > 2x baseline for 5+ minutes",
            ],
        )
    else:
        pre_latency = pre_agg.get("latency_p95", 0.0)
        if pre_latency > 0 and post_agg["latency_p95"] < pre_latency * 0.8:
            improvement = _deviation_below_baseline(pre_latency, post_agg["latency_p95"])
            add_hint(
                metric="latency_p95",
                severity="info",
                observed_value=post_agg["latency_p95"],
                threshold=latency_threshold,
                confidence=_confidence_from_deviation("info", improvement),
                title="Latency improved after deployment",
                diagnosis=(
                    "Response time decreased after deployment, indicating successful "
                    "performance optimizations in the new version."
                ),
                suggested_actions=[
                    "Document the optimizations made",
                    "Continue monitoring performance trends",
                    "Share best practices with other teams",
                ],
            )

    # CPU usage
    if (
        "cpu_usage" not in audited_metrics
        and post_agg["cpu_usage"] > cpu_threshold
        and "cpu_usage" not in suppressed_metrics
    ):
        severity = "critical" if post_agg["cpu_usage"] >= cpu_threshold * 1.2 else "warning"
        add_hint(
            metric="cpu_usage",
            severity=severity,
            observed_value=post_agg["cpu_usage"],
            threshold=cpu_threshold,
            confidence=_confidence_from_deviation(severity, cpu_dev),
            title="CPU usage spike detected",
            diagnosis=(
                "CPU consumption increased significantly after deployment, which may "
                "indicate inefficient algorithms, infinite loops, or increased computational load."
            ),
            suggested_actions=[
                "Profile CPU to identify top consuming methods or endpoints",
                "Check for N+1 query problems or unoptimized database access patterns",
                "Look for infinite loops or recursive calls without termination",
                "Verify no crypto mining or unauthorized processes running",
                "Consider horizontal scaling if legitimate load increase",
            ],
        )

    # Memory usage
    if (
        "memory_usage" not in audited_metrics
        and post_agg["memory_usage"] > memory_threshold
        and "memory_usage" not in suppressed_metrics
    ):
        severity = "critical" if post_agg["memory_usage"] >= memory_threshold * 1.1 else "warning"
        add_hint(
            metric="memory_usage",
            severity=severity,
            observed_value=post_agg["memory_usage"],
            threshold=memory_threshold,
            confidence=_confidence_from_deviation(severity, memory_dev),
            title="Memory usage above threshold",
            diagnosis=(
                "Memory consumption exceeded the configured threshold, suggesting a "
                "possible memory leak, unbounded caching, or insufficient heap size."
            ),
            suggested_actions=[
                "Check heap dumps for growing object types (caches, unclosed connections)",
                "Monitor garbage collection frequency and pause times",
                "Review recent changes for unbounded data structures or large object retention",
                "Check for connection leaks (DB, HTTP, file handles not closed)",
                "Consider increasing memory limits or implementing cache eviction policies",
            ],
        )
    elif (
        "memory_usage" not in audited_metrics
        and post_agg["memory_usage"] >= memory_threshold * 0.9
        and "memory_usage" not in suppressed_metrics
    ):
        approaching = (post_agg["memory_usage"] - memory_threshold * 0.9) / (memory_threshold * 0.1)
        add_hint(
            metric="memory_usage",
            severity="warning",
            observed_value=post_agg["memory_usage"],
            threshold=memory_threshold,
            confidence=_confidence_from_deviation("warning", max(0.0, approaching)),
            title="Memory usage approaching threshold",
            diagnosis=(
                "Memory consumption increased after deployment and is approaching "
                "critical limits, which may impact service stability."
            ),
            suggested_actions=[
                "Check heap and memory allocation",
                "Review recent code changes",
                "Monitor garbage collection activity",
                "Ensure memory limits are correctly set",
            ],
        )
    elif (
        "memory_usage" not in audited_metrics
        and post_agg["memory_usage"] <= memory_threshold * 0.8
        and "memory_usage" not in suppressed_metrics
    ):
        add_hint(
            metric="memory_usage",
            severity="info",
            observed_value=post_agg["memory_usage"],
            threshold=memory_threshold,
            confidence=_confidence_from_deviation("info", 0.0),
            title="Memory usage within normal range",
            diagnosis=(
                "Memory consumption is stable and well below the configured "
                "threshold, indicating healthy resource utilization after deployment."
            ),
            suggested_actions=[
                "Continue monitoring memory trends",
                "No immediate action required",
                "Consider optimization if usage trends upward",
            ],
        )

    # Traffic drop
    if "requests_per_sec" not in audited_metrics and pre_traffic >= MIN_TRAFFIC_THRESHOLD:
        if post_agg["requests_per_sec"] < pre_traffic * 0.6 and "requests_per_sec" not in suppressed_metrics:
            add_hint(
                metric="requests_per_sec",
                severity="warning",
                observed_value=post_agg["requests_per_sec"],
                threshold=pre_traffic,
                confidence=_confidence_from_deviation("warning", traffic_drop_dev),
                title="Traffic lower than baseline after deployment",
                diagnosis=(
                    "Post-deployment traffic is significantly lower compared to the "
                    "pre-deployment baseline, while no strong error or latency "
                    "increase was detected."
                ),
                suggested_actions=[
                    "Compare traffic with previous time periods",
                    "Check ingress or routing configuration",
                    "Verify main endpoints availability",
                    "Monitor error rate and latency for further signals",
                ],
            )

    if critical_audit_failures and not any(hint.severity == "critical" for hint in hints):
        add_hint(
            metric="composite",
            severity="critical",
            observed_value=None,
            threshold=None,
            confidence=0.85,
            title="Critical verdict requires investigation",
            diagnosis=(
                "Critical persistent breaches were detected by metrics audit but no critical "
                "diagnostic hint was generated."
            ),
            suggested_actions=[
                "Inspect metrics audit details for this deployment",
                "Correlate failing metrics with logs/traces",
                "Validate rollback readiness",
            ],
            audit_metrics=critical_audit_failures,
        )

    if hints:
        db.add_all(hints)

    return hints
