from __future__ import annotations

import re
from typing import Any


def make_localized_text(
    *,
    fallback: str,
    key: str | None = None,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "key": key,
        "fallback": fallback,
        "params": params or {},
    }
    return payload


_VERDICT_SUMMARY_KEYS = {
    "Insufficient metrics to assess deployment health": "analysis.verdict.summary.insufficientMetrics",
    "No significant regression detected": "analysis.verdict.summary.noSignificantRegression",
    "Critical regression detected": "analysis.verdict.summary.criticalRegression",
    "Potential performance degradation detected": "analysis.verdict.summary.potentialPerformanceDegradation",
    "Multiple critical regressions detected": "analysis.verdict.summary.multipleCriticalRegressions",
    "Post-deploy metrics validation failed; deployment analyzed with limited confidence": (
        "analysis.verdict.summary.postDeployValidationFailed"
    ),
    "Critical regressions detected": "analysis.verdict.summary.criticalRegressionsDetected",
}

_VERDICT_DEFAULT_SUMMARY_KEYS = {
    "ok": "analysis.verdict.summary.noSignificantRegression",
    "warning": "analysis.verdict.summary.potentialPerformanceDegradation",
    "rollback_recommended": "analysis.verdict.summary.criticalRegressionsDetected",
}

_DETAIL_METRIC_EXCEED_RE = re.compile(
    r"^(?P<metric>[a-z_]+) exceed_ratio (?P<ratio>\d+%) > (?P<tolerance>\d+%) \(secured (?P<secured>[^)]+)\)$"
)
_DETAIL_RPS_DROP_RE = re.compile(
    r"^requests_per_sec drop_ratio (?P<ratio>\d+%) > (?P<tolerance>\d+%) \(drop_threshold (?P<drop_threshold>\d+%)\)$"
)
_DETAIL_DATA_QUALITY_SCORE_RE = re.compile(r"^data_quality_score (?P<score>\d+(?:\.\d+)?)$")
_DETAIL_DATA_QUALITY_ISSUE_RE = re.compile(r"^data_quality_issue (?P<issue>.+)$")
_DETAIL_DQ_MIN_POST_RE = re.compile(r"^min_post_samples (?P<count>\d+)/(?P<required>\d+)$")
_DETAIL_DQ_STALE_RE = re.compile(r"^stale_post_metrics age_seconds=(?P<age_seconds>\d+)$")
_DETAIL_DQ_GAPS_RE = re.compile(r"^sequence_gaps count=(?P<count>\d+)$")

_DETAIL_METRIC_EXCEED_KEYS = {
    "latency_p95": "analysis.verdict.details.metricExceedRatio.latencyP95",
    "error_rate": "analysis.verdict.details.metricExceedRatio.errorRate",
    "cpu_usage": "analysis.verdict.details.metricExceedRatio.cpuUsage",
    "memory_usage": "analysis.verdict.details.metricExceedRatio.memoryUsage",
}


def localize_verdict_summary(summary: str, *, verdict: str | None = None) -> dict[str, Any]:
    key = _VERDICT_SUMMARY_KEYS.get(summary)
    if key is None and verdict:
        key = _VERDICT_DEFAULT_SUMMARY_KEYS.get(verdict)
    return make_localized_text(key=key, fallback=summary)


