from __future__ import annotations

import json
from dataclasses import dataclass, field

import anthropic

from app.config import settings
from app.services.prospect_context_loader import ProspectContext
from app.services.prospect_system_prompt import build_prospect_system_prompt
from app.services.prospect_tool_handlers import PROSPECT_AGENT_TOOLS, execute_prospect_tool

MAX_ITERATIONS = 6


@dataclass
class ProspectAgentResult:
    final_message: str
    tools_used: list[str] = field(default_factory=list)
    application_link_sent: bool = False
    application_link: str | None = None


async def run_prospect_agent_loop(user_message: str, ctx: ProspectContext) -> ProspectAgentResult:
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    system_prompt = build_prospect_system_prompt(ctx)

    messages: list[dict] = [
        {"role": "user" if c.direction == "inbound" else "assistant", "content": c.message_body}
        for c in ctx.recent_conversations
    ]
    messages.append({"role": "user", "content": user_message})

    tools_used: list[str] = []
    application_link_sent = False
    application_link: str | None = None
    final_message = ""
    iteration = 0

    while iteration < MAX_ITERATIONS:
        iteration += 1

        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            system=system_prompt,
            tools=PROSPECT_AGENT_TOOLS,  # type: ignore[arg-type]
            messages=messages,
        )

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
                    result = await execute_prospect_tool(tool_name, tool_input, ctx)
                except Exception as exc:
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps({"error": str(exc)}),
                        "is_error": True,
                    })
                    continue

                if tool_name == "send_application_link" and result.success and result.data:
                    application_link_sent = True
                    application_link = result.data.get("application_link")

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result.data if result.success else {"error": result.error}),
                    "is_error": not result.success,
                })

            messages.append({"role": "user", "content": tool_results})
            continue

        for block in response.content:
            if block.type == "text":
                final_message = block.text
                break
        break

    if not final_message:
        final_message = (
            "Thanks for getting in touch! I'm here to help you find your new home. "
            "What would you like to know about our available properties?"
        )

    return ProspectAgentResult(
        final_message=final_message,
        tools_used=tools_used,
        application_link_sent=application_link_sent,
        application_link=application_link,
    )
