from __future__ import annotations

import json
from dataclasses import dataclass, field

import anthropic

from app.config import settings
from app.services.context_loader import TenantContext
from app.services.system_prompt import build_system_prompt
from app.services.tool_handlers import AGENT_TOOLS, execute_tool

MAX_ITERATIONS = 8


@dataclass
class AgentResult:
    final_message: str
    tools_used: list[str] = field(default_factory=list)
    high_severity_actions: list[str] = field(default_factory=list)
    intent_classification: str = "general"
    confidence_score: float = 0.8


async def run_agent_loop(user_message: str, ctx: TenantContext) -> AgentResult:
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    system_prompt = build_system_prompt(ctx)

    # Seed conversation history from DB (last 10 messages, chronological)
    messages: list[dict] = [
        {
            "role": "user" if conv.direction == "inbound" else "assistant",
            "content": conv.message_body,
        }
        for conv in ctx.recent_conversations
    ]
    messages.append({"role": "user", "content": user_message})

    tools_used: list[str] = []
    high_severity_actions: list[str] = []
    final_message = ""
    iteration = 0

    while iteration < MAX_ITERATIONS:
        iteration += 1

        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            system=system_prompt,
            tools=AGENT_TOOLS,  # type: ignore[arg-type]
            messages=messages,
        )

        # Append assistant turn
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if block.type == "text":
                    final_message = block.text
                    break
            break

        if response.stop_reason == "tool_use":
            tool_results = []

            for block in response.content:
                if block.type != "tool_use":
                    continue

                tool_name = block.name
                tool_input = block.input or {}
                tools_used.append(tool_name)

                try:
                    result = await execute_tool(tool_name, tool_input, ctx)
                except Exception as exc:
                    result_content = json.dumps({"error": str(exc)})
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_content,
                        "is_error": True,
                    })
                    continue

                if result.is_high_severity and result.landlord_notification_message:
                    high_severity_actions.append(result.landlord_notification_message)

                result_content = json.dumps(
                    result.data if result.success else {"error": result.error}
                )
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_content,
                    "is_error": not result.success,
                })

            messages.append({"role": "user", "content": tool_results})
            continue

        # Unexpected stop reason — use any text available
        for block in response.content:
            if block.type == "text":
                final_message = block.text
                break
        break

    if not final_message:
        final_message = "I have processed your request. Please let me know if you need anything else."

    intent = _classify_intent(user_message, tools_used)
    confidence = 0.95 if tools_used else 0.8

    return AgentResult(
        final_message=final_message,
        tools_used=tools_used,
        high_severity_actions=high_severity_actions,
        intent_classification=intent,
        confidence_score=confidence,
    )


def _classify_intent(message: str, tools_used: list[str]) -> str:
    if "issue_legal_notice" in tools_used:
        return "legal_response"
    if "schedule_maintenance" in tools_used:
        return "maintenance"
    if "get_rent_status" in tools_used:
        return "finance"
    if "update_escalation_level" in tools_used:
        return "escalation"

    lower = message.lower()
    if any(w in lower for w in ("rent", "pay", "arrear")):
        return "finance"
    if any(w in lower for w in ("fix", "broken", "repair", "leak", "heat")):
        return "maintenance"
    if any(w in lower for w in ("lease", "contract", "renew")):
        return "lease_query"
    if any(w in lower for w in ("notice", "evict", "legal")):
        return "legal_response"
    return "general"
