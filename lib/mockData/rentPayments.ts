import { RentPayment } from "@/types";

export const mockRentPayments: RentPayment[] = [
  {
    id: "payment-1",
    tenantId: "1",
    tenantName: "Sarah Johnson",
    unit: "2A",
    amount: 2500,
    dueDate: new Date("2024-03-01"),
    paidDate: new Date("2024-02-28"),
    status: "paid",
    aiReminded: false
  },
  {
    id: "payment-2",
    tenantId: "2",
    tenantName: "Michael Chen",
    unit: "4B",
    amount: 2800,
    dueDate: new Date("2024-03-01"),
    status: "late",
    lateFee: 150,
    aiReminded: true
  },
  {
    id: "payment-3",
    tenantId: "3",
    tenantName: "Emily Rodriguez",
    unit: "6C",
    amount: 3200,
    dueDate: new Date("2024-03-01"),
    paidDate: new Date("2024-02-26"),
    status: "paid",
    aiReminded: false
  },
  {
    id: "payment-4",
    tenantId: "4",
    tenantName: "David Thompson",
    unit: "8D",
    amount: 2600,
    dueDate: new Date("2024-03-01"),
    status: "pending",
    aiReminded: true
  },
  {
    id: "payment-5",
    tenantId: "5",
    tenantName: "Jessica Williams",
    unit: "10E",
    amount: 2900,
    dueDate: new Date("2024-03-01"),
    paidDate: new Date("2024-02-27"),
    status: "paid",
    aiReminded: false
  },
  {
    id: "payment-6",
    tenantId: "6",
    tenantName: "Robert Martinez",
    unit: "12F",
    amount: 3100,
    dueDate: new Date("2024-03-01"),
    status: "late",
    lateFee: 200,
    aiReminded: true
  },
  {
    id: "payment-7",
    tenantId: "7",
    tenantName: "Amanda Davis",
    unit: "3A",
    amount: 2400,
    dueDate: new Date("2024-03-01"),
    paidDate: new Date("2024-02-25"),
    status: "paid",
    aiReminded: false
  },
  {
    id: "payment-8",
    tenantId: "8",
    tenantName: "Christopher Lee",
    unit: "5B",
    amount: 2700,
    dueDate: new Date("2024-03-01"),
    paidDate: new Date("2024-02-29"),
    status: "paid",
    aiReminded: false
  }
];