'use client';

import { useState } from "react";
import { useParams } from "next/navigation";
import { Brain, CheckCircle, Loader2, Home } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const EMPLOYMENT_OPTIONS = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Retired" },
  { value: "unemployed", label: "Unemployed / Other" },
];

export default function ApplyPage() {
  const { prospectId } = useParams<{ prospectId: string }>();
  const [step, setStep] = useState<"form" | "submitted">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", current_address: "",
    employment_status: "", employer_name: "", monthly_income: "",
    references_text: "", additional_info: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.full_name.trim() || !form.email.trim()) {
      setError("Full name and email are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_id: prospectId,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          current_address: form.current_address || null,
          employment_status: form.employment_status || null,
          employer_name: form.employer_name || null,
          monthly_income: form.monthly_income ? parseFloat(form.monthly_income) : null,
          references_text: form.references_text || null,
          additional_info: form.additional_info || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to submit application");
      }
      setStep("submitted");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold">Application Submitted!</h1>
          <p className="text-muted-foreground">
            Thank you for your application. Our team will review it and be in touch within <strong>5–7 working days</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll contact you on the WhatsApp number you used to enquire.
          </p>
          <Badge className="bg-primary/10 text-primary">Application under review</Badge>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Brain className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">PropAI</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">Rental Application</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Home className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Rental Application</h1>
          </div>
          <p className="text-muted-foreground">Please complete all sections below. Your application will be reviewed within 5–7 working days.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-semibold border-b border-border pb-2">Personal Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Full Name <span className="text-red-500">*</span></label>
                <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="e.g. Jane Smith" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email Address <span className="text-red-500">*</span></label>
                <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="jane@example.com" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Phone Number</label>
              <Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+44 7700 900000" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Current Address</label>
              <Input value={form.current_address} onChange={(e) => update("current_address", e.target.value)} placeholder="123 High Street, London, SW1A 1AA" />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-base font-semibold border-b border-border pb-2">Employment & Income</h2>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Employment Status</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EMPLOYMENT_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => update("employment_status", opt.value)}
                    className={cn("rounded-lg border px-3 py-2 text-sm font-medium transition-colors text-left",
                      form.employment_status === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 hover:bg-muted")}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Employer / Company</label>
                <Input value={form.employer_name} onChange={(e) => update("employer_name", e.target.value)} placeholder="Acme Ltd" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Gross Monthly Income (£)</label>
                <Input type="number" min="0" step="100" value={form.monthly_income} onChange={(e) => update("monthly_income", e.target.value)} placeholder="3000" />
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-base font-semibold border-b border-border pb-2">References</h2>
            <p className="text-sm text-muted-foreground">Please provide contact details for a previous landlord and/or employer.</p>
            <textarea className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              value={form.references_text} onChange={(e) => update("references_text", e.target.value)} placeholder="Name, relationship, email, phone number..." />
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-base font-semibold border-b border-border pb-2">Additional Information</h2>
            <textarea className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              value={form.additional_info} onChange={(e) => update("additional_info", e.target.value)} placeholder="e.g. pets, move-in date preference, any questions..." />
          </Card>

          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Application"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">By submitting this form you consent to a credit and reference check being conducted on your behalf.</p>
        </form>
      </div>
    </div>
  );
}
