"""
AI Renewal Offer Generator (Part 5)

Uses Claude to produce a fully personalised, multi-option renewal proposal.
All AI calls are logged. Falls back gracefully if Anthropic is unavailable.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import date
from typing import Any

from anthropic import Anthropic, APIError

from app.config import settings
from app.services.renewal_config import RENEWAL_CONFIG

log = logging.getLogger(__name__)


def _claude():
    return Anthropic(api_key=settings.ANTHROPIC_API_KEY)


# ── Prompt Builder ───────────────────────────────────────────────────────────

def _build_offer_prompt(ctx: dict[str, Any]) -> str:
    return f"""You are a professional property manager drafting a lease renewal proposal.

TENANT CONTEXT:
- Name: {ctx['tenant_name']}
- Property: {ctx['property_address']}
- Tenancy started: {ctx['lease_start']}
- Tenancy duration: {ctx['lease_months']:.0f} months
- Current rent: €{ctx['current_rent']:.0f}/month
- Payment reliability: {ctx['payment_reliability_pct']:.0f}% on-time payments
- Open maintenance tickets: {ctx['open_maintenance_count']}

RENEWAL OPTIONS TO PROPOSE:
- Option A (12-month): €{ctx['rent_12m']:.0f}/month (+{ctx['increase_pct']:.1f}% from current)
- Option B (24-month): €{ctx['rent_24m']:.0f}/month (+{ctx['increase_24m_pct']:.1f}% from current, discount for longer commitment)

MARKET DATA:
- Local market median rent: €{ctx['market_rent']:.0f}/month
- Your proposed rent vs market: {ctx['vs_market_pct']:+.1f}%

TONE GUIDANCE:
- Tone: {ctx['tone']} (derived from payment history — high reliability = warm/appreciative, poor = firm/professional)
- Always thank the tenant for their tenancy
- Mention market data to justify any increase
- Keep it under 300 words

Return ONLY valid JSON with this structure:
{{
  "subject": "string — compelling email subject line",
  "greeting": "string — personalised opening sentence",
  "body": "string — main proposal body (2–3 paragraphs, no HTML)",
  "market_justification": "string — 1 sentence citing market data",
  "appreciation_note": "string — genuine thank-you statement",
  "options": [
    {{
      "label": "12-Month Renewal",
      "monthly_rent": {ctx['rent_12m']:.0f},
      "duration_months": 12,
      "increase_pct": {ctx['increase_pct']:.1f},
      "highlights": ["string", "string"]
    }},
    {{
      "label": "24-Month Renewal (Loyalty Rate)",
      "monthly_rent": {ctx['rent_24m']:.0f},
      "duration_months": 24,
      "increase_pct": {ctx['increase_24m_pct']:.1f},
      "highlights": ["string", "string"]
    }}
  ],
  "call_to_action": "string — clear next-step instruction",
  "closing": "string — professional sign-off",
  "tone": "{ctx['tone']}"
}}"""


def _determine_tone(payment_reliability_pct: float) -> str:
    if payment_reliability_pct >= 90:
        return "warm and appreciative"
    if payment_reliability_pct >= 70:
        return "professional and friendly"
    return "firm and professional"


# ── AI Call ──────────────────────────────────────────────────────────────────

async def _call_claude(prompt: str) -> dict[str, Any]:
    cfg = RENEWAL_CONFIG
    log.info("[RenewalContent] Calling Claude model=%s", cfg.claude_model)
    try:
        client = _claude()
        response = await asyncio.to_thread(
            client.messages.create,
            model=cfg.claude_model,
            max_tokens=cfg.claude_max_tokens_offer,
            temperature=cfg.claude_temperature,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
        log.info("[RenewalContent] Claude returned valid JSON offer")
        return result
    except (APIError, json.JSONDecodeError) as exc:
        log.warning("[RenewalContent] Claude failed: %s — using fallback", exc)
        return {}
    except Exception as exc:
        log.error("[RenewalContent] Unexpected error: %s", exc)
        return {}


def _fallback_offer(ctx: dict[str, Any]) -> dict[str, Any]:
    """Template-based fallback when Claude is unavailable."""
    return {
        "subject": f"Your Lease Renewal at {ctx['property_address']}",
        "greeting": f"Dear {ctx['tenant_name']},",
        "body": (
            f"We hope you have been enjoying your time at {ctx['property_address']}. "
            f"Your tenancy is due to expire soon and we would love for you to renew.\n\n"
            f"We are pleased to offer you the following renewal options based on current market conditions."
        ),
        "market_justification": (
            f"Local market rents are currently at €{ctx['market_rent']:.0f}/month, "
            f"and our proposed rate remains competitive."
        ),
        "appreciation_note": f"We genuinely value you as a tenant and appreciate your reliability.",
        "options": [
            {
                "label": "12-Month Renewal",
                "monthly_rent": ctx["rent_12m"],
                "duration_months": 12,
                "increase_pct": ctx["increase_pct"],
                "highlights": ["Price certainty for 1 year", "Standard terms apply"],
            },
            {
                "label": "24-Month Renewal (Loyalty Rate)",
                "monthly_rent": ctx["rent_24m"],
                "duration_months": 24,
                "increase_pct": ctx["increase_24m_pct"],
                "highlights": ["Lower rate for longer commitment", "Priority maintenance response"],
            },
        ],
        "call_to_action": "Please reply to confirm your preferred option within 14 days.",
        "closing": "Kind regards, Your Property Management Team",
        "tone": ctx["tone"],
    }


# ── Main Entry Point ─────────────────────────────────────────────────────────

async def generate_renewal_offer(
    lease_id: str,
    recommended_increase_pct: float,
    tenant_name: str,
    property_address: str,
    lease_start: str,
    lease_months: float,
    current_rent: float,
    market_rent: float,
    payment_reliability_pct: float,
    open_maintenance_count: int = 0,
) -> dict[str, Any]:
    """
    Generate a full AI renewal offer. Returns structured JSON ready to store in renewal_offers.
    """
    tone = _determine_tone(payment_reliability_pct)
    rent_12m = current_rent * (1 + recommended_increase_pct / 100.0)
    # 24-month discount: 0.5% less than 12-month increase
    increase_24m = max(0.0, recommended_increase_pct - 0.5)
    rent_24m = current_rent * (1 + increase_24m / 100.0)
    vs_market_pct = ((rent_12m - market_rent) / market_rent * 100) if market_rent else 0

    ctx = {
        "tenant_name":              tenant_name,
        "property_address":         property_address,
        "lease_start":              lease_start,
        "lease_months":             lease_months,
        "current_rent":             current_rent,
        "rent_12m":                 round(rent_12m, 2),
        "rent_24m":                 round(rent_24m, 2),
        "increase_pct":             round(recommended_increase_pct, 1),
        "increase_24m_pct":         round(increase_24m, 1),
        "market_rent":              market_rent,
        "vs_market_pct":            round(vs_market_pct, 1),
        "payment_reliability_pct":  round(payment_reliability_pct, 1),
        "open_maintenance_count":   open_maintenance_count,
        "tone":                     tone,
    }

    prompt = _build_offer_prompt(ctx)
    ai_content = await _call_claude(prompt)

    if not ai_content:
        ai_content = _fallback_offer(ctx)
        ai_content["_fallback"] = True

    ai_content["_meta"] = {
        "lease_id":             lease_id,
        "generated_at":         date.today().isoformat(),
        "model":                RENEWAL_CONFIG.claude_model,
        "context":              ctx,
    }

    log.info("[RenewalContent] Offer generated for lease %s tenant=%s", lease_id, tenant_name)
    return ai_content
