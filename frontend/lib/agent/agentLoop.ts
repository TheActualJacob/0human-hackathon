import Anthropic from '@anthropic-ai/sdk'
import { TenantContext } from './contextLoader'
import { buildSystemPrompt } from './systemPrompt'
import { AGENT_TOOLS, ToolName, ToolInput } from './tools'
import { executeTool, ToolResult } from './toolHandlers'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const MAX_ITERATIONS = 8 // Safety limit for tool-calling loops

export interface AgentResult {
  finalMessage: string
  toolsUsed: string[]
  highSeverityActions: string[]
  intentClassification: string
  confidenceScore: number
}

export async function runAgentLoop(
  userMessage: string,
  ctx: TenantContext
): Promise<AgentResult> {
  const systemPrompt = buildSystemPrompt(ctx)

  // Seed the messages array with the full conversation history + new message
  const messages: Anthropic.MessageParam[] = [
    ...buildConversationHistory(ctx),
    { role: 'user', content: userMessage },
  ]

  const toolsUsed: string[] = []
  const highSeverityActions: string[] = []
  let iteration = 0
  let finalMessage = ''

  while (iteration < MAX_ITERATIONS) {
    iteration++

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      tools: AGENT_TOOLS,
      messages,
    })

    // Append assistant response to messages
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      // Extract the final text response
      const textBlock = response.content.find((b) => b.type === 'text')
      finalMessage = textBlock ? (textBlock as Anthropic.TextBlock).text : ''
      break
    }

    if (response.stop_reason === 'tool_use') {
      // Execute all tool calls in this response
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        const toolName = toolUse.name as ToolName
        toolsUsed.push(toolName)

        let result: ToolResult
        try {
          result = await executeTool(toolName, toolUse.input as ToolInput[typeof toolName], ctx)
        } catch (err) {
          result = {
            success: false,
            error: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
          }
        }

        if (result.isHighSeverity && result.landlordNotificationMessage) {
          highSeverityActions.push(result.landlordNotificationMessage)
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result.success ? result.data : { error: result.error }),
          is_error: !result.success,
        })
      }

      // Feed tool results back to Claude
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Unexpected stop reason — break and use whatever text we have
    const textBlock = response.content.find((b) => b.type === 'text')
    finalMessage = textBlock ? (textBlock as Anthropic.TextBlock).text : 'I was unable to process your request. Please try again.'
    break
  }

  if (!finalMessage) {
    finalMessage = 'I have processed your request. Please let me know if you need anything else.'
  }

  // Classify the intent from the conversation for logging
  const intentClassification = classifyIntent(userMessage, toolsUsed)

  return {
    finalMessage,
    toolsUsed,
    highSeverityActions,
    intentClassification,
    confidenceScore: toolsUsed.length > 0 ? 0.95 : 0.8,
  }
}

function buildConversationHistory(ctx: TenantContext): Anthropic.MessageParam[] {
  // Convert stored conversations to Claude message format (last 10, already in chronological order)
  return ctx.recentConversations.map((conv) => ({
    role: conv.direction === 'inbound' ? 'user' : 'assistant',
    content: conv.message_body,
  }))
}

function classifyIntent(message: string, toolsUsed: string[]): string {
  if (toolsUsed.includes('issue_legal_notice')) return 'legal_response'
  if (toolsUsed.includes('schedule_maintenance')) return 'maintenance'
  if (toolsUsed.includes('get_rent_status')) return 'finance'
  if (toolsUsed.includes('update_escalation_level')) return 'escalation'

  const lower = message.toLowerCase()
  if (lower.includes('rent') || lower.includes('pay') || lower.includes('arrear')) return 'finance'
  if (lower.includes('fix') || lower.includes('broken') || lower.includes('repair') || lower.includes('leak') || lower.includes('heat')) return 'maintenance'
  if (lower.includes('lease') || lower.includes('contract') || lower.includes('renew')) return 'lease_query'
  if (lower.includes('notice') || lower.includes('evict') || lower.includes('legal')) return 'legal_response'
  return 'general'
}