def localize_verdict_detail(detail: str) -> dict[str, Any]:
    match = _DETAIL_METRIC_EXCEED_RE.match(detail)
    if match:
        metric = match.group("metric")
        key = _DETAIL_METRIC_EXCEED_KEYS.get(metric)
        return make_localized_text(
            key=key,
            fallback=detail,
            params={
                "ratio": match.group("ratio"),
                "tolerance": match.group("tolerance"),
                "secured": match.group("secured"),
            },
        )

    match = _DETAIL_RPS_DROP_RE.match(detail)
    if match:
        return make_localized_text(
            key="analysis.verdict.details.rpsDropRatio",
            fallback=detail,
            params={
                "ratio": match.group("ratio"),
                "tolerance": match.group("tolerance"),
                "drop_threshold": match.group("drop_threshold"),
            },
        )

    match = _DETAIL_DATA_QUALITY_SCORE_RE.match(detail)
    if match:
        return make_localized_text(
            key="analysis.verdict.details.dataQualityScore",
            fallback=detail,
            params={"score": match.group("score")},
        )

    match = _DETAIL_DATA_QUALITY_ISSUE_RE.match(detail)
    if match:
        issue = match.group("issue")
        issue_match = _DETAIL_DQ_MIN_POST_RE.match(issue)
        if issue_match:
            return make_localized_text(
                key="analysis.verdict.details.dataQualityIssue.minPostSamples",
                fallback=detail,
                params={
                    "count": issue_match.group("count"),
                    "required": issue_match.group("required"),
                },
            )
        issue_match = _DETAIL_DQ_STALE_RE.match(issue)
        if issue_match:
            return make_localized_text(
                key="analysis.verdict.details.dataQualityIssue.stalePostMetrics",
                fallback=detail,
                params={"age_seconds": issue_match.group("age_seconds")},
            )
        issue_match = _DETAIL_DQ_GAPS_RE.match(issue)
        if issue_match:
            return make_localized_text(
                key="analysis.verdict.details.dataQualityIssue.sequenceGaps",
                fallback=detail,
                params={"count": issue_match.group("count")},
            )

        simple_issue_key_map = {
            "missing_pre_samples": "analysis.verdict.details.dataQualityIssue.missingPreSamples",
            "missing_post_timestamps": "analysis.verdict.details.dataQualityIssue.missingPostTimestamps",
            "incoherent_timestamps post_before_pre": "analysis.verdict.details.dataQualityIssue.postBeforePre",
            "incoherent_timestamps post_in_future": "analysis.verdict.details.dataQualityIssue.postInFuture",
        }
        key = simple_issue_key_map.get(issue)
        if key:
            return make_localized_text(key=key, fallback=detail)
        return make_localized_text(
            key="analysis.verdict.details.dataQualityIssue.generic",
            fallback=detail,
            params={"issue": issue},
        )

    return make_localized_text(fallback=detail)


def localize_verdict_details(details: list[str]) -> list[dict[str, Any]]:
    return [localize_verdict_detail(detail) for detail in details]


def _normalize_text(text: str) -> str:
    return " ".join((text or "").split())


_SDH_TITLE_KEYS = {
    "Persistent critical threshold breaches detected": "analysis.sdh.title.persistentCriticalThresholdBreaches",
    "Persistent critical threshold breach detected": "analysis.sdh.title.persistentCriticalThresholdBreach",
    "Service degradation detected": "analysis.sdh.title.serviceDegradationDetected",
    "Compute saturation suspected": "analysis.sdh.title.computeSaturationSuspected",
    "Partial outage suspected": "analysis.sdh.title.partialOutageSuspected",
    "High error rate after deployment": "analysis.sdh.title.highErrorRateAfterDeployment",
    "High latency detected": "analysis.sdh.title.highLatencyDetected",
    "Latency improved after deployment": "analysis.sdh.title.latencyImprovedAfterDeployment",
    "CPU usage spike detected": "analysis.sdh.title.cpuUsageSpikeDetected",
    "Memory usage above threshold": "analysis.sdh.title.memoryUsageAboveThreshold",
    "Memory usage approaching threshold": "analysis.sdh.title.memoryUsageApproachingThreshold",
    "Memory usage within normal range": "analysis.sdh.title.memoryUsageWithinNormalRange",
    "Traffic lower than baseline after deployment": "analysis.sdh.title.trafficLowerThanBaselineAfterDeployment",
    "Critical verdict requires investigation": "analysis.sdh.title.criticalVerdictRequiresInvestigation",
}

_SDH_PERSISTENT_TITLE_RE = re.compile(r"^Persistent (?P<label>.+) breaches detected$")
_SDH_PERSISTENT_TITLE_KEYS = {
    "latency p95": "analysis.sdh.title.persistentMetricBreaches.latencyP95",
    "cpu usage": "analysis.sdh.title.persistentMetricBreaches.cpuUsage",
    "memory usage": "analysis.sdh.title.persistentMetricBreaches.memoryUsage",
}

