import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import type { AIAnalysis, AutoApprovalPolicy } from '@/types';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const MAINTENANCE_SYSTEM_PROMPT = `You are an expert property maintenance operations manager.

Analyze the tenant issue and determine whether professional intervention is required.

Emergency includes flooding, fire risk, gas smell, major electrical hazard, no heat in winter.

If specialized tools or licensed expertise are required, vendor_required must be true.

If issue is cosmetic or safely tenant-resolvable, vendor_required must be false.

Return only valid JSON.`;

// Maps AI-returned categories to the valid DB enum values
const CATEGORY_MAP: Record<string, 'plumbing' | 'electrical' | 'structural' | 'appliance' | 'heating' | 'pest' | 'damp' | 'access' | 'other'> = {
  plumbing: 'plumbing',
  electrical: 'electrical',
  structural: 'structural',
  appliance: 'appliance',
  heating: 'heating',
  hvac: 'heating',       // Claude often returns 'hvac' — map to 'heating'
  pest: 'pest',
  damp: 'damp',
  access: 'access',
  cosmetic: 'other',     // 'cosmetic' is not in DB enum — map to 'other'
  other: 'other',
};

function normalizeCategory(raw: string) {
  return CATEGORY_MAP[raw.toLowerCase()] ?? 'other';
}

function getRuleBasedAnalysis(description: string): AIAnalysis {
  const lower = description.toLowerCase();

  let category = 'other';
  let vendorRequired = true;

  if (/leak|flood|pipe|water|drain|toilet|faucet|shower|sewage/.test(lower)) {
    category = 'plumbing';
  } else if (/electric|power|outlet|circuit|fuse|wiring|switch|sparks/.test(lower)) {
    category = 'electrical';
  } else if (/heat|hvac|ac|air.condition|boiler|radiator|furnace|thermostat/.test(lower)) {
    category = 'heating';
  } else if (/appliance|fridge|oven|dishwash|washing.machine|dryer|microwave/.test(lower)) {
    category = 'appliance';
  } else if (/crack|wall|ceiling|floor|roof|structural/.test(lower)) {
    category = 'structural';
  } else if (/pest|mouse|rat|cockroach|insect|bug|rodent/.test(lower)) {
    category = 'pest';
  } else if (/damp|mould|mold|moisture|condensation/.test(lower)) {
    category = 'damp';
  } else if (/lock|key|door|window|access|entry/.test(lower)) {
    category = 'access';
  } else if (/paint|scuff|scratch|cosmetic|touch.up/.test(lower)) {
    category = 'other';
    vendorRequired = false;
  }

  let urgency: AIAnalysis['urgency'] = 'medium';
  if (/emergency|flood|fire|gas.smell|sparks|no.heat|electric.shock|hazard/.test(lower)) {
    urgency = 'emergency';
  } else if (/urgent|serious|severe|major|bad.leak|sewage|toxic|dangerous/.test(lower)) {
    urgency = 'high';
  } else if (/minor|small|little|slight|cosmetic/.test(lower)) {
    urgency = 'low';
  }

  let estimated_cost_range: AIAnalysis['estimated_cost_range'] = 'medium';
  if (urgency === 'low' || !vendorRequired) estimated_cost_range = 'low';
  if (category === 'structural' || urgency === 'emergency') estimated_cost_range = 'high';

  return {
    category,
    urgency,
    estimated_cost_range,
    vendor_required: vendorRequired,
    reasoning: `Rule-based analysis: ${category} issue detected with ${urgency} urgency. ${vendorRequired ? 'Professional intervention recommended based on issue type.' : 'Tenant may be able to resolve this independently.'}`,
    confidence_score: 0.65,
  };
}

const COST_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };
const COST_LABEL: Record<string, string> = {
  low: '< €200',
  medium: '€200–€800',
  high: '> €800',
};

