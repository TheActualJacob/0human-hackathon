import { MaintenanceTicket, Vendor, Tenant, Lease } from "@/types";

// Simulated AI confidence levels
const getConfidenceLevel = (min: number = 70, max: number = 98): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Simulate processing delay
export const simulateProcessing = async (delayMs: number = 1500): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, delayMs));
};

// Classify maintenance issues based on description
export const classifyMaintenanceIssue = (description: string): {
  category: MaintenanceTicket['category'];
  urgency: MaintenanceTicket['urgency'];
  confidence: number;
  reasoning: string;
} => {
  const desc = description.toLowerCase();
  
  // Category classification rules
  const categoryRules: Record<MaintenanceTicket['category'], string[]> = {
    plumbing: ['leak', 'water', 'pipe', 'drain', 'sink', 'toilet', 'faucet', 'shower', 'plumbing'],
    electrical: ['light', 'outlet', 'switch', 'power', 'electricity', 'circuit', 'breaker', 'wire'],
    hvac: ['heat', 'cold', 'air', 'ac', 'temperature', 'thermostat', 'furnace', 'cooling', 'heating'],
    appliance: ['refrigerator', 'stove', 'dishwasher', 'washer', 'dryer', 'oven', 'microwave', 'appliance'],
    emergency: ['flooding', 'fire', 'gas', 'emergency', 'urgent', 'immediate'],
    general: []
  };
  
  let category: MaintenanceTicket['category'] = 'general';
  let matchedKeywords: string[] = [];
  
  // Find the best category match
  for (const [cat, keywords] of Object.entries(categoryRules)) {
    const matches = keywords.filter(keyword => desc.includes(keyword));
    if (matches.length > matchedKeywords.length) {
      category = cat as MaintenanceTicket['category'];
      matchedKeywords = matches;
    }
  }
  
  // Urgency classification
  let urgency: MaintenanceTicket['urgency'] = 'medium';
  
  if (desc.includes('emergency') || desc.includes('urgent') || desc.includes('immediate')) {
    urgency = 'emergency';
  } else if (desc.includes('flooding') || desc.includes('no power') || desc.includes('gas leak')) {
    urgency = 'emergency';
  } else if (desc.includes('leak') || desc.includes('broken') || desc.includes('not working')) {
    urgency = 'high';
  } else if (desc.includes('minor') || desc.includes('small') || desc.includes('slight')) {
    urgency = 'low';
  }
  
  const confidence = getConfidenceLevel(80, 95);
  const reasoning = `Analyzed description and identified keywords: ${matchedKeywords.join(', ')}. ` +
                   `Classified as ${category} issue with ${urgency} priority based on severity indicators.`;
  
  return { category, urgency, confidence, reasoning };
};

// Select optimal vendor for a maintenance issue
export const selectOptimalVendor = (
  ticket: MaintenanceTicket,
  vendors: Vendor[]
): {
  vendorId: string;
  confidence: number;
  reasoning: string;
} | null => {
  // Filter available vendors with matching specialty
  const eligibleVendors = vendors.filter(vendor => 
    vendor.isAvailable && 
    (vendor.specialty.includes(ticket.category || '') || 
     (ticket.urgency === 'emergency' && vendor.specialty.includes('emergency')))
  );
  
  if (eligibleVendors.length === 0) return null;
  
  // Score vendors based on multiple factors
  const scoredVendors = eligibleVendors.map(vendor => {
    let score = 0;
    
    // Response time (higher weight for urgent tickets)
    const responseWeight = ticket.urgency === 'emergency' ? 40 : 
                          ticket.urgency === 'high' ? 30 : 20;
    score += (5 - vendor.avgResponseTime) * responseWeight;
    
    // AI performance score
    score += vendor.aiPerformanceScore * 0.3;
    
    // Rating
    score += vendor.rating * 10;
    
    // Cost efficiency (inverse relationship)
    score += (500 - vendor.avgCost) * 0.05;
    
    return { vendor, score };
  });
  
  // Sort by score and select the best
  scoredVendors.sort((a, b) => b.score - a.score);
  const selected = scoredVendors[0].vendor;
  
  const confidence = getConfidenceLevel(85, 95);
  const reasoning = `Selected ${selected.name} based on: ` +
                   `${selected.avgResponseTime}h response time, ` +
                   `${selected.rating}/5 rating, ` +
                   `${selected.aiPerformanceScore}% AI score. ` +
                   `Best match for ${ticket.urgency} ${ticket.category} issue.`;
  
  return {
    vendorId: selected.id,
    confidence,
    reasoning
  };
};

