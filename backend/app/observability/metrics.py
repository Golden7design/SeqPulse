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


def inc_metrics_collected(phase: str) -> None:
    METRICS_COLLECTED_TOTAL.labels(phase=phase).inc()


def observe_analysis_duration(duration_seconds: float, outcome: str) -> None:
    ANALYSIS_DURATION_SECONDS.labels(outcome=outcome).observe(duration_seconds)


def set_scheduler_jobs_pending(value: int) -> None:
    SCHEDULER_JOBS_PENDING.set(value)


def inc_scheduler_jobs_failed() -> None:
    SCHEDULER_JOBS_FAILED_TOTAL.inc()


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


def render_metrics() -> tuple[bytes, str]:
    payload = generate_latest()
    return payload, CONTENT_TYPE_LATEST
