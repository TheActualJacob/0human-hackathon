'use client';

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import {
  Brain, CheckCircle, Download, Loader2, RefreshCw,
  AlertTriangle, PenTool, FileText, Home, DollarSign, User, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LeaseData {
  token: string;
  prospect_name: string | null;
  unit_address: string | null;
  monthly_rent: number | null;
  lease_content: string;
}

type Step = "read" | "sign" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "read", label: "Review" },
  { id: "sign", label: "Sign" },
  { id: "done", label: "Complete" },
];

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const sigRef = useRef<SignatureCanvas>(null);
  const docRef = useRef<HTMLDivElement>(null);

  const [leaseData, setLeaseData] = useState<LeaseData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("read");
  const [signing, setSigning] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isSigEmpty, setIsSigEmpty] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    async function fetchLease() {
      try {
        const res = await fetch(`/api/sign/${token}`);
        if (res.status === 404) throw new Error("Signing link not found. Please check the link you received.");
        if (res.status === 410) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail || "This signing link is no longer valid.");
        }
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail || "Failed to load document. Please try again.");
        }
        setLeaseData(await res.json());
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : "Failed to load document.");
      } finally {
        setLoading(false);
      }
    }
    fetchLease();
  }, [token]);

  // Track scroll to enable the "Proceed to Sign" button
  useEffect(() => {
    const el = docRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setHasScrolled(true);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [step, leaseData]);

  async function handleSign() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setSubmitError("Please draw your signature before submitting.");
      return;
    }
    setSubmitError(null);
    setSigning(true);
    try {
      const signatureDataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature_data_url: signatureDataUrl }),
      });
      if (res.status === 410) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "This document has already been signed or has expired.");
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to submit signature. Please try again.");
      }
      const data = await res.json();
      setPdfUrl(data.pdf_url || null);
      setStep("done");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Loading your document…</p>
      </div>
    </div>
  );

  // ── Error ────────────────────────────────────────────────────────────────────
  if (loadError || !leaseData) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500" />
        </div>
        <h1 className="text-xl font-semibold">Document Unavailable</h1>
        <p className="text-muted-foreground text-sm">{loadError}</p>
      </div>
    </div>
  );

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (step === "done") return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg text-center space-y-6">
        <div className="mx-auto h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">Lease Signed</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your tenancy agreement has been signed and sent to your landlord.
            You'll receive a confirmation shortly.
          </p>
        </div>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="block">
            <Button variant="outline" className="w-full gap-2">
              <Download className="h-4 w-4" />Download Signed Agreement (PDF)
            </Button>
          </a>
        )}
        <div className="rounded-xl border border-border bg-card p-4 text-left space-y-2">
          {leaseData.unit_address && (
            <div className="flex items-center gap-2 text-sm">
              <Home className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{leaseData.unit_address}</span>
            </div>
          )}
          {leaseData.monthly_rent && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>£{leaseData.monthly_rent.toFixed(0)}/month</span>
            </div>
          )}
          {leaseData.prospect_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{leaseData.prospect_name}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          This digital signature is legally binding under the Electronic Communications Act 2000.
        </p>
      </div>
    </div>
  );

  // ── Main ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">PropAI</span>
            <span className="text-muted-foreground/60 text-sm">·</span>
            <span className="text-sm text-muted-foreground">Digital Lease Signing</span>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                <div className={`h-6 px-2 rounded-full text-xs flex items-center font-medium transition-colors ${
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : STEPS.findIndex(x => x.id === step) > i
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground"
                }`}>
                  {s.label}
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 flex gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 shrink-0">
          <div className="sticky top-24 space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
              {leaseData.prospect_name && (
                <div>
                  <p className="text-xs text-muted-foreground">Tenant</p>
                  <p className="text-sm font-medium">{leaseData.prospect_name}</p>
                </div>
              )}
              {leaseData.unit_address && (
                <div>
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="text-sm font-medium leading-snug">{leaseData.unit_address}</p>
                </div>
              )}
              {leaseData.monthly_rent && (
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Rent</p>
                  <p className="text-xl font-bold text-primary">£{leaseData.monthly_rent.toFixed(0)}</p>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your signature is encrypted and legally binding under the Electronic Communications Act 2000.
              </p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Mobile summary */}
          <div className="md:hidden rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{leaseData.prospect_name}</p>
              <p className="text-xs text-muted-foreground">{leaseData.unit_address}</p>
            </div>
            {leaseData.monthly_rent && (
              <p className="text-lg font-bold text-primary">£{leaseData.monthly_rent.toFixed(0)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
            )}
          </div>

          {/* Review step */}
          {step === "read" && (
            <>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Tenancy Agreement</span>
                  <Badge variant="outline" className="ml-auto text-xs text-yellow-500 border-yellow-500/40">Awaiting Signature</Badge>
                </div>
                <div
                  ref={docRef}
                  className="h-[520px] overflow-y-auto px-6 py-5 text-sm leading-relaxed space-y-0.5 scroll-smooth"
                >
                  {leaseData.lease_content.split("\n\n").map((block, bi) => {
                    const lines = block.trim().split("\n");
                    return (
                      <div key={bi} className="mb-4">
                        {lines.map((line, li) => {
                          const t = line.trim();
                          if (!t) return <div key={li} className="h-2" />;
                          const isHeading = /^\d+\.\s+[A-Z]/.test(t);
                          const isBullet = t.startsWith("- ") || t.startsWith("• ");
                          if (isHeading) return (
                            <p key={li} className="font-semibold text-foreground mt-4 mb-1">{t}</p>
                          );
                          if (isBullet) return (
                            <p key={li} className="text-muted-foreground pl-4 before:content-['·'] before:mr-2 before:text-primary">{t.slice(2)}</p>
                          );
                          return <p key={li} className="text-muted-foreground">{t}</p>;
                        })}
                      </div>
                    );
                  })}
                  <div className="h-8 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">— End of Agreement —</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                {!hasScrolled && (
                  <p className="text-xs text-muted-foreground">Scroll to the bottom of the agreement to continue</p>
                )}
                <Button
                  size="lg"
                  onClick={() => setStep("sign")}
                  disabled={!hasScrolled}
                  className="w-full gap-2"
                >
                  <PenTool className="h-4 w-4" />
                  I Have Read the Agreement — Proceed to Sign
                </Button>
                <button
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => { setHasScrolled(true); }}
                >
                  Skip to signature
                </button>
              </div>
            </>
          )}

          {/* Sign step */}
          {step === "sign" && (
            <>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Draw Your Signature</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { sigRef.current?.clear(); setIsSigEmpty(true); }}
                    className="gap-1.5 text-xs text-muted-foreground h-7"
                  >
                    <RefreshCw className="h-3 w-3" />Clear
                  </Button>
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-3">Use your mouse or finger to sign in the box below</p>
                  <div className={`rounded-lg border-2 transition-colors ${isSigEmpty ? "border-dashed border-border" : "border-primary/50"} overflow-hidden relative bg-muted/10`}>
                    {isSigEmpty && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-sm text-muted-foreground/40 select-none">Sign here</p>
                      </div>
                    )}
                    <SignatureCanvas
                      ref={sigRef}
                      penColor="currentColor"
                      backgroundColor="transparent"
                      canvasProps={{
                        className: "w-full",
                        height: 180,
                        style: { touchAction: "none", display: "block" }
                      }}
                      onEnd={() => setIsSigEmpty(sigRef.current?.isEmpty() ?? true)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm text-center text-muted-foreground leading-relaxed">
                By clicking <strong className="text-foreground">Sign Agreement</strong>, you confirm you have read and agree to all terms of the tenancy agreement. This digital signature is legally binding.
              </div>

              {submitError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {submitError}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("read")}
                  disabled={signing}
                  className="flex-none"
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={handleSign}
                  disabled={signing || isSigEmpty}
                  className="flex-1 gap-2"
                >
                  {signing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Generating signed document…</>
                  ) : (
                    <><CheckCircle className="h-4 w-4" />Sign Agreement</>
                  )}
                </Button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
