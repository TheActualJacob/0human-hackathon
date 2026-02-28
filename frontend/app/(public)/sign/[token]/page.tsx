'use client';

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import { Brain, CheckCircle, Download, Loader2, RefreshCw, AlertTriangle, PenTool } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface LeaseData {
  token: string;
  prospect_name: string | null;
  unit_address: string | null;
  monthly_rent: number | null;
  lease_content: string;
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const sigRef = useRef<SignatureCanvas>(null);

  const [leaseData, setLeaseData] = useState<LeaseData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"read" | "sign" | "done">("read");
  const [signing, setSigning] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isSigEmpty, setIsSigEmpty] = useState(true);

  useEffect(() => {
    async function fetchLease() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/sign/${token}`);
        if (res.status === 404) throw new Error("Signing link not found. Please check the link you received.");
        if (res.status === 410) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "This signing link is no longer valid.");
        }
        if (!res.ok) throw new Error("Failed to load document. Please try again.");
        setLeaseData(await res.json());
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : "Failed to load document.");
      } finally {
        setLoading(false);
      }
    }
    fetchLease();
  }, [token]);

  async function handleSign() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setSubmitError("Please draw your signature before submitting.");
      return;
    }
    setSubmitError(null);
    setSigning(true);
    try {
      const signatureDataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
      const res = await fetch(`${BACKEND_URL}/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature_data_url: signatureDataUrl }),
      });
      if (res.status === 410) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "This document has already been signed or has expired.");
      }
      if (!res.ok) throw new Error("Failed to submit signature. Please try again.");
      const data = await res.json();
      setPdfUrl(data.pdf_url || null);
      setStep("done");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (loadError || !leaseData) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
        <h1 className="text-xl font-bold">Document Unavailable</h1>
        <p className="text-muted-foreground">{loadError}</p>
      </Card>
    </div>
  );

  if (step === "done") return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-5">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h1 className="text-2xl font-bold">Lease Signed!</h1>
        <p className="text-muted-foreground">Your tenancy agreement has been signed and sent to the landlord. You will receive a WhatsApp message with your signed copy shortly.</p>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" className="w-full gap-2"><Download className="h-4 w-4" />Download Signed PDF</Button>
          </a>
        )}
        <p className="text-xs text-muted-foreground">This digital signature is legally binding under the Electronic Communications Act 2000.</p>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">PropAI</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">Tenancy Agreement</span>
          </div>
          <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">Awaiting Signature</Badge>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-semibold text-lg">{leaseData.prospect_name ? `Tenancy Agreement — ${leaseData.prospect_name}` : "Tenancy Agreement"}</h2>
              {leaseData.unit_address && <p className="text-sm text-muted-foreground">{leaseData.unit_address}</p>}
            </div>
            {leaseData.monthly_rent && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Monthly Rent</p>
                <p className="text-xl font-bold text-primary">£{leaseData.monthly_rent.toFixed(0)}</p>
              </div>
            )}
          </div>
        </Card>

        {step === "read" && (
          <>
            <Card className="p-6">
              <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">Lease Agreement</h3>
              <div className="max-h-[500px] overflow-y-auto pr-2 space-y-2">
                {leaseData.lease_content.split("\n\n").map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed whitespace-pre-line">{para}</p>
                ))}
              </div>
            </Card>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground text-center">Please read the full agreement above before signing.</p>
              <Button size="lg" onClick={() => setStep("sign")} className="w-full gap-2">
                <PenTool className="h-4 w-4" />I Have Read the Agreement — Proceed to Sign
              </Button>
            </div>
          </>
        )}

        {step === "sign" && (
          <>
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Draw Your Signature</h3>
                <Button variant="ghost" size="sm" onClick={() => { sigRef.current?.clear(); setIsSigEmpty(true); }} className="gap-1 text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5" />Clear
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Use your mouse or finger to draw your signature in the box below.</p>
              <div className="rounded-lg border-2 border-dashed border-border bg-card overflow-hidden">
                <SignatureCanvas ref={sigRef} penColor="white" backgroundColor="transparent"
                  canvasProps={{ className: "w-full", height: 160, style: { touchAction: "none" } }}
                  onEnd={() => setIsSigEmpty(sigRef.current?.isEmpty() ?? true)} />
              </div>
              {isSigEmpty && <p className="text-xs text-muted-foreground text-center">Draw your signature above</p>}
            </Card>

            <Card className="p-4 bg-primary/5 border-primary/20">
              <p className="text-sm text-center">By clicking <strong>Sign Agreement</strong> below, you confirm that you have read and agree to the terms of the tenancy agreement. Your digital signature is legally binding.</p>
            </Card>

            {submitError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{submitError}</div>}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("read")} className="flex-1" disabled={signing}>Back to Review</Button>
              <Button size="lg" onClick={handleSign} className="flex-grow gap-2" disabled={signing || isSigEmpty}>
                {signing ? <><Loader2 className="h-4 w-4 animate-spin" />Signing...</> : <><CheckCircle className="h-4 w-4" />Sign Agreement</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