_SDH_DIAGNOSIS_KEYS = {
    (
        "Both error rate and latency increased after deployment, suggesting a major service "
        "degradation (likely downstream service failure or resource exhaustion)."
    ): "analysis.sdh.diagnosis.serviceDegradationDetected",
    (
        "Latency and CPU usage both increased after deployment, which often indicates compute "
        "saturation, inefficient code, or blocking operations."
    ): "analysis.sdh.diagnosis.computeSaturationSuspected",
    (
        "Error rate increased while traffic dropped significantly after deployment, suggesting "
        "a partial outage, failed health checks, or routing misconfiguration."
    ): "analysis.sdh.diagnosis.partialOutageSuspected",
    (
        "The service is returning an unusually high number of errors after deployment, "
        "indicating a possible application bug, dependency failure, or config issue."
    ): "analysis.sdh.diagnosis.highErrorRateAfterDeployment",
    (
        "Response time increased significantly after deployment, which may indicate slow "
        "database queries, external API latency, or resource contention."
    ): "analysis.sdh.diagnosis.highLatencyDetected",
    (
        "Response time decreased after deployment, indicating successful performance "
        "optimizations in the new version."
    ): "analysis.sdh.diagnosis.latencyImprovedAfterDeployment",
    (
        "CPU consumption increased significantly after deployment, which may indicate "
        "inefficient algorithms, infinite loops, or increased computational load."
    ): "analysis.sdh.diagnosis.cpuUsageSpikeDetected",
    (
        "Memory consumption exceeded the configured threshold, suggesting a possible "
        "memory leak, unbounded caching, or insufficient heap size."
    ): "analysis.sdh.diagnosis.memoryUsageAboveThreshold",
    (
        "Memory consumption increased after deployment and is approaching critical limits, "
        "which may impact service stability."
    ): "analysis.sdh.diagnosis.memoryUsageApproachingThreshold",
    (
        "Memory consumption is stable and well below the configured threshold, indicating "
        "healthy resource utilization after deployment."
    ): "analysis.sdh.diagnosis.memoryUsageWithinNormalRange",
    (
        "Post-deployment traffic is significantly lower compared to the pre-deployment "
        "baseline, while no strong error or latency increase was detected."
    ): "analysis.sdh.diagnosis.trafficLowerThanBaselineAfterDeployment",
    (
        "Critical persistent breaches were detected by metrics audit but no critical "
        "diagnostic hint was generated."
    ): "analysis.sdh.diagnosis.criticalVerdictRequiresInvestigation",
}

_SDH_CRITICAL_METRICS_DIAGNOSIS_RE = re.compile(
    r"^Critical metrics are persistently breaching secured thresholds across post-deploy sequences \((?P<metrics>.+)\)\.$"
)
_SDH_CRITICAL_SINGLE_DIAGNOSIS_RE = re.compile(
    r"^(?P<label>.+) is persistently breaching secured thresholds across post-deploy sequences\.$"
)
_SDH_PERSISTENT_METRIC_DIAGNOSIS_RE = re.compile(
    r"^(?P<label>.+) exceeded the tolerated breach ratio across post-deployment sequences\.$"
)
_SDH_PERSISTENT_METRIC_DIAGNOSIS_KEYS = {
    "latency p95": "analysis.sdh.diagnosis.persistentMetricBreaches.latencyP95",
    "cpu usage": "analysis.sdh.diagnosis.persistentMetricBreaches.cpuUsage",
    "memory usage": "analysis.sdh.diagnosis.persistentMetricBreaches.memoryUsage",
}

