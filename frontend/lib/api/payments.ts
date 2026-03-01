const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PaymentRecordRequest {
  lease_id?: string;
  tenant_whatsapp?: string;
  amount: number;
  payment_method?: string;
  reference?: string;
  paid_date?: string;
}

export interface PaymentRecordResult {
  payment: {
    id: string;
    lease_id: string;
    amount_due: number;
    amount_paid: number | null;
    due_date: string;
    paid_date: string | null;
    status: string;
    payment_method: string | null;
    notes: string | null;
    tenant_name: string | null;
    unit_identifier: string | null;
  };
  matched: boolean;
  receipt_sent: boolean;
  message: string;
}

export interface CheckOverdueResult {
  processed: number;
  reminders_sent: number;
  landlord_alerts: number;
  escalations: Array<{
    payment_id: string;
    tenant: string;
    unit: string;
    days_overdue: number;
    level: string;
    amount: number;
  }>;
}

export interface MonthlyReportResponse {
  landlord_id: string;
  landlord_name: string;
  period: string;
  total_expected: number;
  total_collected: number;
  total_outstanding: number;
  collection_rate: number;
  payments_on_time: number;
  payments_late: number;
  payments_missed: number;
  late_patterns: Array<{
    tenant_name: string;
    unit_identifier: string;
    times_late: number;
    avg_days_late: number;
  }>;
  property_breakdown: Array<{
    unit_identifier: string;
    expected: number;
    collected: number;
    status: string;
  }>;
  active_payment_plans: number;
  total_arrears_under_plan: number;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API request failed");
  }
  return res.json();
}

export async function recordPayment(
  req: PaymentRecordRequest
): Promise<PaymentRecordResult> {
  return apiFetch("/payments/record", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function triggerOverdueCheck(): Promise<CheckOverdueResult> {
  return apiFetch("/payments/check-overdue", { method: "POST" });
}

export interface GenerateLeasePaymentsResult {
  created: number;
  lease_id: string;
  message: string;
}

export async function generatePaymentsForLease(leaseId: string): Promise<GenerateLeasePaymentsResult> {
  return apiFetch(`/payments/generate-for-lease/${leaseId}`, { method: "POST" });
}

export async function getMonthlyReport(
  landlordId: string,
  year?: number,
  month?: number
): Promise<MonthlyReportResponse> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const qs = params.toString();
  return apiFetch(`/payments/report/${landlordId}${qs ? "?" + qs : ""}`);
}
