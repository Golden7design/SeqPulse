from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest


METRICS_COLLECTED_TOTAL = Counter(
    "seqpulse_metrics_collected_total",
    "Total metric samples successfully collected by SeqPulse",
    ["phase"],
)

ANALYSIS_DURATION_SECONDS = Histogram(
    "seqpulse_analysis_duration_seconds",
    "Duration of deployment analysis in seconds",
    ["outcome"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)

SCHEDULER_JOBS_PENDING = Gauge(
    "seqpulse_scheduler_jobs_pending",
    "Number of scheduler jobs currently pending",
)

SCHEDULER_JOBS_FAILED_TOTAL = Counter(
    "seqpulse_scheduler_jobs_failed_total",
    "Total scheduler jobs marked as failed",
)

SCHEDULER_JOB_START_DELAY_SECONDS = Histogram(
    "seqpulse_scheduler_job_start_delay_seconds",
    "Delay between scheduled_at and actual scheduler start time in seconds",
    ["job_type"],
    buckets=(0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600),
)

HTTP_REQUESTS_TOTAL = Counter(
    "seqpulse_http_requests_total",
    "Total HTTP requests handled by SeqPulse API",
    ["method", "path", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "seqpulse_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5),
)

ANALYSIS_VERDICT_TOTAL = Counter(
    "seqpulse_analysis_verdict_total",
    "Total analysis outcomes by verdict and creation status",
    ["verdict", "created"],
)

ANALYSIS_HINT_TOTAL = Counter(
    "seqpulse_analysis_hint_total",
    "Total SDH hints emitted by severity",
    ["severity"],
)

ANALYSIS_VERDICT_HINT_CONSISTENCY_TOTAL = Counter(
    "seqpulse_analysis_verdict_hint_consistency_total",
    "Consistency between final verdict and emitted hint severities",
    ["verdict", "consistency"],
)

ANALYSIS_QUALITY_PROXY_TOTAL = Counter(
    "seqpulse_analysis_quality_proxy_total",
    "Proxy quality events for analysis decision quality",
    ["event"],
)

ANALYSIS_FAILED_METRIC_TOTAL = Counter(
    "seqpulse_analysis_failed_metric_total",
    "Total failed metrics detected during analysis",
    ["metric", "critical"],
)


def inc_metrics_collected(phase: str) -> None:
    METRICS_COLLECTED_TOTAL.labels(phase=phase).inc()


def observe_analysis_duration(duration_seconds: float, outcome: str) -> None:
    ANALYSIS_DURATION_SECONDS.labels(outcome=outcome).observe(duration_seconds)


def set_scheduler_jobs_pending(value: int) -> None:
    SCHEDULER_JOBS_PENDING.set(value)


def inc_scheduler_jobs_failed() -> None:
    SCHEDULER_JOBS_FAILED_TOTAL.inc()


def observe_scheduler_job_start_delay(*, job_type: str, delay_seconds: float) -> None:
    SCHEDULER_JOB_START_DELAY_SECONDS.labels(job_type=job_type).observe(delay_seconds)


def observe_http_request(
    method: str,
    path: str,
    status_code: int,
    duration_seconds: float,
) -> None:
    status_code_str = str(status_code)
    HTTP_REQUESTS_TOTAL.labels(
        method=method,
        path=path,
        status_code=status_code_str,
    ).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=path).observe(duration_seconds)


def observe_analysis_quality(
    *,
    verdict: str,
    created: bool,
    failed_metrics: set[str],
    critical_failed: bool,
    hints: list | None = None,
) -> None:
    created_label = "true" if created else "false"
    ANALYSIS_VERDICT_TOTAL.labels(verdict=verdict, created=created_label).inc()

    for metric in failed_metrics:
        ANALYSIS_FAILED_METRIC_TOTAL.labels(
            metric=metric,
            critical="true" if metric in {"error_rate", "requests_per_sec"} else "false",
        ).inc()

    if critical_failed and verdict != "rollback_recommended":
        ANALYSIS_QUALITY_PROXY_TOTAL.labels(event="missed_critical_proxy").inc()

    if not created:
        return

    resolved_hints = hints or []
    for hint in resolved_hints:
        severity = getattr(hint, "severity", None)
        if severity in {"critical", "warning", "info"}:
            ANALYSIS_HINT_TOTAL.labels(severity=severity).inc()

    has_critical_hint = any(getattr(hint, "severity", None) == "critical" for hint in resolved_hints)

    if verdict == "rollback_recommended":
        consistency = "consistent" if has_critical_hint else "inconsistent"
        ANALYSIS_VERDICT_HINT_CONSISTENCY_TOTAL.labels(verdict=verdict, consistency=consistency).inc()
        if not critical_failed:
            ANALYSIS_QUALITY_PROXY_TOTAL.labels(event="false_rollback_proxy").inc()
        if not has_critical_hint:
            ANALYSIS_QUALITY_PROXY_TOTAL.labels(event="verdict_hint_mismatch").inc()
        return

    if verdict == "warning":
        consistency = "inconsistent" if has_critical_hint else "consistent"
        ANALYSIS_VERDICT_HINT_CONSISTENCY_TOTAL.labels(verdict=verdict, consistency=consistency).inc()
        return

    if verdict == "ok":
        consistency = "inconsistent" if has_critical_hint else "consistent"
        ANALYSIS_VERDICT_HINT_CONSISTENCY_TOTAL.labels(verdict=verdict, consistency=consistency).inc()
        return


def render_metrics() -> tuple[bytes, str]:
    payload = generate_latest()
    return payload, CONTENT_TYPE_LATEST
