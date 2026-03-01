'use client';

import { useState, useEffect } from "react";
import {
  Receipt, Brain, Download, Loader2,
  TrendingUp, AlertTriangle, Calculator, Building2, FlaskConical,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import useLandlordStore from "@/lib/store/landlord";
import useAuthStore from "@/lib/store/auth";
import { getCurrentUser } from "@/lib/auth/client";
import type { Database } from "@/lib/supabase/database.types";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

type Lease = Database['public']['Tables']['leases']['Row'];

// ── helpers ───────────────────────────────────────────────────────────────────

function activeMonthsInYear(
  lease: { start_date: string; end_date?: string | null },
  year: number
): number {
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

// ── Greek rental income tax (Article 40, Law 4172/2013 — current as of 2024) ──
// Tax is assessed on GROSS rental income. No deductions are permitted.
// Update this array if Greek tax law changes.
const GR_TAX_BRACKETS = [
  { label: 'Band 1: up to €12,000',      from: 0,      to: 12_000,   rate: 0.15 },
  { label: 'Band 2: €12,001 – €35,000',  from: 12_000, to: 35_000,   rate: 0.35 },
  { label: 'Band 3: above €35,000',       from: 35_000, to: Infinity, rate: 0.45 },
] as const;

interface TaxBreakdown {
  bands: number[];   // tax owed per bracket, aligned with GR_TAX_BRACKETS
  total: number;
  effectiveRate: number;
}

function computeGreekRentalTax(grossIncome: number): TaxBreakdown {
  if (grossIncome <= 0) {
    return { bands: GR_TAX_BRACKETS.map(() => 0), total: 0, effectiveRate: 0 };
  }
  const bands = GR_TAX_BRACKETS.map(({ from, to, rate }) => {
    const taxable = Math.max(0, Math.min(grossIncome, to) - from);
    return Math.round(taxable * rate);
  });
  const total = bands.reduce((s, b) => s + b, 0);
  const effectiveRate = (total / grossIncome) * 100;
  return { bands, total, effectiveRate };
}

// ── mock landlord data ────────────────────────────────────────────────────────

const MOCK_LEASES = [
  {
    id: 'mock-1',
    start_date: '2024-01-01',
    end_date: null,
    monthly_rent: 1_100,
    status: 'active',
    units: { address: 'Vouliagmenis 48, Glyfada', unit_identifier: 'Apt 2B' },
    tenants: { full_name: 'Nikos Papadimitriou' },
  },
  {
    id: 'mock-2',
    start_date: '2024-04-01',
    end_date: '2024-11-30',
    monthly_rent: 850,
    status: 'expired',
    units: { address: 'Ermou 12, Kolonaki, Athens', unit_identifier: 'Floor 3' },
    tenants: { full_name: 'Maria Economou' },
  },
  {
    id: 'mock-3',
    start_date: '2023-09-01',
    end_date: null,
    monthly_rent: 1_400,
    status: 'active',
    units: { address: 'Poseidonos 7, Paleo Faliro', unit_identifier: 'Studio A' },
    tenants: { full_name: 'Dimitris Alexiou' },
  },
];

// ── PDF export ─────────────────────────────────────────────────────────────────

interface PDFData {
  year: number;
  landlordName: string;
  grossIncome: number;
  tax: TaxBreakdown;
  leaseBreakdown: Array<{ address: string; months: number; rent: number; income: number }>;
  isMock: boolean;
}

async function exportToPDF(data: PDFData) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const margin = 48;
  const contentWidth = W - margin * 2;

  let page = doc.addPage([W, H]);
  let y = H - margin;

  const dark = rgb(0.04, 0.04, 0.06);
  const accent = rgb(0.13, 0.77, 0.37);
  const muted = rgb(0.45, 0.45, 0.5);
  const white = rgb(1, 1, 1);
  const lightGray = rgb(0.96, 0.96, 0.96);
  const red = rgb(0.9, 0.25, 0.25);
  const yellow = rgb(0.95, 0.7, 0.1);

  // WinAnsi standard fonts cannot encode characters outside Windows-1252.
  const sanitize = (s: string) =>
    s
      .replace(/\u2212/g, '-')
      .replace(/\u2014/g, '-')
      .replace(/\u2013/g, '-')
      .replace(/\u2019/g, "'")
      .replace(/\u2018/g, "'")
      .replace(/\u201c/g, '"')
      .replace(/\u201d/g, '"')
      .replace(/\u00b7/g, '.')
      .replace(/\u20ac/g, 'EUR')
      .replace(/[^\x00-\xff]/g, '?');

  const line = (x1: number, y1: number, x2: number, y2: number, color = muted, thickness = 0.5) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  };
  const rect = (x: number, yPos: number, w: number, h: number, color: ReturnType<typeof rgb>) => {
    page.drawRectangle({ x, y: yPos, width: w, height: h, color });
  };
  const text = (
    str: string,
    x: number,
    yPos: number,
    opts: { size?: number; font?: typeof regular; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' | 'center' } = {}
  ) => {
    const { size = 10, font = regular, color = dark, align = 'left' } = opts;
    const safe = sanitize(str);
    let drawX = x;
    if (align === 'right') {
      drawX = x - font.widthOfTextAtSize(safe, size);
    } else if (align === 'center') {
      drawX = x - font.widthOfTextAtSize(safe, size) / 2;
    }
    page.drawText(safe, { x: drawX, y: yPos, size, font, color });
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin + 40) {
      page = doc.addPage([W, H]);
      y = H - margin;
      drawPageHeader();
    }
  };

  const drawPageHeader = () => {
    rect(0, H - 36, W, 36, dark);
    text('PropAI', margin, H - 24, { size: 14, font: bold, color: white });
    text(`Greek Rental Tax Estimate ${data.year}`, margin + 70, H - 24, { size: 10, color: rgb(0.6, 0.6, 0.65) });
    const dateStr = `Generated ${new Date().toLocaleDateString('en-GR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    text(dateStr, W - margin, H - 24, { size: 9, color: rgb(0.6, 0.6, 0.65), align: 'right' });
  };

  drawPageHeader();
  y = H - 36 - 30;

  if (data.isMock) {
    rect(margin, y - 16, contentWidth, 22, rgb(0.95, 0.85, 0.1));
    text('DEMO DATA - This report uses mock data for illustration purposes only', margin + 8, y - 10, { size: 9, font: bold, color: rgb(0.4, 0.3, 0) });
    y -= 36;
  }

  // ─ Title block
  text('Greek Rental Income Tax Estimate', margin, y, { size: 20, font: bold, color: dark });
  y -= 18;
  text(`Tax Year ${data.year}  |  ${data.landlordName}`, margin, y, { size: 11, color: muted });
  y -= 12;
  text('Article 40, Law 4172/2013 - Tax on gross rental income; no deductions permitted.', margin, y, { size: 8, color: muted });
  y -= 32;

  // ─ 3 summary boxes
  const boxW = (contentWidth - 8) / 3;
  const summaryBoxes = [
    { label: 'Gross Rental Income', value: `EUR ${data.grossIncome.toLocaleString()}`, color: accent },
    { label: 'Estimated Tax Owed',  value: `EUR ${data.tax.total.toLocaleString()}`,   color: data.tax.total > 0 ? yellow : accent },
    { label: 'Effective Tax Rate',  value: `${data.tax.effectiveRate.toFixed(1)}%`,    color: rgb(0.3, 0.6, 0.95) },
  ];
  summaryBoxes.forEach((box, i) => {
    const bx = margin + i * (boxW + 4);
    rect(bx, y - 60, boxW, 64, lightGray);
    text(box.label, bx + 8, y - 14, { size: 8, color: muted });
    text(box.value, bx + 8, y - 40, { size: 13, font: bold, color: box.color });
  });
  y -= 80;

  // ─ Tax breakdown
  ensureSpace(120);
  text('TAX BREAKDOWN — GREEK RENTAL INCOME TAX (Article 40, Law 4172/2013)', margin, y, { size: 9, font: bold, color: muted });
  y -= 14;
  line(margin, y, W - margin, y);
  y -= 14;

  GR_TAX_BRACKETS.forEach(({ label, rate }, i) => {
    const bandTax = data.tax.bands[i];
    if (bandTax > 0 || i === 0) {
      text(`${label} @ ${(rate * 100).toFixed(0)}%`, margin, y, { size: 10 });
      text(`EUR ${bandTax.toLocaleString()}`, W - margin, y, { align: 'right', size: 10, font: bold });
      y -= 18;
    }
  });

  y -= 4;
  line(margin, y, W - margin, y, dark, 1);
  y -= 14;
  text('TOTAL ESTIMATED TAX', margin, y, { size: 10, font: bold });
  text(`${data.tax.effectiveRate.toFixed(1)}% effective rate`, margin + 180, y, { size: 9, color: muted });
  text(`EUR ${data.tax.total.toLocaleString()}`, W - margin, y, { align: 'right', size: 12, font: bold, color: red });
  y -= 30;

  // ─ ENFIA note
  ensureSpace(36);
  rect(margin, y - 20, contentWidth, 24, rgb(0.97, 0.94, 0.88));
  text(
    'Note: ENFIA (property tax) is a separate annual obligation and is NOT included in this estimate.',
    margin + 8, y - 10,
    { size: 8, color: rgb(0.5, 0.35, 0.05) }
  );
  y -= 38;

  // ─ Income per property
  ensureSpace(40 + data.leaseBreakdown.length * 22);
  text('RENTAL INCOME BY PROPERTY', margin, y, { size: 9, font: bold, color: muted });
  y -= 14;
  line(margin, y, W - margin, y);
  y -= 14;

  rect(margin, y - 4, contentWidth, 18, rgb(0.93, 0.93, 0.95));
  text('Property',     margin + 6,   y + 2, { size: 8, font: bold, color: muted });
  text('Months',       margin + 320, y + 2, { size: 8, font: bold, color: muted, align: 'right' });
  text('Monthly Rent', margin + 400, y + 2, { size: 8, font: bold, color: muted, align: 'right' });
  text('Total Income', W - margin,   y + 2, { size: 8, font: bold, color: muted, align: 'right' });
  y -= 20;

  data.leaseBreakdown.forEach((row, i) => {
    if (i % 2 === 0) rect(margin, y - 4, contentWidth, 18, rgb(0.98, 0.98, 0.99));
    text(row.address,                             margin + 6,   y + 2, { size: 9 });
    text(String(row.months),                      margin + 320, y + 2, { size: 9, align: 'right' });
    text(`EUR ${row.rent.toLocaleString()}/mo`,   margin + 400, y + 2, { size: 9, align: 'right' });
    text(`EUR ${row.income.toLocaleString()}`,    W - margin,   y + 2, { size: 9, font: bold, align: 'right', color: accent });
    y -= 20;
  });

  y -= 4;
  line(margin, y, W - margin, y);
  y -= 14;
  text('Total gross rental income', margin, y, { size: 10, font: bold });
  text(`EUR ${data.grossIncome.toLocaleString()}`, W - margin, y, { size: 10, font: bold, align: 'right' });
  y -= 28;

  // ─ Disclaimer
  ensureSpace(70);
  rect(margin, y - 54, contentWidth, 58, rgb(0.97, 0.97, 0.97));
  text('Important Disclaimer', margin + 8, y - 8, { size: 8, font: bold, color: muted });
  const disclaimer =
    'This report is an estimate only and does not constitute tax advice. ' +
    'Figures are based on Greek rental income tax rates (Article 40, Law 4172/2013). ' +
    'Tax is assessed on gross rental income; no expenses or deductions are permitted under Greek law for this income category. ' +
    'ENFIA property tax is a separate obligation and is not included here. ' +
    'File via Taxisnet (E1/E2 forms) by 30 June. Consult a certified Greek accountant (logistis) before filing.';
  const words = sanitize(disclaimer).split(' ');
  let lineStr = '';
  let dy = y - 22;
  words.forEach((word) => {
    const test = lineStr ? `${lineStr} ${word}` : word;
    if (regular.widthOfTextAtSize(test, 7.5) > contentWidth - 16) {
      text(lineStr, margin + 8, dy, { size: 7.5, color: muted });
      dy -= 11;
      lineStr = word;
    } else {
      lineStr = test;
    }
  });
  if (lineStr) text(lineStr, margin + 8, dy, { size: 7.5, color: muted });
  y -= 68;

  // ─ Footer
  const footerY = margin - 8;
  line(margin, footerY + 20, W - margin, footerY + 20, muted, 0.5);
  text('PropAI - Rental Management Platform', margin, footerY + 8, { size: 8, color: muted });
  text(`Tax Year ${data.year}`, W - margin, footerY + 8, { size: 8, color: muted, align: 'right' });

  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `propai-greek-rental-tax-${data.year}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── component ─────────────────────────────────────────────────────────────────

export default function LandlordTaxesPage() {
  const { leases, loading, fetchLandlordData } = useLandlordStore();
  const { user } = useAuthStore();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

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

  // ── computed values ───────────────────────────────────────────────────────

  const activeLeaseSrc = demoMode ? MOCK_LEASES : leases;

  const relevantLeases = demoMode
    ? MOCK_LEASES.filter(l =>
        new Date(l.start_date).getFullYear() <= selectedYear &&
        (!l.end_date || new Date(l.end_date).getFullYear() >= selectedYear)
      )
    : leases.filter(l =>
        ['active', 'expired', 'terminated', 'notice_given'].includes(l.status ?? '') &&
        new Date(l.start_date).getFullYear() <= selectedYear &&
        (!l.end_date || new Date(l.end_date).getFullYear() >= selectedYear)
      );

  const leaseBreakdown = relevantLeases.map(l => {
    const months = activeMonthsInYear(l, selectedYear);
    const rent = l.monthly_rent;
    return {
      address: (l as any).units
        ? `${(l as any).units.address}${(l as any).units.unit_identifier ? ` - ${(l as any).units.unit_identifier}` : ''}`
        : 'Property',
      months,
      rent,
      income: months * rent,
    };
  });

  const grossIncome = leaseBreakdown.reduce((s, r) => s + r.income, 0);
  const tax = computeGreekRentalTax(grossIncome);

  const availableYears = [...new Set([
    new Date().getFullYear(),
    ...activeLeaseSrc.map(l => new Date(l.start_date).getFullYear()),
    ...activeLeaseSrc.filter(l => l.end_date).map(l => new Date(l.end_date!).getFullYear()),
  ])].sort((a, b) => b - a);

  // ── AI summary ────────────────────────────────────────────────────────────

  const handleAiSummary = () => {
    setSummaryLoading(true);
    setTimeout(() => {
      const topBand = grossIncome > 35_000 ? 'top band (45%)' : grossIncome > 12_000 ? 'middle band (35%)' : 'first band (15%)';
      setAiSummary(
        `Greek Rental Income Tax Estimate — ${selectedYear}\n` +
        `(Article 40, Law 4172/2013)\n\n` +
        `Gross rental income:          €${Math.round(grossIncome).toLocaleString()}\n` +
        `(No deductions permitted under Greek law)\n\n` +
        `Tax by bracket (currently in ${topBand}):\n` +
        `  Band 1: up to €12,000 @ 15%:       €${tax.bands[0].toLocaleString()}\n` +
        (grossIncome > 12_000 ? `  Band 2: €12,001–€35,000 @ 35%:     €${tax.bands[1].toLocaleString()}\n` : '') +
        (grossIncome > 35_000 ? `  Band 3: above €35,000 @ 45%:       €${tax.bands[2].toLocaleString()}\n` : '') +
        `  ─────────────────────────────────────────\n` +
        `  Total estimated tax:          €${tax.total.toLocaleString()}\n` +
        `  Effective rate:               ${tax.effectiveRate.toFixed(1)}%\n\n` +
        `Note: ENFIA (property tax) is a separate annual\n` +
        `obligation and is NOT included in this estimate.\n\n` +
        `Filing: Submit via Taxisnet (E1/E2 forms) by 30 June ${selectedYear + 1}.\n` +
        `Consult a certified Greek accountant (logistis) before filing.`
      );
      setSummaryLoading(false);
    }, 800);
  };

  // ── PDF export ────────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    setExportLoading(true);
    try {
      await exportToPDF({
        year: selectedYear,
        landlordName: demoMode ? 'Manolis Papadopoulos (Demo)' : (user?.email ?? 'Landlord'),
        grossIncome: Math.round(grossIncome),
        tax,
        leaseBreakdown,
        isMock: demoMode,
      });
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExportLoading(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  const isLoading = !demoMode && loading;

  const summaryCards = [
    {
      label: 'Gross Rental Income',
      value: `€${Math.round(grossIncome).toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-primary',
    },
    {
      label: 'Estimated Tax Owed',
      value: `€${tax.total.toLocaleString()}`,
      icon: AlertTriangle,
      color: tax.total > 0 ? 'text-yellow-400' : 'text-muted-foreground',
    },
    {
      label: 'Effective Tax Rate',
      value: grossIncome > 0 ? `${tax.effectiveRate.toFixed(1)}%` : '—',
      icon: Calculator,
      color: 'text-blue-400',
    },
  ];

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Receipt className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Greek Rental Income Tax Estimate</h1>
            <p className="text-sm text-muted-foreground">
              Article 40, Law 4172/2013 · Tax on gross rental income · {selectedYear}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={demoMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setDemoMode(d => !d); setAiSummary(null); }}
            className={demoMode ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''}
          >
            <FlaskConical className="h-4 w-4 mr-1.5" />
            {demoMode ? 'Exit Demo' : 'Demo Mode'}
          </Button>
          <Select
            value={String(selectedYear)}
            onValueChange={v => { setSelectedYear(Number(v)); setAiSummary(null); }}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleAiSummary} disabled={summaryLoading}>
            {summaryLoading
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Generating…</>
              : <><Brain className="h-4 w-4 mr-1.5" />AI Summary</>}
          </Button>
          <Button size="sm" onClick={handleExportPDF} disabled={exportLoading}>
            {exportLoading
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Exporting…</>
              : <><Download className="h-4 w-4 mr-1.5" />Export PDF</>}
          </Button>
        </div>
      </div>

      {/* Demo banner */}
      {demoMode && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          <FlaskConical className="h-4 w-4 shrink-0" />
          <span>
            <strong>Demo Mode</strong> — Using mock landlord data (Manolis Papadopoulos, 3 Athens-area apartments).
            Export PDF to see the full formatted report.
          </span>
        </div>
      )}

      {/* ENFIA notice */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          <strong>ENFIA not included.</strong> ENFIA (property tax) is a separate annual obligation and is not part of this rental income tax estimate.
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryCards.map(row => (
          <Card key={row.label} className="p-4 flex items-center gap-3">
            <row.icon className={`h-7 w-7 ${row.color} shrink-0`} />
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">{row.label}</div>
              <div className="text-lg font-bold">{isLoading ? '—' : row.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tax breakdown */}
      {!isLoading && grossIncome > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Tax Breakdown — Greek Rental Income Tax {selectedYear}
            </h2>
            <Badge variant="outline" className="text-xs">
              {tax.effectiveRate.toFixed(1)}% effective rate
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            {GR_TAX_BRACKETS.map(({ label, rate }, i) => {
              const bandTax = tax.bands[i];
              if (bandTax === 0 && i > 0) return null;
              return (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{label} ({(rate * 100).toFixed(0)}%)</span>
                  <span className="font-medium">€{bandTax.toLocaleString()}</span>
                </div>
              );
            })}
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>Total estimated tax owed</span>
              <span className="text-yellow-400">€{tax.total.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Estimate only. Tax is assessed on gross rental income — no deductions are permitted under Greek law (Article 40, Law 4172/2013).
            Consult a certified Greek accountant (logistis) and file via Taxisnet (E1/E2 forms) by 30 June.
          </p>
        </Card>
      )}

      {/* Income by property */}
      {leaseBreakdown.length > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Rental Income by Property — {selectedYear}
          </h2>
          <div className="divide-y divide-border/50 text-sm">
            {leaseBreakdown.map((row, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{row.address}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.months} months × €{row.rent.toLocaleString()}/mo
                  </div>
                </div>
                <span className="font-semibold text-primary">€{row.income.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-bold">
              <span>Total gross rental income</span>
              <span>€{Math.round(grossIncome).toLocaleString()}</span>
            </div>
          </div>
        </Card>
      )}

      {/* AI Summary */}
      {aiSummary && (
        <Card className="p-6 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI Tax Summary</span>
          </div>
          <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
            {aiSummary}
          </pre>
        </Card>
      )}
    </div>
  );
}
