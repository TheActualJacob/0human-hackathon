'use client';

import { useState } from "react";
import { useParams } from "next/navigation";
import { Brain, CheckCircle, Loader2, ChevronRight, ChevronLeft, User, Briefcase, MessageSquare, Send } from "lucide-react";

const EMPLOYMENT_OPTIONS = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Retired" },
  { value: "unemployed", label: "Unemployed / Other" },
];

const STEPS = [
  { id: "personal", label: "Personal", icon: User },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "references", label: "References", icon: MessageSquare },
  { id: "review", label: "Submit", icon: Send },
];

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  current_address: string;
  employment_status: string;
  employer_name: string;
  monthly_income: string;
  references_text: string;
  additional_info: string;
};

export default function ApplyPage() {
  const { prospectId } = useParams<{ prospectId: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    full_name: "", email: "", phone: "", current_address: "",
    employment_status: "", employer_name: "", monthly_income: "",
    references_text: "", additional_info: "",
  });

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function validateStep(): string | null {
    if (currentStep === 0) {
      if (!form.full_name.trim()) return "Full name is required.";
      if (!form.email.trim() || !form.email.includes("@")) return "A valid email address is required.";
    }
    return null;
  }

  function nextStep() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prevStep() {
    setError(null);
    setCurrentStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/applications`, {
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
        throw new Error(data.detail || "Failed to submit application. Please try again.");
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-5">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-5 shadow-lg">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Application Submitted!</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Thank you, {form.full_name.split(" ")[0]}! Your application is now under review.
                We&apos;ll be in touch via WhatsApp very shortly.
              </p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Keep an eye on your WhatsApp messages — you&apos;ll hear from us soon.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">PropAI</p>
            <p className="text-xs text-muted-foreground mt-0.5">Rental Application</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-10">
        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isComplete = idx < currentStep;
            const isActive = idx === currentStep;
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isComplete ? "bg-primary text-primary-foreground" :
                    isActive ? "bg-primary/10 border-2 border-primary text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isComplete ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium hidden sm:block ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded transition-colors ${idx < currentStep ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 0: Personal Details */}
        {currentStep === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">Personal Details</h2>
              <p className="text-sm text-muted-foreground mt-1">Tell us a bit about yourself.</p>
            </div>
            <Field label="Full Name" required>
              <input
                className={inputClass}
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                placeholder="Jane Smith"
                autoComplete="name"
              />
            </Field>
            <Field label="Email Address" required>
              <input
                className={inputClass}
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="jane@example.com"
                autoComplete="email"
                inputMode="email"
              />
            </Field>
            <Field label="Phone Number" hint="Optional — we'll use your WhatsApp number if not provided">
              <input
                className={inputClass}
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+44 7700 900000"
                autoComplete="tel"
                inputMode="tel"
              />
            </Field>
            <Field label="Current Address" hint="Where you currently live">
              <input
                className={inputClass}
                value={form.current_address}
                onChange={(e) => update("current_address", e.target.value)}
                placeholder="123 High Street, London, SW1A 1AA"
                autoComplete="street-address"
              />
            </Field>
          </div>
        )}

        {/* Step 1: Employment */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">Employment & Income</h2>
              <p className="text-sm text-muted-foreground mt-1">Help us understand your financial situation.</p>
            </div>
            <Field label="Employment Status">
              <div className="grid grid-cols-2 gap-2">
                {EMPLOYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("employment_status", opt.value)}
                    className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all text-left ${
                      form.employment_status === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Employer / Company Name" hint="Or your client / institution if self-employed / student">
              <input
                className={inputClass}
                value={form.employer_name}
                onChange={(e) => update("employer_name", e.target.value)}
                placeholder="Acme Ltd"
                autoComplete="organization"
              />
            </Field>
            <Field label="Gross Monthly Income (£)" hint="Before tax, in pounds">
              <input
                className={inputClass}
                type="text"
                inputMode="decimal"
                value={form.monthly_income}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, "");
                  update("monthly_income", v);
                }}
                placeholder="3000"
              />
            </Field>
          </div>
        )}

        {/* Step 2: References */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">References</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Provide contact details for a previous landlord or employer — this helps speed up your application.
              </p>
            </div>
            <Field label="Reference Details" hint="Name, relationship, email and/or phone number">
              <textarea
                className={textareaClass}
                value={form.references_text}
                onChange={(e) => update("references_text", e.target.value)}
                placeholder={"e.g.\nJohn Brown – Previous landlord\njohn@email.com / 07700 900123\n\nSarah Jones – Manager at Acme Ltd\nsjones@acme.com / 07700 900456"}
                rows={5}
              />
            </Field>
            <Field label="Additional Information" hint="Anything else we should know (pets, preferred move-in date, questions, etc.)">
              <textarea
                className={textareaClass}
                value={form.additional_info}
                onChange={(e) => update("additional_info", e.target.value)}
                placeholder="e.g. I have one small dog. Ideally looking to move in 1st March."
                rows={3}
              />
            </Field>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">Review & Submit</h2>
              <p className="text-sm text-muted-foreground mt-1">Check your details before sending.</p>
            </div>
            <ReviewCard title="Personal Details">
              <ReviewRow label="Name" value={form.full_name} />
              <ReviewRow label="Email" value={form.email} />
              <ReviewRow label="Phone" value={form.phone || "—"} />
              <ReviewRow label="Address" value={form.current_address || "—"} />
            </ReviewCard>
            <ReviewCard title="Employment & Income">
              <ReviewRow label="Status" value={EMPLOYMENT_OPTIONS.find(o => o.value === form.employment_status)?.label || "—"} />
              <ReviewRow label="Employer" value={form.employer_name || "—"} />
              <ReviewRow label="Monthly Income" value={form.monthly_income ? `£${parseFloat(form.monthly_income).toLocaleString()}` : "—"} />
            </ReviewCard>
            <ReviewCard title="References">
              <p className="text-sm text-foreground whitespace-pre-line">{form.references_text || "—"}</p>
            </ReviewCard>
            {form.additional_info && (
              <ReviewCard title="Additional Info">
                <p className="text-sm text-foreground whitespace-pre-line">{form.additional_info}</p>
              </ReviewCard>
            )}
            <div className="bg-muted/50 border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                By submitting this application you consent to a credit and reference check being conducted on your behalf.
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className={`flex gap-3 mt-7 ${currentStep === 0 ? "justify-end" : "justify-between"}`}>
          {currentStep > 0 && (
            <button
              type="button"
              onClick={prevStep}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}
          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-1.5 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Submitting...</>
              ) : (
                <><Send className="h-4 w-4" />Submit Application</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground " +
  "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors";

const textareaClass =
  "w-full rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground " +
  "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors resize-none";

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{title}</p>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}
