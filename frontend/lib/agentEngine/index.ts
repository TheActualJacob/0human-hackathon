import type { Contractor } from '@/types';

export function classifyMaintenanceIssue(description: string): {
  category: string;
  urgency: string;
  confidence: number;
} {
  const lower = description.toLowerCase();

  let category = 'other';
  if (/leak|flood|pipe|water|drain|toilet|faucet|shower|sewage/.test(lower)) category = 'plumbing';
  else if (/electric|power|outlet|circuit|fuse|wiring|switch|sparks/.test(lower)) category = 'electrical';
  else if (/heat|hvac|ac|air.condition|boiler|radiator|furnace|thermostat/.test(lower)) category = 'heating';
  else if (/appliance|fridge|oven|dishwash|washing.machine|dryer|microwave/.test(lower)) category = 'appliance';
  else if (/crack|wall|ceiling|floor|roof|foundation|structural|damp|mould/.test(lower)) category = 'structural';
  else if (/pest|mouse|rat|cockroach|insect|bug|rodent|infestation/.test(lower)) category = 'pest';
  else if (/paint|scuff|scratch|cosmetic|touch.up|mark|stain/.test(lower)) category = 'cosmetic';

  let urgency = 'routine';
  if (/emergency|flood|fire|gas.smell|sparks|no.heat|electric.shock|hazard/.test(lower)) urgency = 'emergency';
  else if (/urgent|serious|severe|major|bad.leak|sewage|toxic|dangerous/.test(lower)) urgency = 'high';

  return { category, urgency, confidence: 0.85 };
}

export function selectOptimalVendor(
  criteria: { category: string; urgency: string },
  contractors: Contractor[]
): { vendorId: string; confidence: number } | null {
  if (!contractors.length) return null;

  const specialized = contractors.filter((c) => {
    const trades = (c as any).trades ?? (c as any).specializations ?? [];
    return (
      Array.isArray(trades) &&
      trades.some((t: string) => t.toLowerCase().includes(criteria.category.toLowerCase()))
    );
  });

  if (criteria.urgency === 'emergency') {
    const emergency = [...(specialized.length ? specialized : contractors)].filter(
      (c) => (c as any).emergency_available
    );
    if (emergency.length) return { vendorId: emergency[0].id, confidence: 0.92 };
  }

  const pool = specialized.length ? specialized : contractors;
  const sorted = [...pool].sort((a, b) => ((b as any).rating ?? 0) - ((a as any).rating ?? 0));
  return { vendorId: sorted[0].id, confidence: 0.82 };
}

export function simulateProcessing(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
