'use client';

import { useState, useEffect, useCallback } from "react";
import {
  UserSearch, Phone, Mail, Home, Calendar, ChevronRight,
  CheckCircle, XCircle, Clock, Send, FileText, MessageCircle,
  Loader2, RefreshCw, AlertTriangle, ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DrawerPanel from "@/components/shared/DrawerPanel";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Prospect {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  status: string;
  conversation_summary: string | null;
  created_at: string;
}

interface Application {
  id: string;
  prospect_id: string;
  unit_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  current_address: string | null;
  employment_status: string | null;
  employer_name: string | null;
  monthly_income: number | null;
  references_text: string | null;
  additional_info: string | null;
  status: string;
  landlord_notes: string | null;
  created_at: string;
  prospects?: Prospect;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    inquiring:  { label: "Inquiring",  className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
    applied:    { label: "Applied",    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
    approved:   { label: "Approved",   className: "bg-green-500/10 text-green-400 border-green-500/30" },
    rejected:   { label: "Rejected",   className: "bg-red-500/10 text-red-400 border-red-500/30" },
    lease_sent: { label: "Lease Sent", className: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
    signed:     { label: "Signed",     className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    pending:    { label: "Pending",    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={cn("capitalize text-xs", cfg.className)}>{cfg.label}</Badge>;
}

function fmtDate(iso: string) {
  try { return format(new Date(iso), "dd MMM yyyy"); } catch { return iso; }
}

export default function ProspectsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leaseText, setLeaseText] = useState("");
  const [landlordNotes, setLandlordNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/applications`);
      if (!res.ok) throw new Error("Failed to load applications");
      setApplications(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  function openDrawer(app: Application) {
    setSelectedApp(app);
    setLeaseText("");
    setLandlordNotes(app.landlord_notes || "");
    setActionError(null);
    setActionSuccess(null);
    setDrawerOpen(true);
  }

  async function handleApprove() {
    if (!selectedApp) return;
    if (!leaseText.trim()) { setActionError("Please paste the lease agreement text before approving."); return; }
    setActionError(null); setActionSuccess(null); setActionLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/applications/${selectedApp.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landlord_notes: landlordNotes || null, lease_content: leaseText }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || "Failed to approve"); }
      const data = await res.json();
      setActionSuccess(`Application approved. Signing link sent to applicant via WhatsApp.\n${data.signing_link || ""}`);
      await fetchApplications();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    } finally { setActionLoading(false); }
  }

  async function handleReject() {
    if (!selectedApp) return;
    setActionError(null); setActionSuccess(null); setActionLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/applications/${selectedApp.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landlord_notes: landlordNotes || null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || "Failed to reject"); }
      setActionSuccess("Application rejected. Applicant has been notified via WhatsApp.");
      await fetchApplications();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to reject");
    } finally { setActionLoading(false); }
  }

  const filtered = applications.filter((a) => {
    const q = search.toLowerCase();
    return a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) ||
      (a.phone || "").includes(q) || (a.prospects?.phone_number || "").includes(q);
  });

  const pending = filtered.filter((a) => a.status === "pending");
  const approved = filtered.filter((a) => ["approved", "lease_sent", "signed"].includes(a.status));
  const rejected = filtered.filter((a) => a.status === "rejected");

  const totalInquiring = applications.filter((a) => a.prospects?.status === "inquiring").length;
  const totalPending = applications.filter((a) => a.status === "pending").length;
  const totalSigned = applications.filter((a) => a.prospects?.status === "signed").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserSearch className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Prospects</h1>
            <p className="text-sm text-muted-foreground">Manage enquiries, applications and lease signings</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchApplications} disabled={loading} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <MessageCircle className="h-5 w-5 text-blue-400" />, value: totalInquiring, label: "Inquiring via WhatsApp" },
          { icon: <Clock className="h-5 w-5 text-yellow-400" />, value: totalPending, label: "Applications pending review" },
          { icon: <CheckCircle className="h-5 w-5 text-emerald-400" />, value: totalSigned, label: "Leases signed" },
        ].map(({ icon, value, label }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-3">
              {icon}
              <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
            </div>
          </Card>
        ))}
      </div>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or phone..." className="max-w-sm" />

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending <span className="ml-1.5 text-xs opacity-70">({pending.length})</span></TabsTrigger>
          <TabsTrigger value="approved">Approved / Signed <span className="ml-1.5 text-xs opacity-70">({approved.length})</span></TabsTrigger>
          <TabsTrigger value="rejected">Rejected <span className="ml-1.5 text-xs opacity-70">({rejected.length})</span></TabsTrigger>
        </TabsList>

        {[{ value: "pending", list: pending }, { value: "approved", list: approved }, { value: "rejected", list: rejected }].map(({ value, list }) => (
          <TabsContent key={value} value={value} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : list.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No applications in this category.</div>
            ) : (
              <div className="space-y-2">
                {list.map((app) => (
                  <button key={app.id} className="w-full text-left" onClick={() => openDrawer(app)}>
                    <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary">{(app.full_name || "?")[0].toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{app.full_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <Mail className="h-3 w-3 shrink-0" /><span className="truncate">{app.email}</span>
                              {app.prospects?.phone_number && <><Phone className="h-3 w-3 shrink-0" /><span>{app.prospects.phone_number}</span></>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          {statusBadge(app.status)}
                          <span className="text-xs text-muted-foreground hidden sm:block">{fmtDate(app.created_at)}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <DrawerPanel isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={selectedApp?.full_name || "Application"}>
        {selectedApp && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              {statusBadge(selectedApp.status)}
              <span className="text-xs text-muted-foreground">Applied {fmtDate(selectedApp.created_at)}</span>
            </div>

            <Card className="p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Applicant</h3>
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={selectedApp.email} />
              {selectedApp.phone && <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={selectedApp.phone} />}
              {selectedApp.prospects?.phone_number && <InfoRow icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" value={selectedApp.prospects.phone_number} />}
              {selectedApp.current_address && <InfoRow icon={<Home className="h-4 w-4" />} label="Current address" value={selectedApp.current_address} />}
            </Card>

            {(selectedApp.employment_status || selectedApp.employer_name || selectedApp.monthly_income) && (
              <Card className="p-4 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employment</h3>
                {selectedApp.employment_status && <InfoRow icon={<Calendar className="h-4 w-4" />} label="Status" value={selectedApp.employment_status.replace("_", " ")} />}
                {selectedApp.employer_name && <InfoRow icon={<Home className="h-4 w-4" />} label="Employer" value={selectedApp.employer_name} />}
                {selectedApp.monthly_income && <InfoRow icon={<FileText className="h-4 w-4" />} label="Monthly income" value={`£${selectedApp.monthly_income.toLocaleString()}`} />}
              </Card>
            )}

            {selectedApp.references_text && (
              <Card className="p-4 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">References</h3>
                <p className="text-sm whitespace-pre-line text-muted-foreground">{selectedApp.references_text}</p>
              </Card>
            )}

            {selectedApp.additional_info && (
              <Card className="p-4 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Additional Notes</h3>
                <p className="text-sm whitespace-pre-line text-muted-foreground">{selectedApp.additional_info}</p>
              </Card>
            )}

            {selectedApp.prospects?.conversation_summary && (
              <Card className="p-4 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">WhatsApp Conversation Summary</h3>
                <p className="text-sm whitespace-pre-line text-muted-foreground">{selectedApp.prospects.conversation_summary}</p>
              </Card>
            )}

            {selectedApp.status === "pending" && (
              <div className="space-y-4 border-t border-border pt-4">
                <h3 className="text-sm font-semibold">Review Application</h3>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Lease Agreement Text <span className="text-red-500">*</span></label>
                  <p className="text-xs text-muted-foreground">Paste the full lease text to send for signing.</p>
                  <textarea className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-mono"
                    value={leaseText} onChange={(e) => setLeaseText(e.target.value)} placeholder="TENANCY AGREEMENT&#10;&#10;Landlord: ..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Landlord Notes (internal)</label>
                  <Input value={landlordNotes} onChange={(e) => setLandlordNotes(e.target.value)} placeholder="Optional notes for your records..." />
                </div>
                {actionError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{actionError}</div>}
                {actionSuccess && <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400 whitespace-pre-line">{actionSuccess}</div>}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10" disabled={actionLoading} onClick={handleReject}>
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}Reject
                  </Button>
                  <Button className="flex-1 gap-2" disabled={actionLoading} onClick={handleApprove}>
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Approve &amp; Send Lease
                  </Button>
                </div>
              </div>
            )}

            {["approved", "lease_sent", "signed"].includes(selectedApp.status) && (
              <div className="space-y-3 border-t border-border pt-4">
                {selectedApp.status === "lease_sent" && (
                  <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-400 flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 shrink-0" />Lease sent for signing — awaiting applicant signature.
                  </div>
                )}
                {selectedApp.status === "signed" && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0" />Lease signed! The applicant has completed the signing process.
                  </div>
                )}
                {selectedApp.landlord_notes && <p className="text-xs text-muted-foreground">Notes: {selectedApp.landlord_notes}</p>}
              </div>
            )}
          </div>
        )}
      </DrawerPanel>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground block">{label}</span>
        <span className="text-sm break-words">{value}</span>
      </div>
    </div>
  );
}
