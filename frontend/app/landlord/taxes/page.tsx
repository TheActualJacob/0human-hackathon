'use client';

import { useState, useEffect } from "react";
import {
  Receipt, Brain, Download, Plus, Trash2, Loader2,
  TrendingUp, ShieldCheck, Calculator, AlertTriangle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import useLandlordStore from "@/lib/store/landlord";
import useAuthStore from "@/lib/store/auth";
import { getCurrentUser } from "@/lib/auth/client";
import type { Database } from "@/lib/supabase/database.types";

type Lease = Database['public']['Tables']['leases']['Row'];

// ── helpers ──────────────────────────────────────────────────────────────────

function activeMonthsInYear(lease: Lease, year: number): number {
  const yearEnd = new Date(year, 11, 31);
  const leaseStart = new Date(lease.start_date);
  const leaseEnd = lease.end_date ? new Date(lease.end_date) : yearEnd;
  const overlapStart = leaseStart > new Date(year, 0, 1) ? leaseStart : new Date(year, 0, 1);
  const overlapEnd = leaseEnd < yearEnd ? leaseEnd : yearEnd;
  if (overlapEnd < overlapStart) return 0;
  let count = 0;
  for (let m = 0; m < 12; m++) {
    const mStart = new Date(year, m, 1);
    const mEnd = new Date(year, m + 1, 0);
    if (overlapStart <= mEnd && overlapEnd >= mStart) count++;
  }
  return count;
}

// UK 2024/25 constants
const PERSONAL_ALLOWANCE = 12_570;
const BASIC_RATE_LIMIT = 50_270;
const BASIC_RATE = 0.20;
const HIGHER_RATE = 0.40;

function estimateTax(taxableProfit: number): { basic: number; higher: number; total: number } {
  if (taxableProfit <= 0) return { basic: 0, higher: 0, total: 0 };
  const afterAllowance = Math.max(0, taxableProfit - PERSONAL_ALLOWANCE);
  const basic = Math.min(afterAllowance, BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE) * BASIC_RATE;
  const higher = Math.max(0, afterAllowance - (BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE)) * HIGHER_RATE;
  return { basic: Math.max(0, basic), higher, total: Math.max(0, basic) + higher };
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Deduction {
  id: string;
  label: string;
  amount: number;
}

const STORAGE_KEY = 'propai_tax_deductions';

// ── component ─────────────────────────────────────────────────────────────────

export default function LandlordTaxesPage() {
  const { leases, loading, fetchLandlordData } = useLandlordStore();
  const { user } = useAuthStore();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [deductions, setDeductions] = useState<Record<number, Deduction[]>>({});
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Load data
  useEffect(() => {
    async function load() {
      let currentUser = user;
      if (!currentUser) {
        currentUser = await getCurrentUser();
        if (currentUser) useAuthStore.getState().setUser(currentUser);
      }
      if (currentUser?.entityId) fetchLandlordData(currentUser.entityId);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist deductions to localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setDeductions(JSON.parse(stored));
    } catch {}
  }, []);

  const saveDeductions = (next: Record<number, Deduction[]>) => {
    setDeductions(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  // ── computations ──────────────────────────────────────────────────────────

  const availableYears = [...new Set([
    new Date().getFullYear(),
    ...leases.map(l => new Date(l.start_date).getFullYear()),
    ...leases.filter(l => l.end_date).map(l => new Date(l.end_date!).getFullYear()),
  ])].sort((a, b) => b - a);

  const relevantLeases = leases.filter(l =>
    ['active', 'expired', 'terminated', 'notice_given'].includes(l.status ?? '') &&
    new Date(l.start_date).getFullYear() <= selectedYear &&
    (!l.end_date || new Date(l.end_date).getFullYear() >= selectedYear)
  );

  const grossIncome = relevantLeases.reduce(
    (s, l) => s + l.monthly_rent * activeMonthsInYear(l, selectedYear), 0
  );

  const yearDeductions: Deduction[] = deductions[selectedYear] ?? [];
  const totalDeductions = yearDeductions.reduce((s, d) => s + d.amount, 0);
  const taxableProfit = Math.max(0, grossIncome - totalDeductions);
  const tax = estimateTax(taxableProfit);

  // ── deduction actions ─────────────────────────────────────────────────────

  const addDeduction = () => {
    const amt = parseFloat(newAmount);
    if (!newLabel.trim() || isNaN(amt) || amt <= 0) return;
    const next = {
      ...deductions,
      [selectedYear]: [
        ...(deductions[selectedYear] ?? []),
        { id: crypto.randomUUID(), label: newLabel.trim(), amount: amt },
      ],
    };
    saveDeductions(next);
    setNewLabel('');
    setNewAmount('');
  };

  const removeDeduction = (id: string) => {
    const next = {
      ...deductions,
      [selectedYear]: (deductions[selectedYear] ?? []).filter(d => d.id !== id),
    };
    saveDeductions(next);
  };

  // ── AI summary ────────────────────────────────────────────────────────────

  const handleAiSummary = () => {
    setSummaryLoading(true);
    setTimeout(() => {
      const band = taxableProfit > BASIC_RATE_LIMIT ? 'higher rate (40%)' : 'basic rate (20%)';
      setAiSummary(
        `Tax Year ${selectedYear} — AI Tax Summary\n\n` +
        `Gross rental income:    €${Math.round(grossIncome).toLocaleString()}\n` +
        `Allowable deductions:   €${Math.round(totalDeductions).toLocaleString()}\n` +
        `Taxable profit:         €${Math.round(taxableProfit).toLocaleString()}\n` +
        `Estimated tax owed:     €${Math.round(tax.total).toLocaleString()} (${band})\n\n` +
        `Common deductions you may be missing:\n` +
        `• Mortgage interest (20% tax credit on finance costs)\n` +
        `• Letting agent & management fees\n` +
        `• Property repairs & maintenance\n` +
        `• Landlord insurance\n` +
        `• Council tax during void periods\n` +
        `• Accountancy & legal fees\n\n` +
        `Self Assessment deadline: 31 January ${selectedYear + 1}.\n` +
        `Keep all receipts for at least 5 years. Consider speaking to a qualified tax advisor.`
      );
      setSummaryLoading(false);
    }, 800);
  };

  // ── export ────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const rows = [
      [`Tax Year`, String(selectedYear)],
      [`Gross Rental Income (€)`, Math.round(grossIncome).toString()],
      [`Total Deductions (€)`, Math.round(totalDeductions).toString()],
      [`Taxable Profit (€)`, Math.round(taxableProfit).toString()],
      [`Estimated Tax (€)`, Math.round(tax.total).toString()],
      [''],
      ['Deduction', 'Amount (€)'],
      ...yearDeductions.map(d => [d.label, d.amount.toFixed(2)]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `taxes-${selectedYear}.csv`;
    a.click();
  };

  // ── render ────────────────────────────────────────────────────────────────

  const summaryRows = [
    { label: 'Gross Rental Income', value: `€${Math.round(grossIncome).toLocaleString()}`, icon: TrendingUp, color: 'text-primary' },
    { label: 'Allowable Deductions', value: `−€${Math.round(totalDeductions).toLocaleString()}`, icon: ShieldCheck, color: 'text-green-400' },
    { label: 'Taxable Profit', value: `€${Math.round(taxableProfit).toLocaleString()}`, icon: Calculator, color: 'text-blue-400' },
    { label: 'Estimated Tax Owed', value: `€${Math.round(tax.total).toLocaleString()}`, icon: AlertTriangle, color: tax.total > 0 ? 'text-yellow-400' : 'text-muted-foreground' },
  ];

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Receipt className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Taxes</h1>
            <p className="text-sm text-muted-foreground">Rental income tax estimate for Self Assessment</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={String(selectedYear)}
            onValueChange={v => { setSelectedYear(Number(v)); setAiSummary(null); }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleAiSummary} disabled={summaryLoading}>
            {summaryLoading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
              : <><Brain className="h-4 w-4 mr-2" />AI Summary</>}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        </div>
      </div>

      {/* Tax Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        {summaryRows.map(row => (
          <Card key={row.label} className="p-5 flex items-center gap-4">
            <row.icon className={`h-8 w-8 ${row.color} shrink-0`} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">{row.label}</div>
              <div className="text-xl font-bold">{loading ? '—' : row.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tax Band Breakdown */}
      {!loading && taxableProfit > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Tax Band Breakdown (UK 2024/25)</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Personal allowance (tax-free)</span>
              <span>€{Math.min(taxableProfit, PERSONAL_ALLOWANCE).toLocaleString()}</span>
            </div>
            {tax.basic > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Basic rate (20%)</span>
                <span className="text-yellow-400">€{Math.round(tax.basic).toLocaleString()}</span>
              </div>
            )}
            {tax.higher > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Higher rate (40%)</span>
                <span className="text-red-400">€{Math.round(tax.higher).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>Estimated total tax</span>
              <span className="text-primary">€{Math.round(tax.total).toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Estimate only. Does not account for other income sources, NI contributions, or individual circumstances.
          </p>
        </Card>
      )}

      {/* Deductions */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Allowable Deductions — {selectedYear}</h2>

        {/* Add deduction */}
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Letting agent fees"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDeduction()}
            className="flex-1"
          />
          <Input
            placeholder="€ amount"
            type="number"
            min="0"
            value={newAmount}
            onChange={e => setNewAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDeduction()}
            className="w-32"
          />
          <Button onClick={addDeduction} size="icon" variant="outline">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Deduction list */}
        {yearDeductions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No deductions added yet. Add expenses like agent fees, insurance, and repairs.
          </p>
        ) : (
          <div className="space-y-2">
            {yearDeductions.map(d => (
              <div key={d.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50">
                <span className="text-foreground">{d.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-green-400">−€{d.amount.toLocaleString()}</span>
                  <button onClick={() => removeDeduction(d.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-1 font-semibold">
              <span>Total deductions</span>
              <span className="text-green-400">−€{Math.round(totalDeductions).toLocaleString()}</span>
            </div>
          </div>
        )}
      </Card>

      {/* AI Summary Panel */}
      {aiSummary && (
        <Card className="p-6 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI Tax Summary</span>
          </div>
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {aiSummary}
          </pre>
        </Card>
      )}
    </div>
  );
}