// Calculate tenant risk score
export const calculateTenantRiskScore = (
  tenant: Tenant,
  paymentHistory: { late: number; onTime: number; total: number },
  maintenanceRequests: number,
  leaseViolations: number = 0
): {
  score: number;
  factors: string[];
  recommendation: string;
} => {
  let score = 0;
  const factors: string[] = [];
  
  // Payment history (40% weight)
  const paymentScore = (paymentHistory.onTime / paymentHistory.total) * 40;
  score += paymentScore;
  
  if (paymentHistory.late > 2) {
    factors.push(`${paymentHistory.late} late payments`);
  }
  
  // Maintenance requests (20% weight)
  const maintenanceScore = Math.max(0, 20 - (maintenanceRequests * 2));
  score += maintenanceScore;
  
  if (maintenanceRequests > 5) {
    factors.push('High maintenance requests');
  }
  
  // Lease violations (20% weight)
  const violationScore = Math.max(0, 20 - (leaseViolations * 10));
  score += violationScore;
  
  if (leaseViolations > 0) {
    factors.push(`${leaseViolations} lease violations`);
  }
  
  // Tenure bonus (20% weight)
  const tenureMonths = Math.floor((Date.now() - tenant.moveInDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
  const tenureScore = Math.min(20, tenureMonths * 0.5);
  score += tenureScore;
  
  // Invert score (lower is better for risk)
  const riskScore = Math.max(0, Math.min(100, 100 - score));
  
  let recommendation = 'Low risk tenant';
  if (riskScore > 70) {
    recommendation = 'High risk - Consider non-renewal';
  } else if (riskScore > 40) {
    recommendation = 'Medium risk - Monitor closely';
  }
  
  return { score: riskScore, factors, recommendation };
};

// Generate lease renewal recommendation
export const generateRenewalRecommendation = (
  lease: Lease,
  tenant: Tenant,
  marketRate: number,
  riskScore: number
): {
  renewalProbability: number;
  suggestedIncrease: number;
  reasoning: string;
} => {
  let renewalProbability = 100;
  let suggestedIncrease = 3; // Default 3% increase
  const reasons: string[] = [];
  
  // Risk score impact
  if (riskScore > 70) {
    renewalProbability -= 60;
    suggestedIncrease = 0;
    reasons.push('High risk tenant');
  } else if (riskScore > 40) {
    renewalProbability -= 20;
    suggestedIncrease = 2;
    reasons.push('Medium risk profile');
  }
  
  // Payment status impact
  if (tenant.paymentStatus === 'late' || tenant.paymentStatus === 'pending') {
    renewalProbability -= 15;
    suggestedIncrease = Math.max(0, suggestedIncrease - 1);
    reasons.push('Current payment issues');
  }
  
  // Market rate comparison
  const currentVsMarket = ((lease.monthlyRent - marketRate) / marketRate) * 100;
  if (currentVsMarket < -10) {
    suggestedIncrease = 5; // Below market
    reasons.push('Below market rate');
  } else if (currentVsMarket > 10) {
    suggestedIncrease = 0; // Above market
    renewalProbability -= 10;
    reasons.push('Above market rate');
  }
  
  // Long-term tenant bonus
  const tenureMonths = Math.floor((Date.now() - tenant.moveInDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
  if (tenureMonths > 24) {
    renewalProbability += 10;
    reasons.push('Long-term tenant');
  }
  
  renewalProbability = Math.max(0, Math.min(100, renewalProbability));
  
  const reasoning = reasons.length > 0 ? 
    `Based on: ${reasons.join(', ')}` : 
    'Standard renewal recommendation';
  
  return {
    renewalProbability,
    suggestedIncrease,
    reasoning
  };
};

// Generate activity log message
export const generateActivityMessage = (
  type: string,
  action: string,
  details: any
): string => {
  const templates: Record<string, string[]> = {
    maintenance: [
      'AI classified ${issue} as ${category} priority',
      'Vendor ${vendor} assigned to ticket #${id}',
      'Maintenance cost estimate: $${cost}',
      'Issue resolved by ${vendor} in ${time} hours'
    ],
    rent: [
      'Rent reminder sent to ${tenant} at Unit ${unit}',
      'Late fee of $${amount} applied to ${tenant}',
      'Payment received from ${tenant} - $${amount}',
      'AI detected ${count} late payments this month'
    ],
    lease: [
      'Lease expiring in ${days} days for Unit ${unit}',
      'AI recommends ${probability}% renewal chance',
      'Suggested rent increase: ${increase}%',
      'Lease renewed for ${tenant} at Unit ${unit}'
    ],
    vendor: [
      'Vendor ${name} performance score: ${score}%',
      '${name} completed ${count} jobs this month',
      'Average response time improved to ${time} hours',
      'New vendor ${name} added to system'
    ]
  };
  
  const typeTemplates = templates[type] || ['System activity logged'];
  const template = typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
  
  // Simple template replacement
  let message = template;
  Object.entries(details).forEach(([key, value]) => {
    message = message.replace(`\${${key}}`, value);
  });
  
  return message;
};