_SDH_ACTION_KEYS = {
    "Inspect failing sequences in metrics audit": "analysis.sdh.actions.inspectFailingSequencesInMetricsAudit",
    "Check recent release and infrastructure changes": "analysis.sdh.actions.checkRecentReleaseAndInfrastructureChanges",
    "Run targeted rollback checks for impacted paths": "analysis.sdh.actions.runTargetedRollbackChecksForImpactedPaths",
    "Rollback if critical breaches continue": "analysis.sdh.actions.rollbackIfCriticalBreachesContinue",
    "Review sequence-level metrics for this deployment": "analysis.sdh.actions.reviewSequenceLevelMetricsForThisDeployment",
    "Compare with the PRE baseline and secured threshold": "analysis.sdh.actions.compareWithPreBaselineAndSecuredThreshold",
    "Investigate recent code and config changes": "analysis.sdh.actions.investigateRecentCodeAndConfigChanges",
    "Scale or rollback if persistence remains high": "analysis.sdh.actions.scaleOrRollbackIfPersistenceRemainsHigh",
    "Check application error logs for 5xx errors or exceptions": "analysis.sdh.actions.checkApplicationErrorLogs",
    "Verify database connectivity and query performance": "analysis.sdh.actions.verifyDatabaseConnectivityAndQueryPerformance",
    "Check external API dependencies for timeouts or failures": "analysis.sdh.actions.checkExternalApiDependenciesForTimeoutsOrFailures",
    "Review recent code changes for error handling or timeout config": "analysis.sdh.actions.reviewRecentCodeChangesForErrorHandlingOrTimeoutConfig",
    "Consider rollback if errors persist after 5 minutes": "analysis.sdh.actions.considerRollbackIfErrorsPersistAfterFiveMinutes",
    "Profile CPU to identify hot methods or loops (N+1 queries, heavy computations)": "analysis.sdh.actions.profileCpuToIdentifyHotMethods",
    "Check for blocking I/O operations (sync DB calls, external API waits)": "analysis.sdh.actions.checkForBlockingIoOperations",
    "Verify connection pool settings are not exhausted": "analysis.sdh.actions.verifyConnectionPoolSettings",
    "Consider horizontal scaling if CPU is consistently > 80%": "analysis.sdh.actions.considerHorizontalScalingIfCpuAboveEighty",
    "Review recent code changes for algorithmic complexity increases": "analysis.sdh.actions.reviewRecentCodeChangesForAlgorithmicComplexityIncreases",
    "Check load balancer health checks (are instances marked unhealthy?)": "analysis.sdh.actions.checkLoadBalancerHealthChecks",
    "Verify ingress/routing rules point to correct service version": "analysis.sdh.actions.verifyIngressRoutingRulesPointToCorrectServiceVersion",
    "Check application startup logs for crash loops or init failures": "analysis.sdh.actions.checkApplicationStartupLogsForCrashLoops",
    "Validate environment variables and config maps are correctly set": "analysis.sdh.actions.validateEnvironmentVariablesAndConfigMaps",
    "Consider immediate rollback if > 50% traffic impacted": "analysis.sdh.actions.considerImmediateRollbackIfTrafficImpacted",
    "Check application logs for exceptions (NullPointer, syntax errors, import failures)": "analysis.sdh.actions.checkApplicationLogsForExceptions",
    "Verify database migrations completed successfully": "analysis.sdh.actions.verifyDatabaseMigrationsCompletedSuccessfully",
    "Check external service dependencies (APIs, caches, message queues)": "analysis.sdh.actions.checkExternalServiceDependencies",
    "Review environment variables and secrets configuration": "analysis.sdh.actions.reviewEnvironmentVariablesAndSecretsConfiguration",
    "Check database slow query logs for missing indexes or full table scans": "analysis.sdh.actions.checkDatabaseSlowQueryLogs",
    "Verify external API response times and timeout configurations": "analysis.sdh.actions.verifyExternalApiResponseTimesAndTimeoutConfigurations",
    "Check for memory pressure causing GC pauses or swapping": "analysis.sdh.actions.checkForMemoryPressureCausingGcPauses",
    "Enable distributed tracing to identify bottleneck spans": "analysis.sdh.actions.enableDistributedTracingToIdentifyBottleneckSpans",
    "Consider rollback if p95 latency > 2x baseline for 5+ minutes": "analysis.sdh.actions.considerRollbackIfP95LatencyAboveBaseline",
    "Profile CPU to identify top consuming methods or endpoints": "analysis.sdh.actions.profileCpuToIdentifyTopConsumingMethods",
    "Check for N+1 query problems or unoptimized database access patterns": "analysis.sdh.actions.checkForNPlusOneQueryProblems",
    "Look for infinite loops or recursive calls without termination": "analysis.sdh.actions.lookForInfiniteLoopsOrRecursiveCalls",
    "Verify no crypto mining or unauthorized processes running": "analysis.sdh.actions.verifyNoUnauthorizedProcessesRunning",
    "Consider horizontal scaling if legitimate load increase": "analysis.sdh.actions.considerHorizontalScalingIfLegitimateLoadIncrease",
    "Check heap dumps for growing object types (caches, unclosed connections)": "analysis.sdh.actions.checkHeapDumpsForGrowingObjectTypes",
    "Monitor garbage collection frequency and pause times": "analysis.sdh.actions.monitorGarbageCollectionFrequencyAndPauseTimes",
    "Review recent changes for unbounded data structures or large object retention": "analysis.sdh.actions.reviewRecentChangesForUnboundedDataStructures",
    "Check for connection leaks (DB, HTTP, file handles not closed)": "analysis.sdh.actions.checkForConnectionLeaks",
    "Consider increasing memory limits or implementing cache eviction policies": "analysis.sdh.actions.considerIncreasingMemoryLimitsOrCacheEvictionPolicies",
    "Check heap and memory allocation": "analysis.sdh.actions.checkHeapAndMemoryAllocation",
    "Review recent code changes": "analysis.sdh.actions.reviewRecentCodeChanges",
    "Monitor garbage collection activity": "analysis.sdh.actions.monitorGarbageCollectionActivity",
    "Ensure memory limits are correctly set": "analysis.sdh.actions.ensureMemoryLimitsAreCorrectlySet",
    "Continue monitoring memory trends": "analysis.sdh.actions.continueMonitoringMemoryTrends",
    "No immediate action required": "analysis.sdh.actions.noImmediateActionRequired",
    "Consider optimization if usage trends upward": "analysis.sdh.actions.considerOptimizationIfUsageTrendsUpward",
    "Compare traffic with previous time periods": "analysis.sdh.actions.compareTrafficWithPreviousTimePeriods",
    "Check ingress or routing configuration": "analysis.sdh.actions.checkIngressOrRoutingConfiguration",
    "Verify main endpoints availability": "analysis.sdh.actions.verifyMainEndpointsAvailability",
    "Monitor error rate and latency for further signals": "analysis.sdh.actions.monitorErrorRateAndLatencyForFurtherSignals",
    "Document the optimizations made": "analysis.sdh.actions.documentTheOptimizationsMade",
    "Continue monitoring performance trends": "analysis.sdh.actions.continueMonitoringPerformanceTrends",
    "Share best practices with other teams": "analysis.sdh.actions.shareBestPracticesWithOtherTeams",
    "Inspect metrics audit details for this deployment": "analysis.sdh.actions.inspectMetricsAuditDetailsForThisDeployment",
    "Correlate failing metrics with logs/traces": "analysis.sdh.actions.correlateFailingMetricsWithLogsAndTraces",
    "Validate rollback readiness": "analysis.sdh.actions.validateRollbackReadiness",
}


