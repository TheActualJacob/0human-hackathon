import { Tenant } from "@/types";

export const mockTenants: Tenant[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.johnson@email.com",
    phone: "(555) 123-4567",
    unit: "2A",
    leaseId: "lease-1",
    moveInDate: new Date("2023-06-15"),
    rentAmount: 2500,
    paymentStatus: "current",
    riskScore: 15
  },
  {
    id: "2",
    name: "Michael Chen",
    email: "michael.chen@email.com",
    phone: "(555) 234-5678",
    unit: "4B",
    leaseId: "lease-2",
    moveInDate: new Date("2022-11-01"),
    rentAmount: 2800,
    paymentStatus: "late",
    riskScore: 65
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    email: "emily.rodriguez@email.com",
    phone: "(555) 345-6789",
    unit: "6C",
    leaseId: "lease-3",
    moveInDate: new Date("2024-01-20"),
    rentAmount: 3200,
    paymentStatus: "current",
    riskScore: 10
  },
  {
    id: "4",
    name: "David Thompson",
    email: "david.thompson@email.com",
    phone: "(555) 456-7890",
    unit: "8D",
    leaseId: "lease-4",
    moveInDate: new Date("2023-03-10"),
    rentAmount: 2600,
    paymentStatus: "pending",
    riskScore: 35
  },
  {
    id: "5",
    name: "Jessica Williams",
    email: "jessica.williams@email.com",
    phone: "(555) 567-8901",
    unit: "10E",
    leaseId: "lease-5",
    moveInDate: new Date("2022-09-05"),
    rentAmount: 2900,
    paymentStatus: "current",
    riskScore: 20
  },
  {
    id: "6",
    name: "Robert Martinez",
    email: "robert.martinez@email.com",
    phone: "(555) 678-9012",
    unit: "12F",
    leaseId: "lease-6",
    moveInDate: new Date("2023-12-01"),
    rentAmount: 3100,
    paymentStatus: "late",
    riskScore: 75
  },
  {
    id: "7",
    name: "Amanda Davis",
    email: "amanda.davis@email.com",
    phone: "(555) 789-0123",
    unit: "3A",
    leaseId: "lease-7",
    moveInDate: new Date("2024-02-15"),
    rentAmount: 2400,
    paymentStatus: "current",
    riskScore: 5
  },
  {
    id: "8",
    name: "Christopher Lee",
    email: "christopher.lee@email.com",
    phone: "(555) 890-1234",
    unit: "5B",
    leaseId: "lease-8",
    moveInDate: new Date("2023-07-20"),
    rentAmount: 2700,
    paymentStatus: "current",
    riskScore: 25
  }
];