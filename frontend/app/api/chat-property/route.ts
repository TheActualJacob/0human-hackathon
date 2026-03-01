import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface PropertySummary {
  id: string;
  address: string;
  city: string;
  rent: number | null;
  beds: number | null;
  baths: number | null;
  petFriendly: boolean;
  hasParking: boolean;
  furnished: string | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UnitRow {
  id: string;
  address?: string | null;
  city?: string | null;
  rent_amount?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  unit_attributes?: {
    bedrooms?: number | null;
    bathrooms?: number | null;
    pet_policy?: string | null;
    has_parking?: boolean | null;
    furnished_status?: string | null;
  } | null;
}

function summariseProperties(properties: UnitRow[]): PropertySummary[] {
  return properties.map(u => ({
    id: u.id,
    address: [u.address, u.city].filter(Boolean).join(', '),
    city: u.city ?? '',
    rent: u.rent_amount ?? null,
    beds: u.unit_attributes?.bedrooms ?? u.bedrooms ?? null,
    baths: u.unit_attributes?.bathrooms ?? u.bathrooms ?? null,
    petFriendly: u.unit_attributes?.pet_policy !== 'not_allowed',
    hasParking: u.unit_attributes?.has_parking ?? false,
    furnished: u.unit_attributes?.furnished_status ?? null,
  }));
}

const SYSTEM_PROMPT = `You are a friendly property search assistant helping users find rental properties. You have access to the full list of available properties.

When a user describes what they're looking for, read through every property in the list and pick the ones that best match. Respond with a JSON object (and nothing else) in this exact format:
{
  "message": "A friendly 1-2 sentence response summarising what you found or asking a clarifying question",
  "propertyIds": ["exact IDs of every property that matches the user's request"]
}

Rules:
- propertyIds must only contain IDs that appear in the provided property list.
- Include ALL properties that genuinely match — don't arbitrarily cap the list.
- If the user is just saying hello or asking a general question with no specific criteria, return propertyIds as null (not an empty array).
- If no properties match, return an empty array [] and say so kindly, suggesting they relax their criteria.
- Be generous with partial matches — if someone says "2 bed" and a property has 2 beds, include it even if other details differ.
- Always respond with valid JSON only — no markdown, no code fences, no extra text.`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI chat not configured' },
        { status: 503 }
      );
    }

    const { messages, properties } = await request.json() as {
      messages: ChatMessage[];
      properties: UnitRow[];
    };

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    const summaries = summariseProperties(properties ?? []);
    const propertyContext = summaries.length
      ? `AVAILABLE PROPERTIES (${summaries.length} total):\n` +
        summaries.map(p =>
          `- ID:${p.id} | ${p.address} | £${p.rent ?? '?'}/mo | ${p.beds ?? '?'} bed | ${p.baths ?? '?'} bath` +
          `${p.petFriendly ? ' | pets ok' : ''}${p.hasParking ? ' | parking' : ''}${p.furnished ? ` | ${p.furnished}` : ''}`
        ).join('\n')
      : 'No properties currently available.';

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `${SYSTEM_PROMPT}\n\n${propertyContext}`,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';

    let parsed: { message: string; propertyIds?: string[] | null };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { message: raw, propertyIds: null };
    } catch {
      parsed = { message: raw, propertyIds: null };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('chat-property error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat', message: 'Sorry, something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
