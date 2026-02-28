const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PaymentInfo {
  payment_id: string;
  lease_id: string;
  tenant_name: string;
  unit_identifier: string;
  amount_due: number;
  due_date: string;
  status: string;
}

export interface CheckoutSessionResponse {
  session_id: string;
  checkout_url: string;
}

export interface ConfirmPaymentResponse {
  success: boolean;
  message: string;
  receipt_sent: boolean;
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

export async function getPaymentInfo(
  paymentId: string
): Promise<PaymentInfo> {
  return apiFetch(`/payments/${paymentId}/pay-info`);
}

export async function createCheckoutSession(
  paymentId: string,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutSessionResponse> {
  return apiFetch(`/payments/${paymentId}/create-checkout-session`, {
    method: "POST",
    body: JSON.stringify({ success_url: successUrl, cancel_url: cancelUrl }),
  });
}

export async function confirmStripePayment(
  paymentId: string,
  sessionId: string
): Promise<ConfirmPaymentResponse> {
  return apiFetch(`/payments/${paymentId}/confirm-stripe`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}
