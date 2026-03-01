'use client';

import { useState, useEffect } from "react";
import {
  Receipt, Brain, Download, Plus, Trash2, Loader2,
  TrendingUp, ShieldCheck, Calculator, AlertTriangle,
  Building2, FlaskConical,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// ── helpers ──────────────────────────────────────────────────────────────────

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

// Greek rental income tax rates (Article 40, Law 4172/2013 — current as of 2024)
// Band 1: up to €12,000 → 15%
// Band 2: €12,001 – €35,000 → 35%
// Band 3: above €35,000 → 45%
// No personal allowance on rental income. No USC/PRSI equivalent.
const GR_BAND_1_LIMIT = 12_000;
const GR_BAND_2_LIMIT = 35_000;
const GR_RATE_1 = 0.15;
const GR_RATE_2 = 0.35;
const GR_RATE_3 = 0.45;

interface TaxResult {
  incomeTax: number;
  usc: number;   // repurposed: stamp duty / surcharge (kept at 0 for Greece)
  prsi: number;  // repurposed: special solidarity contribution (suspended since 2023)
  total: number;
  effectiveRate: number;
}

function estimateTax(taxableProfit: number): TaxResult {
  if (taxableProfit <= 0) return { incomeTax: 0, usc: 0, prsi: 0, total: 0, effectiveRate: 0 };

  // Greek progressive rental income tax
  let incomeTax = 0;
  if (taxableProfit <= GR_BAND_1_LIMIT) {
    incomeTax = taxableProfit * GR_RATE_1;
  } else if (taxableProfit <= GR_BAND_2_LIMIT) {
    incomeTax = GR_BAND_1_LIMIT * GR_RATE_1 + (taxableProfit - GR_BAND_1_LIMIT) * GR_RATE_2;
  } else {
    incomeTax =
      GR_BAND_1_LIMIT * GR_RATE_1 +
      (GR_BAND_2_LIMIT - GR_BAND_1_LIMIT) * GR_RATE_2 +
      (taxableProfit - GR_BAND_2_LIMIT) * GR_RATE_3;
  }

  const total = incomeTax;
  const effectiveRate = taxableProfit > 0 ? (total / taxableProfit) * 100 : 0;

  return {
    incomeTax: Math.round(incomeTax),
    usc: 0,
    prsi: 0,
    total: Math.round(total),
    effectiveRate,
  };
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Deduction {
  id: string;
  label: string;
  amount: number;
  category: string;
}

const DEDUCTION_CATEGORIES = [
  'Mortgage interest',
  'Agent / management fees',
  'Repairs & maintenance',
  'Insurance',
  'Professional fees',
  'Council tax / void periods',
  'Other',
];

const STORAGE_KEY = 'propai_tax_deductions_v2';

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

const MOCK_DEDUCTIONS: Deduction[] = [
  { id: 'm1', label: 'Mortgage interest (Glyfada property)', amount: 2_800, category: 'Mortgage interest' },
  { id: 'm2', label: 'Property management fees (all)', amount: 1_980, category: 'Agent / management fees' },
  { id: 'm3', label: 'Plumbing & AC maintenance', amount: 620, category: 'Repairs & maintenance' },
  { id: 'm4', label: 'Landlord insurance (all properties)', amount: 960, category: 'Insurance' },
  { id: 'm5', label: 'Accountant / tax advisor fees', amount: 500, category: 'Professional fees' },
];

// ── PDF export ─────────────────────────────────────────────────────────────────

interface PDFData {
  year: number;
  landlordName: string;
  grossIncome: number;
  totalDeductions: number;
  taxableProfit: number;
  tax: TaxResult;
  deductions: Deduction[];
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

  // WinAnsi standard fonts can't encode characters outside Windows-1252.
  // Replace the most common Unicode-only characters with safe ASCII equivalents.
  const sanitize = (s: string) =>
    s
      .replace(/\u2212/g, '-')   // MINUS SIGN → hyphen
      .replace(/\u2014/g, '-')   // EM DASH → hyphen
      .replace(/\u2013/g, '-')   // EN DASH → hyphen
      .replace(/\u2019/g, "'")   // RIGHT SINGLE QUOTATION → apostrophe
      .replace(/\u2018/g, "'")   // LEFT SINGLE QUOTATION → apostrophe
      .replace(/\u201c/g, '"')   // LEFT DOUBLE QUOTATION → quote
      .replace(/\u201d/g, '"')   // RIGHT DOUBLE QUOTATION → quote
      .replace(/\u00b7/g, '.')   // MIDDLE DOT → period
      .replace(/[^\x00-\xff]/g, '?'); // catch-all for anything else outside Latin-1

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
      const w = font.widthOfTextAtSize(safe, size);
      drawX = x - w;
    } else if (align === 'center') {
      const w = font.widthOfTextAtSize(safe, size);
      drawX = x - w / 2;
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
    text(`Tax Report ${data.year}`, margin + 70, H - 24, { size: 10, color: rgb(0.6, 0.6, 0.65) });
    const dateStr = `Generated ${new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    text(dateStr, W - margin, H - 24, { size: 9, color: rgb(0.6, 0.6, 0.65), align: 'right' });
  };

  // ─ Header
  drawPageHeader();
  y = H - 36 - 30;

  if (data.isMock) {
    rect(margin, y - 16, contentWidth, 22, rgb(0.95, 0.85, 0.1));
    text('DEMO DATA - This report uses mock data for illustration purposes only', margin + 8, y - 10, { size: 9, font: bold, color: rgb(0.4, 0.3, 0) });
    y -= 36;
  }

  // ─ Title block
  text(`Rental Income Tax Summary`, margin, y, { size: 20, font: bold, color: dark });
  y -= 18;
  text(`Tax Year ${data.year}  ·  ${data.landlordName}`, margin, y, { size: 11, color: muted });
  y -= 32;

  // ─ 4 summary boxes
  const boxW = (contentWidth - 12) / 4;
  const summaryBoxes = [
    { label: 'Gross Rental Income', value: `€${data.grossIncome.toLocaleString()}`, color: accent },
    { label: 'Allowable Deductions', value: `-€${data.totalDeductions.toLocaleString()}`, color: rgb(0.2, 0.7, 0.4) },
    { label: 'Taxable Profit', value: `€${data.taxableProfit.toLocaleString()}`, color: rgb(0.3, 0.6, 0.95) },
    { label: 'Estimated Tax Owed', value: `€${data.tax.total.toLocaleString()}`, color: data.tax.total > 0 ? yellow : accent },
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
  text('TAX BREAKDOWN (GREECE 2024 - Article 40, Law 4172/2013)', margin, y, { size: 9, font: bold, color: muted });
  y -= 14;
  line(margin, y, W - margin, y);
  y -= 14;

  const gr1 = Math.round(Math.min(data.taxableProfit, 12_000) * 0.15);
  const gr2 = data.taxableProfit > 12_000 ? Math.round(Math.min(data.taxableProfit - 12_000, 23_000) * 0.35) : 0;
  const gr3 = data.taxableProfit > 35_000 ? Math.round((data.taxableProfit - 35_000) * 0.45) : 0;
  const taxRows: [string, string, string][] = [
    ['Band 1: up to EUR 12,000 @ 15%', '', `EUR ${gr1.toLocaleString()}`],
    ...(gr2 > 0 ? [['Band 2: EUR 12,001-35,000 @ 35%', '', `EUR ${gr2.toLocaleString()}`] as [string, string, string]] : []),
    ...(gr3 > 0 ? [['Band 3: above EUR 35,000 @ 45%', '', `EUR ${gr3.toLocaleString()}`] as [string, string, string]] : []),
  ];
  taxRows.forEach(([label, sub, val]) => {
    text(label, margin, y, { size: 10 });
    if (sub) text(sub, margin + 220, y, { size: 9, color: muted });
    text(val, W - margin, y, { align: 'right', size: 10, font: bold });
    y -= 18;
  });
  y -= 4;
  line(margin, y, W - margin, y, dark, 1);
  y -= 14;
  text('TOTAL ESTIMATED TAX', margin, y, { size: 10, font: bold });
  text(`${data.tax.effectiveRate.toFixed(1)}% effective rate`, margin + 180, y, { size: 9, color: muted });
  text(`€${data.tax.total.toLocaleString()}`, W - margin, y, { align: 'right', size: 12, font: bold, color: red });
  y -= 30;

  // ─ Income per property
  ensureSpace(40 + data.leaseBreakdown.length * 22);
  text('RENTAL INCOME BY PROPERTY', margin, y, { size: 9, font: bold, color: muted });
  y -= 14;
  line(margin, y, W - margin, y);
  y -= 14;

  rect(margin, y - 4, contentWidth, 18, rgb(0.93, 0.93, 0.95));
  text('Property', margin + 6, y + 2, { size: 8, font: bold, color: muted });
  text('Months', margin + 320, y + 2, { size: 8, font: bold, color: muted, align: 'right' });
  text('Monthly Rent', margin + 400, y + 2, { size: 8, font: bold, color: muted, align: 'right' });
  text('Total Income', W - margin, y + 2, { size: 8, font: bold, color: muted, align: 'right' });
  y -= 20;

  data.leaseBreakdown.forEach((row, i) => {
    if (i % 2 === 0) rect(margin, y - 4, contentWidth, 18, rgb(0.98, 0.98, 0.99));
    text(row.address, margin + 6, y + 2, { size: 9 });
    text(String(row.months), margin + 320, y + 2, { size: 9, align: 'right' });
    text(`€${row.rent.toLocaleString()}/mo`, margin + 400, y + 2, { size: 9, align: 'right' });
    text(`€${row.income.toLocaleString()}`, W - margin, y + 2, { size: 9, font: bold, align: 'right', color: accent });
    y -= 20;
  });

  y -= 4;
  line(margin, y, W - margin, y);
  y -= 14;
  text('Total gross rental income', margin, y, { size: 10, font: bold });
  text(`€${data.grossIncome.toLocaleString()}`, W - margin, y, { size: 10, font: bold, align: 'right' });
  y -= 28;

  // ─ Deductions
  ensureSpace(40 + data.deductions.length * 22);
  text('ALLOWABLE DEDUCTIONS', margin, y, { size: 9, font: bold, color: muted });
  y -= 14;
  line(margin, y, W - margin, y);
  y -= 14;

  if (data.deductions.length === 0) {
    text('No deductions recorded for this tax year.', margin, y, { size: 10, color: muted });
    y -= 20;
  } else {
    rect(margin, y - 4, contentWidth, 18, rgb(0.93, 0.93, 0.95));
    text('Description', margin + 6, y + 2, { size: 8, font: bold, color: muted });
    text('Category', margin + 320, y + 2, { size: 8, font: bold, color: muted });
    text('Amount', W - margin, y + 2, { size: 8, font: bold, color: muted, align: 'right' });
    y -= 20;

    data.deductions.forEach((d, i) => {
      if (i % 2 === 0) rect(margin, y - 4, contentWidth, 18, rgb(0.98, 0.98, 0.99));
      text(d.label, margin + 6, y + 2, { size: 9 });
      text(d.category, margin + 320, y + 2, { size: 9, color: muted });
      text(`−€${d.amount.toLocaleString()}`, W - margin, y + 2, { size: 9, font: bold, align: 'right', color: rgb(0.15, 0.65, 0.35) });
      y -= 20;
    });

    y -= 4;
    line(margin, y, W - margin, y);
    y -= 14;
    text('Total deductions', margin, y, { size: 10, font: bold });
    text(`−€${data.totalDeductions.toLocaleString()}`, W - margin, y, { size: 10, font: bold, align: 'right', color: rgb(0.15, 0.65, 0.35) });
    y -= 28;
  }

  // ─ Disclaimer
  ensureSpace(60);
  rect(margin, y - 42, contentWidth, 46, rgb(0.97, 0.97, 0.97));
  text('Important Disclaimer', margin + 8, y - 8, { size: 8, font: bold, color: muted });
  const disclaimer =
    'This report is an estimate only and does not constitute tax advice. Figures are based on Greek rental income tax rates (Article 40, Law 4172/2013) and deductions you have recorded. ' +
    'This estimate does not account for other income sources, credits, or individual circumstances. File via Taxisnet (E1/E2 forms) by 30 June. Please consult a certified Greek accountant before filing.';
  const words = sanitize(disclaimer).split(' ');
  let lineStr = '';
  let dy = y - 20;
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
  y -= 56;

  // ─ Footer
  const footerY = margin - 8;
  line(margin, footerY + 20, W - margin, footerY + 20, muted, 0.5);
  text('PropAI · Rental Management Platform', margin, footerY + 8, { size: 8, color: muted });
  text(`Tax Year ${data.year}`, W - margin, footerY + 8, { size: 8, color: muted, align: 'right' });

  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `propai-tax-report-${data.year}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── component ─────────────────────────────────────────────────────────────────

export default function LandlordTaxesPage() {
  const { leases, loading, fetchLandlordData } = useLandlordStore();
  const { user } = useAuthStore();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [deductions, setDeductions] = useState<Record<number, Deduction[]>>({});
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState(DEDUCTION_CATEGORIES[0]);
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

  // ── computed values ──────────────────────────────────────────────────────

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

  const yearDeductions: Deduction[] = demoMode
    ? MOCK_DEDUCTIONS
    : (deductions[selectedYear] ?? []);
  const totalDeductions = yearDeductions.reduce((s, d) => s + d.amount, 0);
  const taxableProfit = Math.max(0, grossIncome - totalDeductions);
  const tax = estimateTax(taxableProfit);

  const availableYears = [...new Set([
    new Date().getFullYear(),
    ...activeLeaseSrc.map(l => new Date(l.start_date).getFullYear()),
    ...activeLeaseSrc.filter(l => l.end_date).map(l => new Date(l.end_date!).getFullYear()),
  ])].sort((a, b) => b - a);

  // ── deduction actions ─────────────────────────────────────────────────────

  const addDeduction = () => {
    const amt = parseFloat(newAmount);
    if (!newLabel.trim() || isNaN(amt) || amt <= 0) return;
    const next = {
      ...deductions,
      [selectedYear]: [
        ...(deductions[selectedYear] ?? []),
        { id: crypto.randomUUID(), label: newLabel.trim(), amount: amt, category: newCategory },
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
      const band = taxableProfit > 35_000 ? 'top band (45%)' : taxableProfit > 12_000 ? 'middle band (35%)' : 'first band (15%)';
      setAiSummary(
        `Tax Year ${selectedYear} — AI Tax Summary (Greek rates)\n\n` +
        `Gross rental income:      €${Math.round(grossIncome).toLocaleString()}\n` +
        `Allowable deductions:     €${Math.round(totalDeductions).toLocaleString()}\n` +
        `Taxable profit:           €${Math.round(taxableProfit).toLocaleString()}\n\n` +
        `  Income tax (${band}):\n` +
        `    Band 1 up to €12,000 @ 15%:     €${Math.round(Math.min(taxableProfit, 12_000) * 0.15).toLocaleString()}\n` +
        (taxableProfit > 12_000 ? `    Band 2 €12k-€35k @ 35%:          €${Math.round(Math.min(taxableProfit - 12_000, 23_000) * 0.35).toLocaleString()}\n` : '') +
        (taxableProfit > 35_000 ? `    Band 3 above €35,000 @ 45%:      €${Math.round((taxableProfit - 35_000) * 0.45).toLocaleString()}\n` : '') +
        `  ─────────────────────────────────\n` +
        `  Estimated total tax:    €${tax.total.toLocaleString()}\n` +
        `  Effective rate:         ${tax.effectiveRate.toFixed(1)}%\n\n` +
        `Deductions you may be missing (Greek tax law):\n` +
        `• Property repair & maintenance costs\n` +
        `• Letting agent & management fees\n` +
        `• Insurance premiums\n` +
        `• Depreciation allowance (where applicable)\n` +
        `• Accountancy & legal fees\n` +
        `• Void period utility costs\n\n` +
        `Filing deadline: 30 June ${selectedYear + 1} via Taxisnet (E1/E2 forms).\n` +
        `Keep all receipts for at least 5 years. Consult a certified Greek accountant.`
      );
      setSummaryLoading(false);
    }, 800);
  };

  // ── PDF export ────────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    setExportLoading(true);
    try {
      const landlordName = demoMode
        ? 'Manolis Papadopoulos (Demo)'
        : (user?.email ?? 'Landlord');

      await exportToPDF({
        year: selectedYear,
        landlordName,
        grossIncome: Math.round(grossIncome),
        totalDeductions: Math.round(totalDeductions),
        taxableProfit: Math.round(taxableProfit),
        tax,
        deductions: yearDeductions,
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
    { label: 'Gross Rental Income', value: `€${Math.round(grossIncome).toLocaleString()}`, icon: TrendingUp, color: 'text-primary' },
    { label: 'Allowable Deductions', value: `−€${Math.round(totalDeductions).toLocaleString()}`, icon: ShieldCheck, color: 'text-green-400' },
    { label: 'Taxable Profit', value: `€${Math.round(taxableProfit).toLocaleString()}`, icon: Calculator, color: 'text-blue-400' },
    { label: 'Estimated Tax Owed', value: `€${tax.total.toLocaleString()}`, icon: AlertTriangle, color: tax.total > 0 ? 'text-yellow-400' : 'text-muted-foreground' },
  ];

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Receipt className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Taxes</h1>
            <p className="text-sm text-muted-foreground">Rental income tax estimate · Greek rates 2024</p>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
      {!isLoading && taxableProfit > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Tax Breakdown (Greece 2024)</h2>
            <Badge variant="outline" className="text-xs">
              {tax.effectiveRate.toFixed(1)}% effective rate
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Band 1: up to €12,000 (15%)</span>
              <span className="font-medium">€{Math.round(Math.min(taxableProfit, 12_000) * 0.15).toLocaleString()}</span>
            </div>
            {taxableProfit > 12_000 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Band 2: €12,001 – €35,000 (35%)</span>
                <span className="font-medium">€{Math.round(Math.min(taxableProfit - 12_000, 23_000) * 0.35).toLocaleString()}</span>
              </div>
            )}
            {taxableProfit > 35_000 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Band 3: above €35,000 (45%)</span>
                <span className="font-medium">€{Math.round((taxableProfit - 35_000) * 0.45).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>Estimated total tax owed</span>
              <span className="text-yellow-400">€{tax.total.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Estimate only. Does not account for other income sources, deductions, or individual circumstances. Consult a Greek tax advisor (E1/E2 form) before filing.
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
                  <div className="text-xs text-muted-foreground">{row.months} months × €{row.rent.toLocaleString()}/mo</div>
                </div>
                <span className="font-semibold text-primary">€{row.income.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-bold">
              <span>Total gross income</span>
              <span>€{Math.round(grossIncome).toLocaleString()}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Deductions */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Allowable Deductions — {selectedYear}
        </h2>

        {/* Add deduction (hidden in demo mode) */}
        {!demoMode && (
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="e.g. Letting agent fees"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDeduction()}
              className="flex-1 min-w-[160px]"
            />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEDUCTION_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="€ amount"
              type="number"
              min="0"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDeduction()}
              className="w-28"
            />
            <Button onClick={addDeduction} size="icon" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {yearDeductions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No deductions added yet. Add expenses like agent fees, insurance, and repairs above.
          </p>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-xs font-medium text-muted-foreground px-1 pb-1 border-b border-border/50">
              <span>Description</span>
              <span className="text-right w-32">Category</span>
              <span className="text-right w-24">Amount</span>
            </div>
            {yearDeductions.map(d => (
              <div key={d.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-sm py-1.5 border-b border-border/30">
                <span>{d.label}</span>
                <span className="text-right w-32 text-xs text-muted-foreground">{d.category}</span>
                <div className="flex items-center gap-2 justify-end w-24">
                  <span className="text-green-400 font-medium">−€{d.amount.toLocaleString()}</span>
                  {!demoMode && (
                    <button onClick={() => removeDeduction(d.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-2 font-bold">
              <span>Total deductions</span>
              <span className="text-green-400">−€{Math.round(totalDeductions).toLocaleString()}</span>
            </div>
          </div>
        )}
      </Card>

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
