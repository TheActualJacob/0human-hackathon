'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Brain, MessageSquare, DollarSign, Shield, Wrench, TrendingUp,
  ArrowRight, CheckCircle, Zap, Building2, Home, ChevronDown,
  Globe, Lock, BarChart3, Bot, Sparkles, Bell, Users,
  Activity, Phone, FileText, Menu, X as XIcon,
  Banknote, MapPin, Gauge, TrendingDown, Target,
} from 'lucide-react';

// ─── Mini UI Components (dashboard replicas) ────────────────────────────────

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: any;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{label}</span>
        <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function MiniBar({ height, color }: { height: number; color: string }) {
  return <div className={`flex-1 ${color} rounded-t-sm`} style={{ height: `${height}%` }} />;
}

// ─── Dashboard Preview Component ─────────────────────────────────────────────

function DashboardPreview() {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-700/60 shadow-2xl bg-zinc-950">
      {/* Browser chrome */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex-1 mx-4 bg-zinc-800 rounded-md px-3 py-1 text-xs text-zinc-500 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          app.propai.io/landlord/dashboard
        </div>
      </div>

      {/* App shell */}
      <div className="flex h-[460px]">
        {/* Sidebar */}
        <div className="w-44 bg-zinc-950 border-r border-zinc-800 flex flex-col p-3 shrink-0">
          <div className="flex items-center gap-2 mb-5 px-2 pt-1">
            <div className="w-6 h-6 rounded-md bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">PropAI</span>
          </div>
          {[
            { icon: BarChart3, label: 'Dashboard', active: true },
            { icon: Building2, label: 'Properties' },
            { icon: Users, label: 'Tenants' },
            { icon: DollarSign, label: 'Payments' },
            { icon: Wrench, label: 'Maintenance' },
            { icon: Banknote, label: 'Revenue AI', badge: 'AI' },
            { icon: Activity, label: 'Predictive', badge: 'AI' },
            { icon: Bot, label: 'Renewals', badge: 'NEW' },
          ].map(({ icon: Icon, label, active, badge }) => (
            <div key={label} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 text-xs ${active ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{label}</span>
              {badge && <span className={`ml-auto text-[9px] px-1 rounded ${badge === 'NEW' ? 'bg-emerald-900 text-emerald-400' : 'bg-indigo-900 text-indigo-400'}`}>{badge}</span>}
            </div>
          ))}
          <div className="mt-auto px-2 py-2 rounded-lg bg-indigo-950 border border-indigo-900">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-indigo-300 font-medium">AI Agent Active</span>
            </div>
            <div className="text-[9px] text-indigo-500">Autonomy: 78%</div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Top bar */}
          <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-2 flex items-center justify-between shrink-0">
            <div>
              <div className="text-xs text-zinc-500">Good morning,</div>
              <div className="text-sm font-bold text-white">Landlord Dashboard</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950 border border-emerald-900 px-2 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Agent: Active
              </div>
              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
                <Users className="w-3 h-3 text-zinc-400" />
              </div>
            </div>
          </div>

          {/* Dashboard content */}
          <div className="flex-1 overflow-hidden p-3 bg-zinc-950">
            {/* Hero card */}
            <div className="bg-linear-to-r from-indigo-950 to-zinc-900 border border-indigo-900/50 rounded-xl p-4 mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-400 mb-1">Portfolio Health</div>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-2xl font-black text-white">€14,820</div>
                    <div className="text-xs text-emerald-400">↑ 8.2% this month</div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 mb-1">AI Score</div>
                <div className="text-3xl font-black text-indigo-400">87</div>
                <div className="text-xs text-zinc-500">/ 100</div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { l: 'Revenue', v: '€14.8K', c: 'bg-indigo-600', icon: DollarSign },
                { l: 'Properties', v: '12', c: 'bg-blue-600', icon: Building2 },
                { l: 'Tenants', v: '19', c: 'bg-purple-600', icon: Users },
                { l: 'Open Issues', v: '2', c: 'bg-amber-600', icon: Wrench },
              ].map(s => (
                <div key={s.l} className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
                  <div className={`w-6 h-6 rounded-md ${s.c} flex items-center justify-center mb-1.5`}>
                    <s.icon className="w-3 h-3 text-white" />
                  </div>
                  <div className="text-[10px] text-zinc-500">{s.l}</div>
                  <div className="text-sm font-bold text-white">{s.v}</div>
                </div>
              ))}
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-2 gap-2">
              {/* Mini chart */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
                <div className="text-[10px] text-zinc-500 mb-2">Monthly Revenue</div>
                <div className="flex items-end gap-1 h-12">
                  {[40,55,48,70,62,85,78,92,88,100,95,108].map((h, i) => (
                    <MiniBar key={i} height={h * 0.85} color={i === 11 ? 'bg-indigo-500' : 'bg-indigo-800'} />
                  ))}
                </div>
              </div>
              {/* Quick actions */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
                <div className="text-[10px] text-zinc-500 mb-2">Quick Actions</div>
                <div className="space-y-1">
                  {['Add Property', 'Create Lease', 'Invite Tenant'].map(a => (
                    <div key={a} className="bg-zinc-800 rounded text-[10px] text-zinc-400 px-2 py-1 flex items-center justify-between">
                      {a} <ArrowRight className="w-2.5 h-2.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature UI Mockups ───────────────────────────────────────────────────────

function RevenueAIMockup() {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <Banknote className="w-4 h-4 text-indigo-400" />
        <span className="text-zinc-200 font-semibold">Revenue AI</span>
        <span className="ml-auto text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded-full">Claude-powered</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Market position bar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-400 text-[10px] flex items-center gap-1"><MapPin className="w-3 h-3" />Unit 3B · Dublin 4</span>
            <span className="text-[9px] text-indigo-300 bg-indigo-950 border border-indigo-900 px-1.5 py-0.5 rounded-full">68th percentile</span>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-zinc-500 text-[9px]">Your rent</span>
            <span className="text-zinc-500 text-[9px]">Market median</span>
            <span className="text-zinc-500 text-[9px]">Top 25%</span>
          </div>
          <div className="relative h-2 bg-zinc-800 rounded-full mb-1.5">
            <div className="absolute left-0 top-0 h-full bg-indigo-600 rounded-full" style={{width:'68%'}} />
            {/* Current rent marker */}
            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-400 rounded-full shadow-lg shadow-indigo-500/50" style={{left:'calc(68% - 6px)'}} />
            {/* Market median */}
            <div className="absolute top-0 h-full w-px bg-emerald-400/60" style={{left:'75%'}} />
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-white font-bold">€1,200/mo</span>
            <span className="text-emerald-400">€1,350 median</span>
            <span className="text-zinc-500">€1,550</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-amber-400 text-[9px]">
            <TrendingDown className="w-3 h-3" />
            <span>11% below market — market is <span className="font-semibold">tightening</span></span>
          </div>
        </div>

        {/* Scenario cards */}
        <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide px-0.5">Pricing scenarios</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Conservative', price: '€1,250', delta: '+€600', risk: 'Low', riskColor: 'text-emerald-400', bg: 'bg-zinc-900', border: 'border-zinc-800' },
            { label: 'Optimal ★', price: '€1,350', delta: '+€1,800', risk: 'Moderate', riskColor: 'text-amber-400', bg: 'bg-indigo-950', border: 'border-indigo-800' },
            { label: 'Aggressive', price: '€1,500', delta: '+€3,600', risk: 'High', riskColor: 'text-red-400', bg: 'bg-zinc-900', border: 'border-zinc-800' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-lg p-2`}>
              <div className={`text-[9px] font-medium mb-1.5 ${s.border === 'border-indigo-800' ? 'text-indigo-300' : 'text-zinc-400'}`}>{s.label}</div>
              <div className="text-white font-bold">{s.price}</div>
              <div className="text-emerald-400 text-[9px]">{s.delta}/yr</div>
              <div className={`text-[9px] mt-1 ${s.riskColor}`}>{s.risk} vacancy</div>
            </div>
          ))}
        </div>

        {/* AI recommendation */}
        <div className="bg-indigo-950 border border-indigo-800 rounded-lg p-2.5">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded bg-indigo-900 border border-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-3 h-3 text-indigo-300" />
            </div>
            <div>
              <div className="text-indigo-300 font-semibold text-[10px] mb-0.5">AI Recommendation</div>
              <div className="text-zinc-300 text-[10px] leading-relaxed">
                List at <span className="text-white font-semibold">€1,350/mo</span>. Market is tightening — 94% confidence you'll let within <span className="text-white font-semibold">12 days</span>. Adding <span className="text-emerald-400 font-semibold">+€1,800/year</span> vs current.
              </div>
            </div>
          </div>
        </div>

        {/* Confidence + market data row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: 'Confidence', v: '94%', icon: Target, c: 'text-emerald-400' },
            { l: 'Comparables', v: '12 units', icon: MapPin, c: 'text-blue-400' },
            { l: 'Days to let', v: '~12 days', icon: Gauge, c: 'text-purple-400' },
          ].map(s => (
            <div key={s.l} className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-center">
              <s.icon className={`w-3.5 h-3.5 ${s.c} mx-auto mb-1`} />
              <div className="text-zinc-600 text-[8px]">{s.l}</div>
              <div className={`font-bold text-[10px] ${s.c}`}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PredictiveMaintenanceMockup() {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-amber-400" />
        <span className="text-zinc-300 font-medium">Predictive Maintenance</span>
      </div>
      <div className="space-y-2 mb-3">
        {[
          { unit: 'Unit 2A — Boiler', risk: 87, color: 'bg-red-500', urgency: 'Critical', days: '8 days' },
          { unit: 'Unit 5C — Plumbing', risk: 64, color: 'bg-amber-500', urgency: 'Medium', days: '23 days' },
          { unit: 'Unit 1B — Electrics', risk: 41, color: 'bg-yellow-500', urgency: 'Low', days: '45 days' },
        ].map(item => (
          <div key={item.unit} className="bg-zinc-900 rounded-lg p-2 flex items-center gap-2">
            <div className="flex-1">
              <div className="text-zinc-300 font-medium text-[10px]">{item.unit}</div>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                  <div className={`${item.color} h-1.5 rounded-full`} style={{ width: `${item.risk}%` }} />
                </div>
                <span className={`text-[9px] ${item.risk > 70 ? 'text-red-400' : item.risk > 50 ? 'text-amber-400' : 'text-yellow-400'}`}>{item.risk}%</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-[9px] px-1.5 py-0.5 rounded ${item.risk > 70 ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400'}`}>{item.urgency}</div>
              <div className="text-zinc-600 text-[9px] mt-0.5">{item.days}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-amber-950/50 border border-amber-900 rounded-lg p-2 flex items-start gap-1.5">
        <Bot className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
        <div className="text-[10px] text-zinc-400">
          <span className="text-amber-300 font-medium">Agent dispatched</span> PlumbPro Ltd to Unit 2A. Appointment confirmed: Thu 14:00.
        </div>
      </div>
    </div>
  );
}

function LeaseRenewalMockup() {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="w-4 h-4 text-blue-400" />
        <span className="text-zinc-300 font-medium">Lease Renewals</span>
        <span className="ml-auto text-[10px] bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">Agent Negotiating</span>
      </div>
      <div className="space-y-2 mb-3">
        {[
          { name: 'Sarah M.', unit: 'Unit 3B', status: 'Renewed ✓', rent: '€1,300/mo', color: 'bg-emerald-950 text-emerald-400 border-emerald-900' },
          { name: 'James K.', unit: 'Unit 1A', status: 'Negotiating', rent: '€1,150/mo', color: 'bg-blue-950 text-blue-400 border-blue-900' },
          { name: 'Priya S.', unit: 'Unit 4C', status: 'Awaiting Reply', rent: '€980/mo', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
        ].map(item => (
          <div key={item.name} className="bg-zinc-900 rounded-lg p-2 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-300">{item.name[0]}</div>
            <div className="flex-1">
              <div className="text-zinc-300 font-medium text-[10px]">{item.name} · {item.unit}</div>
              <div className="text-zinc-500 text-[9px]">{item.rent}</div>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${item.color}`}>{item.status}</span>
          </div>
        ))}
      </div>
      {/* Chat bubbles */}
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          <div className="w-4 h-4 rounded-full bg-blue-900 flex items-center justify-center shrink-0"><Bot className="w-2.5 h-2.5 text-blue-400" /></div>
          <div className="bg-blue-950 border border-blue-900 rounded-lg rounded-tl-sm px-2 py-1 text-[10px] text-blue-100 max-w-[80%]">Hi James, we'd love to renew at €1,200/mo for 12 months. How does that sound?</div>
        </div>
        <div className="flex gap-1.5 flex-row-reverse">
          <div className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-[9px] text-zinc-400">J</div>
          <div className="bg-zinc-800 rounded-lg rounded-tr-sm px-2 py-1 text-[10px] text-zinc-300 max-w-[80%]">Could we do €1,150? I've been here 2 years.</div>
        </div>
        <div className="flex gap-1.5">
          <div className="w-4 h-4 rounded-full bg-blue-900 flex items-center justify-center shrink-0"><Bot className="w-2.5 h-2.5 text-blue-400" /></div>
          <div className="bg-blue-950 border border-blue-900 rounded-lg rounded-tl-sm px-2 py-1 text-[10px] text-blue-100 max-w-[80%]">Agreed! We appreciate your loyalty. I'll prepare your renewal at €1,150/mo.</div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppMockup() {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs">
      <div className="flex items-center gap-2 mb-3">
        <Phone className="w-4 h-4 text-emerald-400" />
        <span className="text-zinc-300 font-medium">WhatsApp AI Agent</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Live
        </span>
      </div>
      <div className="bg-[#0b141a] rounded-xl p-3 space-y-2">
        {[
          { from: 'tenant', text: "My heating isn't working, it's freezing!", time: '09:14' },
          { from: 'agent', text: "I'm sorry to hear that! I've logged an emergency repair and contacted PlumbPro Ltd. Engineer will arrive today 2–4pm. I'll send you a confirmation.", time: '09:14' },
          { from: 'tenant', text: "That was fast, thank you!", time: '09:15' },
          { from: 'agent', text: "Of course! I'll follow up after the visit. Is there anything else I can help with?", time: '09:15' },
        ].map((msg, i) => (
          <div key={i} className={`flex ${msg.from === 'agent' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`max-w-[80%] px-2.5 py-1.5 rounded-xl text-[10px] leading-relaxed ${msg.from === 'agent' ? 'bg-[#005c4b] text-zinc-100 rounded-tr-sm' : 'bg-[#202c33] text-zinc-200 rounded-tl-sm'}`}>
              {msg.text}
              <div className="text-[8px] text-zinc-500 mt-0.5 text-right">{msg.time} {msg.from === 'agent' && '✓✓'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feature section (alternating layout) ────────────────────────────────────

function FeatureSection({
  badge, title, subtitle, bullets, mockup, flip = false,
}: {
  badge: string; title: string; subtitle: string;
  bullets: { icon: any; text: string }[];
  mockup: React.ReactNode; flip?: boolean;
}) {
  return (
    <div className={`flex flex-col ${flip ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12`}>
      <div className="flex-1 min-w-0">
        <span className="inline-block text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3 bg-indigo-950 border border-indigo-900 px-3 py-1 rounded-full">{badge}</span>
        <h3 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">{title}</h3>
        <p className="text-zinc-400 text-lg mb-6 leading-relaxed">{subtitle}</p>
        <ul className="space-y-3">
          {bullets.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-md bg-indigo-950 border border-indigo-900 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <span className="text-zinc-300 text-sm leading-relaxed">{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 w-full min-w-0">{mockup}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#040406] text-white overflow-x-hidden">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.65; }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .text-gradient {
          background: linear-gradient(135deg, #818cf8 0%, #c084fc 40%, #38bdf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .glow-orb { filter: blur(100px); animation: glow-pulse 5s ease-in-out infinite; }
        .float-slow { animation: float-slow 5s ease-in-out infinite; }
        .fade-in { animation: fade-in-up 0.7s ease forwards; }
        .grid-bg {
          background-image:
            linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px);
          background-size: 80px 80px;
        }
        .hero-glow {
          background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%);
        }
      `}</style>

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrollY > 20 ? 'bg-[#040406]/90 backdrop-blur-xl border-b border-white/5' : ''
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Building2 className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight">PropAI</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#product" className="hover:text-white transition-colors">Product</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <Link href="/properties" className="hover:text-white transition-colors">Browse</Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2">
              Sign in
            </Link>
            <Link href="/auth/signup/landlord" className="text-sm text-white px-5 py-2.5 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/25">
              Get Started Free →
            </Link>
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-zinc-400">
            {mobileMenuOpen ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-zinc-900 border-b border-zinc-800 px-6 py-4 space-y-3 text-sm">
            <Link href="/auth/login" className="block text-zinc-400 hover:text-white">Sign in</Link>
            <Link href="/properties" className="block text-zinc-400 hover:text-white">Browse Properties</Link>
            <Link href="/auth/signup/landlord" className="block text-white font-semibold bg-indigo-600 px-4 py-2 rounded-lg text-center">
              Get Started Free
            </Link>
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute inset-x-0 top-0 hero-glow h-[600px]" />
        <div className="glow-orb absolute -top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/20 rounded-full" />
        <div className="glow-orb absolute top-1/3 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full" style={{animationDelay:'2s'}} />
        <div className="glow-orb absolute top-1/3 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full" style={{animationDelay:'3.5s'}} />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
              </span>
              AI-Native Property Management Platform
            </div>
          </div>

          {/* Headline */}
          <div className="text-center mb-6">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-none mb-6">
              <span className="text-white">Your Portfolio,</span>
              <br />
              <span className="text-gradient">Fully Automated.</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              PropAI replaces your property manager with autonomous AI — handling rent, maintenance,
              tenant screening, lease renewals, and compliance 24/7.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link href="/auth/signup/landlord"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5">
              Start for Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/properties"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:bg-white/5 transition-all backdrop-blur-sm">
              <Home className="h-5 w-5" />
              Browse Properties
            </Link>
          </div>

          {/* Trust row */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500 mb-14">
            {[
              { icon: CheckCircle, text: 'No credit card required' },
              { icon: CheckCircle, text: 'Setup in 3 minutes' },
              { icon: CheckCircle, text: 'Cancel anytime' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-emerald-400" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Dashboard mockup */}
          <div className="relative float-slow max-w-5xl mx-auto">
            <div className="absolute -inset-4 bg-linear-to-r from-indigo-600/20 via-purple-600/20 to-blue-600/20 rounded-3xl blur-2xl" />
            <div className="relative">
              <DashboardPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature overview grid ────────────────────────────────────────────── */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-3">Platform</p>
            <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">Every module. Fully autonomous.</h2>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto">
              Six AI-powered modules that replace an entire property management company.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Banknote, gradient: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-500/20',
                title: 'Revenue AI',
                desc: 'Analyses your entire portfolio, benchmarks against market rates, and surfaces exactly which units are under-priced — with a one-click action.',
                tags: ['Market benchmarking', 'Yield optimisation', 'Cash flow forecast'],
              },
              {
                icon: Activity, gradient: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/20',
                title: 'Predictive Maintenance',
                desc: 'AI detects failure patterns before they become emergencies, auto-dispatches vetted contractors, and tracks every job to completion.',
                tags: ['Failure prediction', 'Auto-dispatch', 'Cost tracking'],
              },
              {
                icon: Bot, gradient: 'from-blue-500 to-cyan-600', shadow: 'shadow-blue-500/20',
                title: 'Autonomous Lease Renewals',
                desc: 'Set your minimum rent floor once. The agent negotiates directly with tenants via WhatsApp and reports back only when a deal is done.',
                tags: ['WhatsApp negotiation', 'Autonomous agent', 'Outcome reports'],
              },
              {
                icon: MessageSquare, gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20',
                title: 'WhatsApp AI Agent',
                desc: 'Tenants message naturally 24/7 — repairs, payments, questions. AI responds instantly in any language, escalating only when needed.',
                tags: ['24/7 availability', 'Multilingual', 'Instant responses'],
              },
              {
                icon: Brain, gradient: 'from-purple-500 to-pink-600', shadow: 'shadow-purple-500/20',
                title: 'AI Tenant Screening',
                desc: 'Claude analyses employment, income, rental history, and references in under 60 seconds. Ranked shortlists delivered automatically.',
                tags: ['60-second analysis', 'Credit checks', 'Risk scoring'],
              },
              {
                icon: DollarSign, gradient: 'from-rose-500 to-red-600', shadow: 'shadow-rose-500/20',
                title: 'Smart Rent & Tax',
                desc: 'Automated collection, late fee enforcement, and a built-in tax dashboard with income summaries, deductible tracking, and report exports.',
                tags: ['Auto-collection', 'Tax reporting', 'HMRC/Revenue ready'],
              },
            ].map(({ icon: Icon, gradient, shadow, title, desc, tags }) => (
              <div key={title} className={`group bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${shadow}`}>
                <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-4">{desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(t => (
                    <span key={t} className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product deep dives ───────────────────────────────────────────────── */}
      <section id="product" className="py-24 bg-zinc-900/20">
        <div className="max-w-7xl mx-auto px-6 space-y-28">

          <FeatureSection
            badge="Revenue AI"
            title="Stop leaving money on the table."
            subtitle="PropAI's Revenue AI engine continuously benchmarks your rents against live market data and calculates the exact increase that maximises revenue without risking vacancy."
            bullets={[
              { icon: TrendingUp, text: '12-month revenue projections per unit, updated in real-time' },
              { icon: Sparkles, text: 'AI-generated insight cards highlight the single biggest opportunity in your portfolio' },
              { icon: BarChart3, text: 'Scenario simulator: see exactly what a 5% vs 10% rent increase does to annual yield' },
              { icon: MapPin, text: 'Market delta scoring — know if you\'re 12% above or below local comparables instantly' },
            ]}
            mockup={<RevenueAIMockup />}
          />

          <FeatureSection
            flip
            badge="Predictive Maintenance"
            title="Fix it before it breaks."
            subtitle="Using failure pattern analysis across thousands of properties, PropAI predicts which systems will fail and when — then automatically books the contractor before the tenant even notices."
            bullets={[
              { icon: Activity, text: 'Risk scores for every system (boiler, plumbing, electrics) updated weekly' },
              { icon: Zap, text: 'Emergency issues auto-dispatched to vetted contractors within 60 seconds' },
              { icon: CheckCircle, text: 'Every job tracked start-to-finish with photos and cost records' },
              { icon: DollarSign, text: 'Predictive scheduling reduces average repair cost by 34%' },
            ]}
            mockup={<PredictiveMaintenanceMockup />}
          />

          <FeatureSection
            badge="Autonomous Lease Renewals"
            title="Never negotiate a renewal yourself again."
            subtitle="You set the floor. The agent does the rest. PropAI negotiates directly with tenants via WhatsApp — counter-offering within your terms, handling objections, and confirming deals — you only see the outcome."
            bullets={[
              { icon: Bot, text: 'Fully autonomous WhatsApp negotiation — no landlord input per message' },
              { icon: Shield, text: 'Hard floor enforcement: agent never agrees to less than your minimum' },
              { icon: FileText, text: 'Landlord notified only when deal is closed or escalation is genuinely needed' },
              { icon: CheckCircle, text: 'Full read-only transcript available after every negotiation' },
            ]}
            mockup={<LeaseRenewalMockup />}
          />

          <FeatureSection
            flip
            badge="WhatsApp AI Agent"
            title="Your tenants deserve instant answers."
            subtitle="No more maintenance calls at midnight. The PropAI WhatsApp agent handles every tenant query instantly — logging repairs, chasing contractors, answering lease questions — in any language, around the clock."
            bullets={[
              { icon: MessageSquare, text: 'Natural language conversations — no app download, no portal login required' },
              { icon: Globe, text: 'Responds fluently in 40+ languages automatically' },
              { icon: Wrench, text: 'Maintenance requests logged, prioritised, and dispatched autonomously' },
              { icon: Bell, text: 'Landlord alerts only for high-severity issues — silence for everything else' },
            ]}
            mockup={<WhatsAppMockup />}
          />

        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-3">Get started</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Live in under 3 minutes.</h2>
            <p className="text-zinc-400 text-lg">No training, no onboarding call, no complex setup.</p>
          </div>

          <div className="relative">
            <div className="absolute left-[31px] top-10 bottom-10 w-px bg-linear-to-b from-indigo-500/60 via-indigo-500/30 to-transparent hidden md:block" />
            <div className="space-y-6">
              {[
                { step: '1', icon: Building2, title: 'List your property', desc: 'Add your property details, set rent, and publish. Our AI fills in missing details automatically. Takes under 3 minutes.' },
                { step: '2', icon: Brain, title: 'AI screens every applicant', desc: 'Claude analyses employment, income, rental history, and references. You receive a ranked shortlist — no reading through paperwork.' },
                { step: '3', icon: Lock, title: 'Digital lease signing', desc: 'Lease generated, customised, and signed digitally. Your tenant\'s WhatsApp AI agent activates the moment they sign.' },
                { step: '4', icon: Zap, title: 'AI manages everything else', desc: 'Rent, maintenance, renewals, and compliance run automatically. You receive a clean monthly report and only hear about things that actually need you.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-6 group">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-700 group-hover:border-indigo-500/50 flex items-center justify-center transition-colors relative z-10">
                      <span className="text-2xl font-black text-indigo-400">{item.step}</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-zinc-900 border border-zinc-800 group-hover:border-zinc-600 rounded-2xl p-5 flex gap-4 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-900 flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                      <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="py-32 relative overflow-hidden">
        <div className="glow-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-indigo-600/20 rounded-full" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-8">
            <Globe className="h-4 w-4" />
            Available across Europe and beyond
          </div>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-none">
            Stop managing.<br />
            <span className="text-gradient">Start earning.</span>
          </h2>
          <p className="text-zinc-400 text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            Your first property is free, forever. No credit card. No contracts. 
            Start automating in the next 3 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/auth/signup/landlord"
              className="flex items-center justify-center gap-2 px-10 py-5 rounded-xl text-lg font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/30 hover:-translate-y-0.5">
              List Your First Property Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/properties"
              className="flex items-center justify-center gap-2 px-10 py-5 rounded-xl text-lg font-semibold text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:bg-white/5 transition-all">
              <Home className="h-5 w-5" />
              Browse Listings
            </Link>
          </div>
          <p className="text-zinc-600 text-sm">No credit card · First property free forever · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-8 w-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-black text-white">PropAI</span>
              </div>
              <p className="text-zinc-600 text-xs">© 2025 PropAI Ltd. All rights reserved.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-3 text-sm text-zinc-500">
              <Link href="/properties" className="hover:text-white transition-colors">Browse Properties</Link>
              <Link href="/auth/login" className="hover:text-white transition-colors">Sign In</Link>
              <Link href="/auth/signup/landlord" className="hover:text-white transition-colors">List Property</Link>
              <Link href="/auth/signup/tenant" className="hover:text-white transition-colors">Tenant Portal</Link>
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#how" className="hover:text-white transition-colors">How It Works</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
