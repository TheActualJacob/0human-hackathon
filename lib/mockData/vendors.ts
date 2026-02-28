import { Vendor } from "@/types";

export const mockVendors: Vendor[] = [
  {
    id: "vendor-1",
    name: "Quick Fix Plumbing",
    email: "service@quickfixplumbing.com",
    phone: "(555) 111-2222",
    specialty: ["plumbing", "garbage disposal", "water heater"],
    avgResponseTime: 1.2,
    avgCost: 225,
    rating: 4.8,
    aiPerformanceScore: 92,
    isAvailable: true
  },
  {
    id: "vendor-2",
    name: "PowerPro Electric",
    email: "dispatch@powerproelectric.com",
    phone: "(555) 222-3333",
    specialty: ["electrical", "emergency electrical", "lighting"],
    avgResponseTime: 0.8,
    avgCost: 300,
    rating: 4.9,
    aiPerformanceScore: 95,
    isAvailable: true
  },
  {
    id: "vendor-3",
    name: "AllTech Appliance Repair",
    email: "info@alltechrepair.com",
    phone: "(555) 333-4444",
    specialty: ["appliance", "refrigerator", "dishwasher", "washer/dryer"],
    avgResponseTime: 2.5,
    avgCost: 175,
    rating: 4.5,
    aiPerformanceScore: 85,
    isAvailable: true
  },
  {
    id: "vendor-4",
    name: "Climate Control HVAC",
    email: "schedule@climatecontrolhvac.com",
    phone: "(555) 444-5555",
    specialty: ["hvac", "heating", "cooling", "air quality"],
    avgResponseTime: 3.0,
    avgCost: 350,
    rating: 4.7,
    aiPerformanceScore: 88,
    isAvailable: true
  },
  {
    id: "vendor-5",
    name: "HandyPro Services",
    email: "jobs@handypro.com",
    phone: "(555) 555-6666",
    specialty: ["general", "painting", "carpentry", "minor repairs"],
    avgResponseTime: 4.0,
    avgCost: 150,
    rating: 4.3,
    aiPerformanceScore: 78,
    isAvailable: false
  },
  {
    id: "vendor-6",
    name: "Emergency Response Team",
    email: "24-7@emergencyteam.com",
    phone: "(555) 666-7777",
    specialty: ["emergency", "plumbing", "electrical", "hvac"],
    avgResponseTime: 0.5,
    avgCost: 450,
    rating: 4.6,
    aiPerformanceScore: 90,
    isAvailable: true
  }
];