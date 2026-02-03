from datetime import datetime
from typing import Dict, List, Optional, Set

from sqlalchemy.orm import Session

from app.analysis.constants import ABSOLUTE_THRESHOLDS, MIN_TRAFFIC_THRESHOLD
from app.db.models.deployment import Deployment
from app.db.models.sdh_hint import SDHHint


def generate_sdh_hints(
    db: Session,
    deployment: Deployment,
    pre_agg: Dict[str, float],
    post_agg: Dict[str, float],
    created_at: datetime,
) -> List[SDHHint]:
    deleted = (
        db.query(SDHHint)
        .filter(SDHHint.deployment_id == deployment.id)
        .delete(synchronize_session=False)
    )

    hints: List[SDHHint] = []
    suppressed_metrics: Set[str] = set()

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

    def add_hint(
        metric: str,
        severity: str,
        observed_value: Optional[float],
        threshold: Optional[float],
        confidence: float,
        title: str,
        diagnosis: str,
        suggested_actions: List[str],
    ) -> None:
        hints.append(
            SDHHint(
                deployment_id=deployment.id,
                metric=metric,
                severity=severity,
                observed_value=observed_value,
                threshold=threshold,
                confidence=confidence,
                title=title,
                diagnosis=diagnosis,
                suggested_actions=suggested_actions,
                created_at=created_at,
            )
        )

    error_threshold = ABSOLUTE_THRESHOLDS["error_rate"]
    latency_threshold = ABSOLUTE_THRESHOLDS["latency_p95"]
    cpu_threshold = ABSOLUTE_THRESHOLDS["cpu_usage"]
    memory_threshold = ABSOLUTE_THRESHOLDS["memory_usage"]
    pre_traffic = pre_agg.get("requests_per_sec", 0.0)

    error_dev = _deviation_above_threshold(post_agg["error_rate"], error_threshold)
    latency_dev = _deviation_above_threshold(post_agg["latency_p95"], latency_threshold)
    cpu_dev = _deviation_above_threshold(post_agg["cpu_usage"], cpu_threshold)
    memory_dev = _deviation_above_threshold(post_agg["memory_usage"], memory_threshold)
    traffic_drop_dev = _deviation_below_baseline(pre_traffic, post_agg["requests_per_sec"])

    # Composite diagnostics (multi-metrics)
    if post_agg["error_rate"] > error_threshold and post_agg["latency_p95"] > latency_threshold:
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
                "major service degradation."
            ),
            suggested_actions=[
                "Inspect error logs and traces",
                "Check upstream dependencies",
                "Validate recent configuration or code changes",
                "Consider rollback if degradation persists",
            ],
        )

    if post_agg["latency_p95"] > latency_threshold and post_agg["cpu_usage"] > cpu_threshold:
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
                "indicates compute saturation or inefficient code paths."
            ),
            suggested_actions=[
                "Profile CPU usage and hot paths",
                "Inspect slow endpoints and traces",
                "Consider horizontal scaling",
                "Review recent changes for inefficiencies",
            ],
        )

    if (
        pre_traffic >= MIN_TRAFFIC_THRESHOLD
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
                "suggesting a partial outage or failed routing."
            ),
            suggested_actions=[
                "Verify ingress, routing, and load balancer health",
                "Check error logs for failing endpoints",
                "Validate recent deployment configuration",
                "Consider rollback if recovery is slow",
            ],
        )

    # Error rate
    if post_agg["error_rate"] > error_threshold and "error_rate" not in suppressed_metrics:
        add_hint(
            metric="error_rate",
            severity="critical",
            observed_value=post_agg["error_rate"],
            threshold=error_threshold,
            confidence=_confidence_from_deviation("critical", error_dev),
            title="High error rate after deployment",
            diagnosis=(
                "The service is returning an unusually high number of errors after "
                "deployment, indicating a possible application or dependency failure."
            ),
            suggested_actions=[
                "Inspect application error logs",
                "Check database connectivity",
                "Review recent configuration or code changes",
                "Consider rollback if errors persist",
            ],
        )

    # Latency
    if post_agg["latency_p95"] > latency_threshold and "latency_p95" not in suppressed_metrics:
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
                "indicate slow dependencies or resource contention."
            ),
            suggested_actions=[
                "Check upstream dependencies",
                "Inspect slow queries or external API calls",
                "Enable request tracing",
                "Consider rollback if latency remains high",
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
    if post_agg["cpu_usage"] > cpu_threshold and "cpu_usage" not in suppressed_metrics:
        severity = "critical" if post_agg["cpu_usage"] >= cpu_threshold * 1.2 else "warning"
        add_hint(
            metric="cpu_usage",
            severity=severity,
            observed_value=post_agg["cpu_usage"],
            threshold=cpu_threshold,
            confidence=_confidence_from_deviation(severity, cpu_dev),
            title="CPU usage spike detected",
            diagnosis=(
                "CPU consumption increased significantly after deployment and is "
                "trending upward, which may lead to performance degradation."
            ),
            suggested_actions=[
                "Profile CPU usage patterns",
                "Review recent code changes for inefficiencies",
                "Optimize hot paths in the code",
                "Consider horizontal scaling",
            ],
        )

    # Memory usage
    if post_agg["memory_usage"] > memory_threshold and "memory_usage" not in suppressed_metrics:
        severity = "critical" if post_agg["memory_usage"] >= memory_threshold * 1.1 else "warning"
        add_hint(
            metric="memory_usage",
            severity=severity,
            observed_value=post_agg["memory_usage"],
            threshold=memory_threshold,
            confidence=_confidence_from_deviation(severity, memory_dev),
            title="Memory usage above threshold",
            diagnosis=(
                "Memory consumption exceeded the configured threshold, which may "
                "impact service stability."
            ),
            suggested_actions=[
                "Check heap and memory allocation",
                "Review recent code changes",
                "Monitor garbage collection activity",
                "Consider scaling or increasing memory limits",
            ],
        )
    elif post_agg["memory_usage"] >= memory_threshold * 0.9 and "memory_usage" not in suppressed_metrics:
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
    elif post_agg["memory_usage"] <= memory_threshold * 0.8 and "memory_usage" not in suppressed_metrics:
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
    if pre_traffic >= MIN_TRAFFIC_THRESHOLD:
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

    if hints:
        db.add_all(hints)
    if hints or deleted:
        db.commit()

    return hints
