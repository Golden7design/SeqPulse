from dataclasses import dataclass
from typing import Any

from app.email.types import (
    EMAIL_TYPE_CRITICAL_VERDICT_ALERT,
    EMAIL_TYPE_FIRST_VERDICT_AVAILABLE,
    EMAIL_TYPE_FREE_QUOTA_80,
    EMAIL_TYPE_FREE_QUOTA_REACHED,
    EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
    EMAIL_TYPE_WELCOME_SIGNUP,
)


@dataclass(frozen=True)
class EmailContent:
    subject: str
    text: str
    html: str


def render_mvp_email_content(email_type: str, context: dict[str, Any]) -> EmailContent:
    if email_type == EMAIL_TYPE_WELCOME_SIGNUP:
        return _welcome_signup(context)
    if email_type == EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP:
        return _no_project_after_signup(context)
    if email_type == EMAIL_TYPE_FIRST_VERDICT_AVAILABLE:
        return _first_verdict_available(context)
    if email_type == EMAIL_TYPE_CRITICAL_VERDICT_ALERT:
        return _critical_verdict_alert(context)
    if email_type == EMAIL_TYPE_FREE_QUOTA_80:
        return _free_quota_80(context)
    if email_type == EMAIL_TYPE_FREE_QUOTA_REACHED:
        return _free_quota_reached(context)
    raise ValueError(f"Unsupported MVP email type: {email_type}")


def _welcome_signup(context: dict[str, Any]) -> EmailContent:
    first_name = _first_name(context)
    onboarding_url = _url(context, key="onboarding_url", fallback="/projects/new")

    subject = "SEQPULSE | Bienvenue - cree ton premier projet"
    text = (
        f"Bonjour {first_name},\n\n"
        "Bienvenue sur SEQPULSE.\n"
        "Premiere etape: cree ton premier projet pour activer le suivi de tes deployments.\n\n"
        f"CTA - Creer mon premier projet: {onboarding_url}\n"
    )
    html = (
        f"<p>Bonjour {first_name},</p>"
        "<p>Bienvenue sur <strong>SEQPULSE</strong>.</p>"
        "<p>Premiere etape: cree ton premier projet pour activer le suivi de tes deployments.</p>"
        f"<p><a href=\"{onboarding_url}\">CTA - Creer mon premier projet</a></p>"
    )
    return EmailContent(subject=subject, text=text, html=html)


def _no_project_after_signup(context: dict[str, Any]) -> EmailContent:
    first_name = _first_name(context)
    onboarding_url = _url(context, key="onboarding_url", fallback="/projects/new")

    subject = "SEQPULSE | Active ton compte en 1 etape"
    text = (
        f"Bonjour {first_name},\n\n"
        "Tu es a une etape de ton premier verdict deployment.\n"
        "Cree ton premier projet pour connecter ton pipeline CI/CD.\n\n"
        f"CTA - Creer mon premier projet: {onboarding_url}\n"
    )
    html = (
        f"<p>Bonjour {first_name},</p>"
        "<p>Tu es a une etape de ton premier verdict deployment.</p>"
        "<p>Cree ton premier projet pour connecter ton pipeline CI/CD.</p>"
        f"<p><a href=\"{onboarding_url}\">CTA - Creer mon premier projet</a></p>"
    )
    return EmailContent(subject=subject, text=text, html=html)


def _first_verdict_available(context: dict[str, Any]) -> EmailContent:
    first_name = _first_name(context)
    project_name = _project_name(context)
    verdict = _verdict(context, fallback="warning")
    dashboard_url = _url(context, key="dashboard_url", fallback="/dashboard")

    subject = f"SEQPULSE | Premier verdict pour {project_name}: {verdict}"
    text = (
        f"Bonjour {first_name},\n\n"
        f"Le premier verdict est disponible pour {project_name}.\n"
        f"Verdict: {verdict}\n\n"
        f"CTA - Voir le verdict complet: {dashboard_url}\n"
    )
    html = (
        f"<p>Bonjour {first_name},</p>"
        f"<p>Le premier verdict est disponible pour <strong>{project_name}</strong>.</p>"
        f"<p>Verdict: <strong>{verdict}</strong></p>"
        f"<p><a href=\"{dashboard_url}\">CTA - Voir le verdict complet</a></p>"
    )
    return EmailContent(subject=subject, text=text, html=html)


