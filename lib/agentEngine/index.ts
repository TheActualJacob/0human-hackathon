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
  category: MaintenanceTicket['category'] | string;
  urgency: MaintenanceTicket['urgency'] | string;
  confidence: number;
  reasoning: string;
} => {
  const desc = description.toLowerCase();
  
  // Category classification rules
  const categoryRules: Record<string, string[]> = {
    plumbing: ['leak', 'water', 'pipe', 'drain', 'sink', 'toilet', 'faucet', 'shower', 'plumbing', 'tap'],
    electrical: ['light', 'outlet', 'switch', 'power', 'electricity', 'circuit', 'breaker', 'wire', 'socket'],
    heating: ['heat', 'cold', 'boiler', 'radiator', 'temperature', 'thermostat', 'furnace', 'heating'],
    appliance: ['refrigerator', 'fridge', 'stove', 'dishwasher', 'washer', 'dryer', 'oven', 'microwave'],
    structural: ['wall', 'ceiling', 'floor', 'roof', 'window', 'door', 'crack', 'foundation'],
    pest: ['pest', 'rat', 'mouse', 'insect', 'bug', 'cockroach', 'ant', 'infestation'],
    damp: ['damp', 'mould', 'mold', 'moisture', 'condensation', 'wet'],
    access: ['lock', 'key', 'access', 'entry', 'security', 'alarm'],
    other: []
  };
  
  let category: string = 'other';
  let matchedKeywords: string[] = [];
  
  // Find the best category match
  for (const [cat, keywords] of Object.entries(categoryRules)) {
    const matches = keywords.filter(keyword => desc.includes(keyword));
    if (matches.length > matchedKeywords.length) {
      category = cat;
      matchedKeywords = matches;
    }
  }
  
  // Urgency classification
  let urgency: string = 'routine';
  
  if (desc.includes('emergency') || desc.includes('urgent') || desc.includes('immediate')) {
    urgency = 'emergency';
  } else if (desc.includes('flooding') || desc.includes('no power') || desc.includes('gas leak') || 
             desc.includes('no heating') || desc.includes('no hot water')) {
    urgency = 'emergency';
  } else if (desc.includes('leak') || desc.includes('broken') || desc.includes('not working') ||
             desc.includes('dangerous')) {
    urgency = 'high';
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

// Classify WhatsApp message intent
export const classifyWhatsAppIntent = (message: string): {
  intent: 'maintenance' | 'payment' | 'lease' | 'complaint' | 'query' | 'other';
  urgency: 'low' | 'medium' | 'high';
  suggestedResponse?: string;
  confidence: number;
} => {
  const msg = message.toLowerCase();
  
  // Intent patterns
  const intents = {
    maintenance: ['repair', 'broken', 'fix', 'not working', 'leak', 'problem', 'issue'],
    payment: ['rent', 'payment', 'pay', 'late fee', 'arrears', 'owe', 'bill'],
    lease: ['lease', 'contract', 'renewal', 'extend', 'terminate', 'notice'],
    complaint: ['complaint', 'unhappy', 'disgusted', 'terrible', 'awful', 'unacceptable'],
    query: ['when', 'what', 'where', 'how', 'why', 'can i', 'is it', 'do you']
  };
  
  let intent: keyof typeof intents | 'other' = 'other';
  let matchCount = 0;
  
  for (const [key, patterns] of Object.entries(intents)) {
    const matches = patterns.filter(pattern => msg.includes(pattern)).length;
    if (matches > matchCount) {
      intent = key as keyof typeof intents;
      matchCount = matches;
    }
  }
  
  // Urgency detection
  let urgency: 'low' | 'medium' | 'high' = 'medium';
  if (msg.includes('urgent') || msg.includes('emergency') || msg.includes('asap')) {
    urgency = 'high';
  } else if (msg.includes('when you can') || msg.includes('no rush')) {
    urgency = 'low';
  }
  
  // Suggested responses
  const responses: Record<string, string> = {
    maintenance: "I've logged your maintenance request and will assign a contractor shortly. You'll receive confirmation via WhatsApp.",
    payment: "I can help with your payment query. Let me check your account details.",
    lease: "I'll review your lease information and get back to you within 24 hours.",
    complaint: "I understand your concern. I've escalated this to the property manager for immediate attention.",
    query: "Let me find that information for you.",
    other: "Thank you for your message. I'll ensure the right person handles this."
  };
  
  return {
    intent: intent as any,
    urgency,
    suggestedResponse: responses[intent],
    confidence: getConfidenceLevel(75, 90)
  };
};

// Recommend legal action based on situation
export const recommendLegalAction = (situation: {
  type: 'rent_arrears' | 'property_damage' | 'lease_violation' | 'eviction';
  severity: 'minor' | 'moderate' | 'severe';
  daysOverdue?: number;
  amount?: number;
  previousActions?: number;
}): {
  action: string;
  documentType: string;
  reasoning: string;
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
} => {
  let action = '';
  let documentType = '';
  let reasoning = '';
  let urgency: 'low' | 'medium' | 'high' = 'medium';
  
  if (situation.type === 'rent_arrears') {
    if (situation.daysOverdue && situation.daysOverdue > 60) {
      action = 'Issue Section 8 Notice';
      documentType = 'section_8';
      reasoning = `Tenant is ${situation.daysOverdue} days overdue with £${situation.amount} arrears. Legal action recommended.`;
      urgency = 'high';
    } else if (situation.daysOverdue && situation.daysOverdue > 30) {
      action = 'Send Payment Demand';
      documentType = 'payment_demand';
      reasoning = `Formal payment demand to recover £${situation.amount} before escalation.`;
      urgency = 'medium';
    } else {
      action = 'Offer Payment Plan';
      documentType = 'payment_plan_agreement';
      reasoning = 'Early intervention with payment plan can prevent legal escalation.';
      urgency = 'low';
    }
  } else if (situation.type === 'property_damage') {
    action = 'Issue Damage Notice';
    documentType = 'deposit_deduction_notice';
    reasoning = `Document property damage for potential deposit deduction or legal claim.`;
    urgency = situation.severity === 'severe' ? 'high' : 'medium';
  } else if (situation.type === 'lease_violation') {
    action = 'Send Lease Violation Notice';
    documentType = 'lease_violation_notice';
    reasoning = `Formal notice required to document breach and provide opportunity to remedy.`;
    urgency = situation.previousActions && situation.previousActions > 2 ? 'high' : 'medium';
  }
  
  return {
    action,
    documentType,
    reasoning,
    urgency,
    confidence: getConfidenceLevel(80, 92)
  };
};

// Detect chronic maintenance issues
export const detectChronicIssue = (
  requests: Array<{
    category: string;
    description: string;
    unit_id: string;
    created_at: string;
  }>
): {
  isChronicIssue: boolean;
  issueType?: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  pattern?: string;
  recommendation?: string;
} => {
  // Group by unit and category
  const unitIssues = new Map<string, Map<string, number>>();
  
  requests.forEach(req => {
    if (!unitIssues.has(req.unit_id)) {
      unitIssues.set(req.unit_id, new Map());
    }
    const categoryCount = unitIssues.get(req.unit_id)!;
    categoryCount.set(req.category, (categoryCount.get(req.category) || 0) + 1);
  });
  
  // Check for patterns
  let isChronicIssue = false;
  let issueType = '';
  let severity: 'minor' | 'moderate' | 'major' | 'critical' = 'minor';
  let pattern = '';
  let recommendation = '';
  
  unitIssues.forEach((categories, unitId) => {
    categories.forEach((count, category) => {
      if (count >= 3) {
        isChronicIssue = true;
        issueType = category;
        
        if (count >= 10) {
          severity = 'critical';
          pattern = `${count} ${category} issues in same unit`;
          recommendation = 'Immediate professional assessment required. Consider liability implications.';
        } else if (count >= 6) {
          severity = 'major';
          pattern = `Recurring ${category} problems`;
          recommendation = 'Schedule comprehensive inspection and remediation.';
        } else {
          severity = 'moderate';
          pattern = `Multiple ${category} reports`;
          recommendation = 'Monitor closely and consider preventive maintenance.';
        }
      }
    });
  });
  
  return {
    isChronicIssue,
    issueType,
    severity,
    pattern,
    recommendation
  };
};

// Calculate tenant risk score (updated for new schema)
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
  const paymentScore = paymentHistory.total > 0 
    ? (paymentHistory.onTime / paymentHistory.total) * 40 
    : 40;
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
  
  // WhatsApp responsiveness bonus (20% weight)
  // In real implementation, this would check conversation response times
  const communicationScore = 15; // Default good communication
  score += communicationScore;
  
  // Invert score (lower is better for risk)
  const riskScore = Math.max(0, Math.min(100, 100 - score));
  
  let recommendation = 'Low risk tenant - excellent standing';
  if (riskScore > 70) {
    recommendation = 'High risk - Consider non-renewal or legal action';
  } else if (riskScore > 40) {
    recommendation = 'Medium risk - Monitor closely and maintain communication';
  }
  
  return { score: riskScore, factors, recommendation };
};

// Prioritize landlord notifications
export const prioritizeLandlordNotification = (notification: {
  type: string;
  urgency?: string;
  amount?: number;
  daysOverdue?: number;
}): {
  priority: 'low' | 'medium' | 'high' | 'critical';
  sendImmediately: boolean;
  channel: 'email' | 'whatsapp' | 'both';
} => {
  let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  let sendImmediately = false;
  let channel: 'email' | 'whatsapp' | 'both' = 'email';
  
  // Critical notifications
  const criticalTypes = ['emergency_maintenance', 'legal_notice_issued', 'eviction_started'];
  if (criticalTypes.includes(notification.type)) {
    priority = 'critical';
    sendImmediately = true;
    channel = 'both';
  }
  
  // High priority
  const highTypes = ['dispute_ruled', 'tenant_vacated', 'compliance_expiry'];
  if (highTypes.includes(notification.type)) {
    priority = 'high';
    sendImmediately = true;
    channel = 'whatsapp';
  }
  
  // Medium priority with conditions
  if (notification.type === 'rent_overdue' && notification.daysOverdue) {
    if (notification.daysOverdue > 14) {
      priority = 'high';
      sendImmediately = true;
      channel = 'both';
    } else {
      priority = 'medium';
      channel = 'email';
    }
  }
  
  // Low priority
  const lowTypes = ['payment_received', 'general'];
  if (lowTypes.includes(notification.type)) {
    priority = 'low';
    channel = 'email';
  }
  
  return { priority, sendImmediately, channel };
};

// Generate activity log message (updated for new schema)
export const generateActivityMessage = (
  type: string,
  action: string,
  details: any
): string => {
  const templates: Record<string, string[]> = {
    maintenance: [
      'AI classified ${issue} as ${category} priority',
      'Contractor ${contractor} assigned to request #${id}',
      'Maintenance cost estimate: £${cost}',
      'Issue resolved by ${contractor} in ${time} hours',
      'Chronic issue detected: ${pattern}'
    ],
    payment: [
      'Payment reminder sent to ${tenant} at ${unit}',
      'Payment plan created: £${amount}/month for ${months} months',
      'Payment received from ${tenant} - £${amount}',
      'AI detected ${count} late payments this month'
    ],
    lease: [
      'Lease expiring in ${days} days for ${unit}',
      'AI recommends ${probability}% renewal chance',
      'Suggested rent adjustment: ${increase}%',
      'Lease renewed for ${tenant} at ${unit}'
    ],
    legal: [
      '${action} issued for ${tenant} at ${unit}',
      'Legal deadline approaching: ${days} days remaining',
      'Dispute ${status} - ${category}',
      'AI recommends: ${recommendation}'
    ],
    communication: [
      'WhatsApp: ${intent} message from ${tenant}',
      'AI response sent to ${tenant}',
      'Conversation escalated to landlord',
      'Urgent message flagged: ${summary}'
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