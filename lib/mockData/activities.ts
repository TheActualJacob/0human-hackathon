import { ActivityItem } from "@/types";

export const mockActivities: ActivityItem[] = [
  {
    id: "activity-1",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    type: "maintenance",
    action: "AI Classification",
    details: "Emergency electrical issue classified for Unit 12F",
    entityId: "ticket-4",
    aiGenerated: true
  },
  {
    id: "activity-2",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    type: "vendor",
    action: "Vendor Assigned",
    details: "PowerPro Electric assigned to emergency ticket #ticket-4",
    entityId: "ticket-4",
    aiGenerated: true
  },
  {
    id: "activity-3",
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    type: "rent",
    action: "AI Rent Reminder",
    details: "Automated rent reminder sent to Unit 4B",
    entityId: "2",
    aiGenerated: true
  },
  {
    id: "activity-4",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    type: "maintenance",
    action: "Ticket Created",
    details: "New maintenance ticket for water leak at Unit 4B",
    entityId: "ticket-1",
    aiGenerated: false
  },
  {
    id: "activity-5",
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    type: "rent",
    action: "Late Fee Applied",
    details: "$150 late fee applied to Michael Chen's rent payment",
    entityId: "payment-2",
    aiGenerated: true
  },
  {
    id: "activity-6",
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
    type: "lease",
    action: "Lease Renewal Alert",
    details: "AI recommends 95% renewal probability for Unit 2A",
    entityId: "lease-1",
    aiGenerated: true
  },
  {
    id: "activity-7",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    type: "maintenance",
    action: "Status Update",
    details: "Dishwasher repair in progress at Unit 10E",
    entityId: "ticket-3",
    aiGenerated: false
  },
  {
    id: "activity-8",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    type: "rent",
    action: "Payment Received",
    details: "Rent payment received from Amanda Davis (Unit 3A)",
    entityId: "payment-7",
    aiGenerated: false
  },
  {
    id: "activity-9",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    type: "system",
    action: "AI Model Update",
    details: "Maintenance classification model updated to v2.3",
    aiGenerated: true
  },
  {
    id: "activity-10",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    type: "vendor",
    action: "Performance Score Update",
    details: "Quick Fix Plumbing score increased to 92%",
    entityId: "vendor-1",
    aiGenerated: true
  }
];