import { Lease } from "@/types";

export const mockLeases: Lease[] = [
  {
    id: "lease-1",
    tenantId: "1",
    unit: "2A",
    startDate: new Date("2023-06-15"),
    endDate: new Date("2024-06-14"),
    monthlyRent: 2500,
    securityDeposit: 5000,
    status: "expiring",
    renewalRecommendation: 95,
    suggestedRentIncrease: 3
  },
  {
    id: "lease-2",
    tenantId: "2",
    unit: "4B",
    startDate: new Date("2022-11-01"),
    endDate: new Date("2023-10-31"),
    monthlyRent: 2800,
    securityDeposit: 5600,
    status: "expired",
    renewalRecommendation: 45,
    suggestedRentIncrease: 0
  },
  {
    id: "lease-3",
    tenantId: "3",
    unit: "6C",
    startDate: new Date("2024-01-20"),
    endDate: new Date("2025-01-19"),
    monthlyRent: 3200,
    securityDeposit: 6400,
    status: "active",
    renewalRecommendation: 98,
    suggestedRentIncrease: 4
  },
  {
    id: "lease-4",
    tenantId: "4",
    unit: "8D",
    startDate: new Date("2023-03-10"),
    endDate: new Date("2024-03-09"),
    monthlyRent: 2600,
    securityDeposit: 5200,
    status: "expiring",
    renewalRecommendation: 80,
    suggestedRentIncrease: 2.5
  },
  {
    id: "lease-5",
    tenantId: "5",
    unit: "10E",
    startDate: new Date("2022-09-05"),
    endDate: new Date("2023-09-04"),
    monthlyRent: 2900,
    securityDeposit: 5800,
    status: "expired",
    renewalRecommendation: 88,
    suggestedRentIncrease: 3.5
  },
  {
    id: "lease-6",
    tenantId: "6",
    unit: "12F",
    startDate: new Date("2023-12-01"),
    endDate: new Date("2024-11-30"),
    monthlyRent: 3100,
    securityDeposit: 6200,
    status: "active",
    renewalRecommendation: 35,
    suggestedRentIncrease: 0
  },
  {
    id: "lease-7",
    tenantId: "7",
    unit: "3A",
    startDate: new Date("2024-02-15"),
    endDate: new Date("2025-02-14"),
    monthlyRent: 2400,
    securityDeposit: 4800,
    status: "active",
    renewalRecommendation: 99,
    suggestedRentIncrease: 5
  },
  {
    id: "lease-8",
    tenantId: "8",
    unit: "5B",
    startDate: new Date("2023-07-20"),
    endDate: new Date("2024-07-19"),
    monthlyRent: 2700,
    securityDeposit: 5400,
    status: "active",
    renewalRecommendation: 85,
    suggestedRentIncrease: 3
  }
];