function checkAutoApproval(policy: AutoApprovalPolicy, analysis: AIAnalysis): boolean {
  if (!policy.enabled) return false;
  if (analysis.confidence_score < policy.minConfidence) return false;
  if ((COST_RANK[analysis.estimated_cost_range] ?? 2) > (COST_RANK[policy.maxCostRange] ?? 1))
    return false;
  if (policy.excludeEmergency && analysis.urgency === 'emergency') return false;
  return true;
}

async function generateVendorMessage(analysis: AIAnalysis): Promise<string> {
  const fallback = `Dear Contractor,

We have a ${analysis.urgency} urgency ${analysis.category} maintenance request requiring your immediate attention.

Issue Summary: ${analysis.reasoning}

Please confirm your availability and provide an estimated time of arrival (ETA).

Thank you for your prompt attention.

Best regards,
Property Management`;

  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      temperature: 0.3 as any,
      messages: [
        {
          role: 'user',
          content: `Write a professional, concise vendor outreach message for this maintenance issue. Category: ${analysis.category}, Urgency: ${analysis.urgency}, Context: ${analysis.reasoning}. Do not include a subject line. Return only the message body.`,
        },
      ],
    });
    const content = resp.content[0];
    return content.type === 'text' && content.text.trim() ? content.text.trim() : fallback;
  } catch {
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lease_id, description, auto_approval_policy } = await request.json();

    if (!lease_id || !description) {
      return NextResponse.json(
        { error: 'lease_id and description are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const policy: AutoApprovalPolicy | null = auto_approval_policy ?? null;

    // ── 1. AI Analysis ────────────────────────────────────────────────────────
    let aiAnalysis: AIAnalysis;

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    console.log('[AI analysis] ANTHROPIC_API_KEY present:', !!apiKey, 'length:', apiKey?.length ?? 0);

    if (apiKey) {
      const anthropic = new Anthropic({ apiKey });
      let parsed: AIAnalysis | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            temperature: 0.1 as any,
            system: MAINTENANCE_SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: `Analyze this maintenance issue and return ONLY a JSON object with no additional text:

Tenant description: "${description}"

Required JSON format:
{
  "category": "<plumbing|electrical|heating|appliance|structural|pest|damp|access|other>",
  "urgency": "<low|medium|high|emergency>",
  "estimated_cost_range": "<low|medium|high>",
  "vendor_required": <true|false>,
  "reasoning": "<brief explanation>",
  "confidence_score": <0.0-1.0>
}`,
              },
            ],
          });

          const content = response.content[0];
          if (content.type === 'text') {
            const jsonMatch = content.text.trim().match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const candidate = JSON.parse(jsonMatch[0]);
              if (
                candidate.category &&
                candidate.urgency &&
                typeof candidate.vendor_required === 'boolean'
              ) {
                parsed = candidate as AIAnalysis;
                break;
              }
            }
          }
        } catch (err: any) {
          console.error(`[AI analysis] attempt ${attempt + 1} failed:`, err?.message ?? err);
          if (attempt === 2) break;
        }
      }

      if (!parsed) {
        console.warn('[AI analysis] All attempts failed, falling back to rule-based analysis');
      }
      aiAnalysis = parsed ?? getRuleBasedAnalysis(description);
    } else {
      aiAnalysis = getRuleBasedAnalysis(description);
    }

    // ── 2. Create maintenance_request ────────────────────────────────────────
    const dbUrgency: 'emergency' | 'high' | 'routine' =
      aiAnalysis.urgency === 'emergency'
        ? 'emergency'
        : aiAnalysis.urgency === 'high'
          ? 'high'
          : 'routine';

    const { data: maintenanceRequest, error: requestError } = await supabase
      .from('maintenance_requests')
      .insert({
        lease_id,
        description,
        category: normalizeCategory(aiAnalysis.category),
        urgency: dbUrgency,
        status: 'open',
      })
      .select()
      .single();

    if (requestError) throw requestError;

    // ── 3. Create maintenance_workflow at SUBMITTED ───────────────────────────
    const { data: workflow, error: workflowError } = await supabase
      .from('maintenance_workflows')
      .insert({
        maintenance_request_id: maintenanceRequest.id,
        current_state: 'SUBMITTED',
        ai_analysis: aiAnalysis as any,
        state_history: [] as any,
      })
      .select()
      .single();

    if (workflowError) throw workflowError;

    // Tenant submission communication
    await supabase.from('workflow_communications').insert({
      workflow_id: workflow.id,
      sender_type: 'tenant',
      sender_name: 'Tenant',
      message: description,
      metadata: { type: 'initial_submission' } as any,
    });

    // AI analysis communication
    await supabase.from('workflow_communications').insert({
      workflow_id: workflow.id,
      sender_type: 'system',
      sender_name: 'AI System',
      message: `AI Analysis Complete: ${aiAnalysis.urgency.toUpperCase()} urgency ${aiAnalysis.category} issue. ${aiAnalysis.reasoning} Estimated cost: ${COST_LABEL[aiAnalysis.estimated_cost_range] ?? aiAnalysis.estimated_cost_range}. Vendor required: ${aiAnalysis.vendor_required ? 'Yes' : 'No'}. Confidence: ${Math.round(aiAnalysis.confidence_score * 100)}%.`,
      metadata: { type: 'ai_analysis_complete', ai_analysis: aiAnalysis } as any,
    });

    // ── 4. Check auto-approval policy ─────────────────────────────────────────
    const autoApproved = policy ? checkAutoApproval(policy, aiAnalysis) : false;

    if (autoApproved && policy) {
      // ── AUTO-APPROVAL PATH ─────────────────────────────────────────────────
      const confidencePct = Math.round(aiAnalysis.confidence_score * 100);
      const thresholdPct = Math.round(policy.minConfidence * 100);

      // Transition → OWNER_NOTIFIED (audit trail, then immediately through)
      await supabase
        .from('maintenance_workflows')
        .update({ current_state: 'OWNER_NOTIFIED' })
        .eq('id', workflow.id);

      // Auto-approval decision communication
      await supabase.from('workflow_communications').insert({
        workflow_id: workflow.id,
        sender_type: 'system',
        sender_name: 'AI System',
        message: `AUTO-APPROVED by landlord policy. AI confidence ${confidencePct}% ≥ threshold ${thresholdPct}%. Estimated cost ${COST_LABEL[aiAnalysis.estimated_cost_range]} is within the ${COST_LABEL[policy.maxCostRange]} limit. ${aiAnalysis.urgency === 'emergency' ? '' : ''}Proceeding automatically — no owner input required.`,
        metadata: {
          type: 'auto_approved',
          auto_approved: true,
          confidence: aiAnalysis.confidence_score,
          threshold: policy.minConfidence,
          cost_range: aiAnalysis.estimated_cost_range,
        } as any,
      });

      // Transition → DECISION_MADE, recording auto-approval as owner response
      await supabase
        .from('maintenance_workflows')
        .update({
          current_state: 'DECISION_MADE',
          owner_response: 'approved',
          owner_message: `Auto-approved by policy (${confidencePct}% confidence, ${COST_LABEL[aiAnalysis.estimated_cost_range]} cost)`,
        })
        .eq('id', workflow.id);

      await supabase.from('workflow_communications').insert({
        workflow_id: workflow.id,
        sender_type: 'system',
        sender_name: 'AI System',
        message: `Decision: ${aiAnalysis.vendor_required ? 'Vendor intervention required — initiating outreach automatically.' : 'No vendor required — tenant resolution guidance sent.'}`,
        metadata: { type: 'decision_made', auto_approved: true } as any,
      });

      if (aiAnalysis.vendor_required) {
        const vendorMessage = await generateVendorMessage(aiAnalysis);

        await supabase
          .from('maintenance_workflows')
          .update({ current_state: 'VENDOR_CONTACTED', vendor_message: vendorMessage })
          .eq('id', workflow.id);

        await supabase.from('workflow_communications').insert({
          workflow_id: workflow.id,
          sender_type: 'system',
          sender_name: 'AI System',
          message: 'Vendor outreach message generated and sent automatically. Awaiting vendor ETA confirmation.',
          metadata: { type: 'vendor_contacted', vendor_message: vendorMessage, auto_approved: true } as any,
        });

        await supabase
          .from('maintenance_workflows')
          .update({ current_state: 'AWAITING_VENDOR_RESPONSE' })
          .eq('id', workflow.id);

        return NextResponse.json({
          success: true,
          workflow_id: workflow.id,
          request_id: maintenanceRequest.id,
          ai_analysis: aiAnalysis,
          auto_approved: true,
          current_state: 'AWAITING_VENDOR_RESPONSE',
        });
      } else {
        // No vendor — straight to IN_PROGRESS
        await supabase
          .from('maintenance_workflows')
          .update({ current_state: 'IN_PROGRESS' })
          .eq('id', workflow.id);

        await supabase
          .from('maintenance_requests')
          .update({ status: 'in_progress' })
          .eq('id', maintenanceRequest.id);

        await supabase.from('workflow_communications').insert({
          workflow_id: workflow.id,
          sender_type: 'system',
          sender_name: 'AI System',
          message: 'No vendor required. Self-resolution guidance sent to tenant. Issue now in progress.',
          metadata: { type: 'in_progress_no_vendor', auto_approved: true } as any,
        });

        return NextResponse.json({
          success: true,
          workflow_id: workflow.id,
          request_id: maintenanceRequest.id,
          ai_analysis: aiAnalysis,
          auto_approved: true,
          current_state: 'IN_PROGRESS',
        });
      }
    }

    // ── NORMAL PATH: notify owner and wait ────────────────────────────────────
    await supabase
      .from('maintenance_workflows')
      .update({ current_state: 'OWNER_NOTIFIED' })
      .eq('id', workflow.id);

    // Explain why auto-approval was NOT triggered (if policy is active)
    let ownerMessage = `Property owner notified. Awaiting approval or denial to proceed with ${aiAnalysis.vendor_required ? 'vendor coordination' : 'resolution guidance'}.`;

    if (policy?.enabled && !autoApproved) {
      const reasons: string[] = [];
      if (aiAnalysis.confidence_score < policy.minConfidence)
        reasons.push(
          `confidence ${Math.round(aiAnalysis.confidence_score * 100)}% < threshold ${Math.round(policy.minConfidence * 100)}%`
        );
      if ((COST_RANK[aiAnalysis.estimated_cost_range] ?? 2) > (COST_RANK[policy.maxCostRange] ?? 1))
        reasons.push(
          `estimated cost (${COST_LABEL[aiAnalysis.estimated_cost_range]}) exceeds auto-approve limit (${COST_LABEL[policy.maxCostRange]})`
        );
      if (policy.excludeEmergency && aiAnalysis.urgency === 'emergency')
        reasons.push('emergency urgency always requires owner review');

      ownerMessage = `Owner review required — auto-approval policy did not trigger: ${reasons.join('; ')}. Property owner notified and awaiting decision.`;
    }

    await supabase.from('workflow_communications').insert({
      workflow_id: workflow.id,
      sender_type: 'system',
      sender_name: 'AI System',
      message: ownerMessage,
      metadata: { type: 'owner_notified', policy_active: policy?.enabled ?? false } as any,
    });

    return NextResponse.json({
      success: true,
      workflow_id: workflow.id,
      request_id: maintenanceRequest.id,
      ai_analysis: aiAnalysis,
      auto_approved: false,
      current_state: 'OWNER_NOTIFIED',
    });
  } catch (error: any) {
    console.error('Maintenance submit error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