def localize_sdh_title(title: str) -> dict[str, Any]:
    normalized = _normalize_text(title)

    match = _SDH_PERSISTENT_TITLE_RE.match(normalized)
    if match:
        label = match.group("label").lower()
        key = _SDH_PERSISTENT_TITLE_KEYS.get(label)
        return make_localized_text(key=key, fallback=title)

    key = _SDH_TITLE_KEYS.get(normalized)
    return make_localized_text(key=key, fallback=title)


def localize_sdh_diagnosis(diagnosis: str) -> dict[str, Any]:
    normalized = _normalize_text(diagnosis)

    match = _SDH_CRITICAL_METRICS_DIAGNOSIS_RE.match(normalized)
    if match:
        metrics = match.group("metrics")
        key = "analysis.sdh.diagnosis.persistentCriticalMetricsBreaches"
        return make_localized_text(key=key, fallback=diagnosis, params={"metrics": metrics})

    match = _SDH_CRITICAL_SINGLE_DIAGNOSIS_RE.match(normalized)
    if match:
        label = match.group("label")
        key = "analysis.sdh.diagnosis.persistentCriticalThresholdBreach"
        return make_localized_text(key=key, fallback=diagnosis, params={"label": label})

    match = _SDH_PERSISTENT_METRIC_DIAGNOSIS_RE.match(normalized)
    if match:
        label = match.group("label").lower()
        key = _SDH_PERSISTENT_METRIC_DIAGNOSIS_KEYS.get(label)
        return make_localized_text(key=key, fallback=diagnosis)

    key = _SDH_DIAGNOSIS_KEYS.get(normalized)
    return make_localized_text(key=key, fallback=diagnosis)


def localize_sdh_action(action: str) -> dict[str, Any]:
    normalized = _normalize_text(action)
    key = _SDH_ACTION_KEYS.get(normalized)
    return make_localized_text(key=key, fallback=action)