def _critical_verdict_alert(context: dict[str, Any]) -> EmailContent:
    first_name = _first_name(context)
    project_name = _project_name(context)
    env = _env(context)
    deployment_number = _deployment_number(context)
    verdict = _verdict(context, fallback="rollback_recommended")
    dashboard_url = _url(context, key="dashboard_url", fallback="/dashboard")

    deployment_label = f"#{deployment_number}" if deployment_number else ""
    subject = f"SEQPULSE | Alerte critique: {project_name} ({env})"
    text = (
        f"Bonjour {first_name},\n\n"
        f"SEQPULSE a detecte un verdict critique ({verdict}) pour {project_name} {deployment_label}.\n"
        "Ouvre le dashboard pour analyser les signaux et agir rapidement.\n\n"
        f"CTA - Ouvrir le dashboard: {dashboard_url}\n"
    )
    html = (
        f"<p>Bonjour {first_name},</p>"
        f"<p>SEQPULSE a detecte un verdict critique (<strong>{verdict}</strong>) "
        f"pour <strong>{project_name}</strong> {deployment_label}.</p>"
        "<p>Ouvre le dashboard pour analyser les signaux et agir rapidement.</p>"
        f"<p><a href=\"{dashboard_url}\">CTA - Ouvrir le dashboard</a></p>"
    )
    return EmailContent(subject=subject, text=text, html=html)


def _free_quota_80(context: dict[str, Any]) -> EmailContent:
    first_name = _first_name(context)
    project_name = _project_name(context)
    deployments_used = _deployments_used(context, fallback=40)
    pricing_url = _url(context, key="pricing_url", fallback="/pricing")

    subject = f"SEQPULSE | Quota Free a {deployments_used}/50"
    text = (
        f"Bonjour {first_name},\n\n"
        f"Votre projet \"{project_name}\" a atteint {deployments_used}/50 deployments ce mois-ci.\n"
        "Passez au plan Pro pour garder votre cadence de release sans blocage.\n\n"
        f"CTA - Passer au plan Pro: {pricing_url}\n"
    )
    html = (
        f"<p>Bonjour {first_name},</p>"
        f"<p>Votre projet <strong>{project_name}</strong> a atteint {deployments_used}/50 deployments ce mois-ci.</p>"
        "<p>Passez au plan Pro pour garder votre cadence de release sans blocage.</p>"
        f"<p><a href=\"{pricing_url}\">CTA - Passer au plan Pro</a></p>"
    )
    return EmailContent(subject=subject, text=text, html=html)


def _free_quota_reached(context: dict[str, Any]) -> EmailContent:
    first_name = _first_name(context)
    project_name = _project_name(context)
    pricing_url = _url(context, key="pricing_url", fallback="/pricing")

    subject = "SEQPULSE | Quota Free atteint (50/50)"
    text = (
        f"Bonjour {first_name},\n\n"
        f"Votre projet \"{project_name}\" a atteint la limite Free (50/50).\n"
        "Les nouveaux deployments sont bloques tant que le plan reste Free.\n\n"
        f"CTA - Reprendre les deployments: {pricing_url}\n"
    )
    html = (
        f"<p>Bonjour {first_name},</p>"
        f"<p>Votre projet <strong>{project_name}</strong> a atteint la limite Free (50/50).</p>"
        "<p>Les nouveaux deployments sont bloques tant que le plan reste Free.</p>"
        f"<p><a href=\"{pricing_url}\">CTA - Reprendre les deployments</a></p>"
    )
    return EmailContent(subject=subject, text=text, html=html)


def _first_name(context: dict[str, Any]) -> str:
    candidate = str(context.get("first_name") or "").strip()
    return candidate if candidate else "there"


def _project_name(context: dict[str, Any]) -> str:
    candidate = str(context.get("project_name") or "").strip()
    return candidate if candidate else "ton projet"


def _env(context: dict[str, Any]) -> str:
    candidate = str(context.get("env") or "").strip().lower()
    return candidate if candidate else "prod"


def _deployment_number(context: dict[str, Any]) -> str:
    candidate = str(context.get("deployment_number") or "").strip()
    return candidate


def _verdict(context: dict[str, Any], fallback: str) -> str:
    candidate = str(context.get("verdict") or "").strip().lower()
    if candidate in {"ok", "warning", "rollback_recommended"}:
        return candidate
    return fallback


def _deployments_used(context: dict[str, Any], fallback: int) -> int:
    raw_value = context.get("deployments_used")
    try:
        value = int(raw_value)
        return max(0, value)
    except (TypeError, ValueError):
        return fallback


def _url(context: dict[str, Any], *, key: str, fallback: str) -> str:
    candidate = str(context.get(key) or "").strip()
    return candidate if candidate else fallback
