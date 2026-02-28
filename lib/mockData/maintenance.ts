import { MaintenanceTicket } from "@/types";

export const mockMaintenanceTickets: MaintenanceTicket[] = [
  {
    id: "ticket-1",
    tenantId: "2",
    tenantName: "Michael Chen",
    unit: "4B",
    title: "Water leak under kitchen sink",
    description: "There's water leaking under my sink. It started yesterday and is getting worse.",
    category: "plumbing",
    urgency: "high",
    status: "assigned",
    vendorId: "vendor-1",
    vendorName: "Quick Fix Plumbing",
    estimatedCost: 250,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    updatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    aiClassified: true,
    aiDecisions: [
      {
        timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
        action: "Issue Classification",
        reasoning: "Keywords 'water', 'leak', 'sink' indicate plumbing issue. Urgency set to high due to active leak.",
        confidence: 92
      },
      {
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        action: "Vendor Assignment",
        reasoning: "Quick Fix Plumbing selected based on fastest response time (1.2h avg) and plumbing specialty match",
        confidence: 88
      }
    ]
  },
  {
    id: "ticket-2",
    tenantId: "1",
    tenantName: "Sarah Johnson",
    unit: "2A",
    title: "AC not cooling properly",
    description: "The air conditioning unit is running but not cooling the apartment. Temperature stays at 78F.",
    category: "hvac",
    urgency: "medium",
    status: "open",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    aiClassified: true,
    aiDecisions: [
      {
        timestamp: new Date(Date.now() - 4.5 * 60 * 60 * 1000),
        action: "Issue Classification",
        reasoning: "Keywords 'AC', 'cooling', 'temperature' indicate HVAC issue. Medium urgency as unit is running.",
        confidence: 85
      }
    ]
  },
  {
    id: "ticket-3",
    tenantId: "5",
    tenantName: "Jessica Williams",
    unit: "10E",
    title: "Dishwasher making loud noise",
    description: "The dishwasher makes a grinding noise during the wash cycle. Still works but very loud.",
    category: "appliance",
    urgency: "low",
    status: "in_progress",
    vendorId: "vendor-3",
    vendorName: "AllTech Appliance Repair",
    estimatedCost: 175,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    aiClassified: true,
    aiDecisions: [
      {
        timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000),
        action: "Issue Classification",
        reasoning: "Keywords 'dishwasher', 'noise' indicate appliance issue. Low urgency as unit still functional.",
        confidence: 90
      }
    ]
  },
  {
    id: "ticket-4",
    tenantId: "6",
    tenantName: "Robert Martinez",
    unit: "12F",
    title: "No power in bedroom outlets",
    description: "All outlets in the master bedroom stopped working. Lights still work. This is urgent!",
    category: "electrical",
    urgency: "emergency",
    status: "assigned",
    vendorId: "vendor-2",
    vendorName: "PowerPro Electric",
    estimatedCost: 350,
    createdAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    updatedAt: new Date(Date.now() - 15 * 60 * 1000),
    aiClassified: true,
    aiDecisions: [
      {
        timestamp: new Date(Date.now() - 40 * 60 * 1000),
        action: "Issue Classification",
        reasoning: "Keywords 'no power', 'outlets', 'urgent' indicate electrical emergency. Immediate attention required.",
        confidence: 95
      },
      {
        timestamp: new Date(Date.now() - 35 * 60 * 1000),
        action: "Vendor Assignment",
        reasoning: "PowerPro Electric selected for emergency electrical response capability and 24/7 availability",
        confidence: 93
      }
    ]
  },
  {
    id: "ticket-5",
    tenantId: "3",
    tenantName: "Emily Rodriguez",
    unit: "6C",
    title: "Garbage disposal not working",
    description: "Kitchen garbage disposal won't turn on. No sound when switch is flipped.",
    category: "appliance",
    urgency: "medium",
    status: "completed",
    vendorId: "vendor-1",
    vendorName: "Quick Fix Plumbing",
    estimatedCost: 150,
    actualCost: 125,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    aiClassified: true,
    aiDecisions: [
      {
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        action: "Issue Classification",
        reasoning: "Keywords 'garbage disposal' indicate appliance/plumbing issue. Medium priority for kitchen functionality.",
        confidence: 87
      }
    ]
  }
];