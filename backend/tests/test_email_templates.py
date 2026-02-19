import pytest

from app.email.templates import render_mvp_email_content
from app.email.types import SUPPORTED_MVP_EMAIL_TYPES


@pytest.mark.parametrize("email_type", sorted(SUPPORTED_MVP_EMAIL_TYPES))
def test_templates_render_with_empty_context(email_type: str):
    content = render_mvp_email_content(email_type=email_type, context={})

    assert content.subject.strip() != ""
    assert content.text.strip() != ""
    assert content.html.strip() != ""


@pytest.mark.parametrize(
    ("email_type", "expected_cta_label"),
    [
        ("E-TRX-01", "CTA - Creer mon premier projet"),
        ("E-ACT-01", "CTA - Creer mon premier projet"),
        ("E-ACT-04", "CTA - Voir le verdict complet"),
        ("E-ACT-05", "CTA - Ouvrir le dashboard"),
        ("E-CONV-01", "CTA - Passer au plan Pro"),
        ("E-CONV-03", "CTA - Reprendre les deployments"),
    ],
)
def test_templates_include_expected_cta_label(email_type: str, expected_cta_label: str):
    context = {
        "first_name": "Nassir",
        "project_name": "Checkout API",
        "verdict": "warning",
        "deployments_used": 40,
        "dashboard_url": "http://localhost:3000/dashboard",
        "onboarding_url": "http://localhost:3000/projects/new",
        "pricing_url": "http://localhost:3000/pricing",
    }
    content = render_mvp_email_content(email_type=email_type, context=context)

    assert expected_cta_label in content.text
    assert expected_cta_label in content.html
