import Anthropic from '@anthropic-ai/sdk'

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_rent_status',
    description:
      'Retrieves the current rent payment status for the tenant. Returns recent payment history, any outstanding arrears, and active payment plan details. Use this when the tenant asks about payments, rent, arrears, or when you need to verify payment status before taking action.',
    input_schema: {
      type: 'object' as const,
      properties: {
        lease_id: {
          type: 'string',
          description: 'The lease ID for this tenancy.',
        },
      },
      required: ['lease_id'],
    },
  },
  {
    name: 'schedule_maintenance',
    description:
      'Creates a maintenance request and assigns the best available contractor from the landlord\'s approved list. Use this when the tenant reports a repair issue, fault, or maintenance need. For emergencies (no hot water, gas leak, flooding, no heating in winter), set urgency to "emergency".',
    input_schema: {
      type: 'object' as const,
      properties: {
        lease_id: {
          type: 'string',
          description: 'The lease ID for this tenancy.',
        },
        category: {
          type: 'string',
          enum: ['plumbing', 'electrical', 'structural', 'appliance', 'heating', 'pest', 'damp', 'access', 'other'],
          description: 'The category of the maintenance issue.',
        },
        description: {
          type: 'string',
          description: 'Clear description of the maintenance issue as reported by the tenant.',
        },
        urgency: {
          type: 'string',
          enum: ['emergency', 'high', 'routine'],
          description:
            'Urgency level: emergency = immediate risk to health/safety, high = significant inconvenience within 24-48hrs, routine = non-urgent.',
        },
      },
      required: ['lease_id', 'category', 'description', 'urgency'],
    },
  },
  {
    name: 'issue_legal_notice',
    description:
      'Issues a formal legal notice to the tenant. This generates a PDF document from the jurisdiction-appropriate template, logs it as a legal action, and notifies the landlord. Only use this when escalation is warranted by the situation (e.g., persistent rent arrears, lease violation). This is a serious action — ensure it is appropriate before calling.',
    input_schema: {
      type: 'object' as const,
      properties: {
        lease_id: {
          type: 'string',
          description: 'The lease ID for this tenancy.',
        },
        notice_type: {
          type: 'string',
          enum: [
            'formal_notice',
            'section_8',
            'section_21',
            'payment_demand',
            'lease_violation_notice',
            'payment_plan_agreement',
          ],
          description:
            'The type of legal notice to issue. section_8 = rent arrears eviction notice, section_21 = no-fault eviction notice, payment_demand = formal payment demand letter, formal_notice = general formal written warning.',
        },
        reason: {
          type: 'string',
          description:
            'Brief explanation of why this notice is being issued. This is logged as agent_reasoning.',
        },
      },
      required: ['lease_id', 'notice_type', 'reason'],
    },
  },
  {
    name: 'update_escalation_level',
    description:
      'Updates the escalation level for this tenancy (1=Conversational, 2=Formal Written, 3=Legal Process, 4=Pre-Tribunal). Use this when the situation warrants a change in escalation — either escalating due to non-compliance or de-escalating when issues are resolved.',
    input_schema: {
      type: 'object' as const,
      properties: {
        lease_id: {
          type: 'string',
          description: 'The lease ID for this tenancy.',
        },
        new_level: {
          type: 'number',
          enum: [1, 2, 3, 4],
          description:
            'The new escalation level: 1=Conversational, 2=Formal Written, 3=Legal Process, 4=Pre-Tribunal.',
        },
        reason: {
          type: 'string',
          description: 'Reason for the escalation level change. This is permanently logged.',
        },
      },
      required: ['lease_id', 'new_level', 'reason'],
    },
  },
]

export type ToolName = 'get_rent_status' | 'schedule_maintenance' | 'issue_legal_notice' | 'update_escalation_level'

export interface ToolInput {
  get_rent_status: { lease_id: string }
  schedule_maintenance: {
    lease_id: string
    category: string
    description: string
    urgency: 'emergency' | 'high' | 'routine'
  }
  issue_legal_notice: {
    lease_id: string
    notice_type: string
    reason: string
  }
  update_escalation_level: {
    lease_id: string
    new_level: number
    reason: string
  }
}
