'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Brain, MessageSquare, DollarSign, Shield, Wrench, TrendingUp,
  ArrowRight, CheckCircle, Zap, Building2, Home,
  ChevronDown, Globe, Lock, BarChart3
} from 'lucide-react';

// ─── Floating house icon ─────────────────────────────────────────────────────
function FloatingHouse({ size = 24, style = {} }: { size?: number; style?: React.CSSProperties }) {
  return (
    <div className="absolute opacity-10 text-primary animate-float" style={style}>
      <Home size={size} />
    </div>
  );
}

// ─── Feature card ────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, description, gradient }: {
  icon: any; title: string; description: string; gradient: string;
}) {
  return (
    <div className="group relative p-px rounded-2xl bg-gradient-to-b from-white/10 to-transparent hover:from-primary/30 transition-all duration-500 cursor-default">
      <div className="relative bg-[#0a0a0f] rounded-2xl p-6 h-full">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${gradient}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <h4 className="text-lg font-semibold mb-2 text-white">{title}</h4>
        <p className="text-white/50 text-sm leading-relaxed">{description}</p>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#05050a] text-white overflow-x-hidden">

      {/* ── Global CSS injected ── */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(3deg); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes grid-move {
          0% { transform: translateY(0); }
          100% { transform: translateY(60px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-slide-up { animation: slide-up 0.8s ease forwards; }
        .text-shimmer {
          background: linear-gradient(90deg, #a855f7, #6366f1, #3b82f6, #6366f1, #a855f7);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s linear infinite;
        }
        .grid-bg {
          background-image: linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px);
          background-size: 60px 60px;
          animation: grid-move 8s linear infinite;
        }
        .glow-orb {
          filter: blur(80px);
          animation: glow-pulse 4s ease-in-out infinite;
        }
        .card-hover {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(99,102,241,0.15);
        }
        .btn-primary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          box-shadow: 0 0 30px rgba(99,102,241,0.4);
          transition: all 0.3s ease;
        }
        .btn-primary:hover {
          box-shadow: 0 0 50px rgba(99,102,241,0.6);
          transform: translateY(-2px);
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrollY > 20 ? 'bg-[#05050a]/80 backdrop-blur-xl border-b border-white/5' : ''
      }`}>
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">PropAI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
            <Link href="/properties" className="hover:text-white transition-colors">Browse</Link>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2">
              Sign in
            </Link>
            <Link href="/auth/signup/landlord" className="btn-primary text-sm text-white px-5 py-2 rounded-lg font-medium">
              Get Started →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0 grid-bg opacity-50" />

        {/* Glow orbs */}
        <div className="glow-orb absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/30 rounded-full" />
        <div className="glow-orb absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/20 rounded-full" style={{animationDelay:'2s'}} />
        <div className="glow-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/15 rounded-full" style={{animationDelay:'1s'}} />

        {/* Floating house icons */}
        <FloatingHouse size={20} style={{ top: '15%', left: '8%', animationDelay: '0s' }} />
        <FloatingHouse size={32} style={{ top: '20%', right: '10%', animationDelay: '1.5s' }} />
        <FloatingHouse size={16} style={{ bottom: '30%', left: '15%', animationDelay: '3s' }} />
        <FloatingHouse size={24} style={{ bottom: '25%', right: '8%', animationDelay: '0.8s' }} />
        <FloatingHouse size={18} style={{ top: '60%', left: '5%', animationDelay: '2.2s' }} />
        <FloatingHouse size={28} style={{ top: '35%', right: '5%', animationDelay: '4s' }} />

        <div className="relative z-10 container mx-auto px-6 text-center" style={{paddingTop: '80px'}}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
            </span>
            AI-Native Property Management Platform
          </div>

          {/* Headline */}
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none mb-6">
            <span className="text-white">The Future of</span>
            <br />
            <span className="text-shimmer">Property Management</span>
            <br />
            <span className="text-white">is Here</span>
          </h1>

          <p className="text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            PropAI replaces property managers with autonomous AI agents — handling maintenance, 
            rent, tenant screening, and compliance 24/7 at a fraction of the cost.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/auth/signup/landlord" className="btn-primary px-8 py-4 rounded-xl text-lg font-semibold text-white flex items-center gap-2 justify-center">
              Start Managing Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/properties" className="px-8 py-4 rounded-xl text-lg font-semibold text-white/80 border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all flex items-center gap-2 justify-center backdrop-blur-sm">
              <Home className="h-5 w-5" />
              Browse Properties
            </Link>
          </div>

          {/* Social proof bar */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-white/30">
            {['YC Backed', 'SOC 2 Certified', 'GDPR Compliant', '99.9% Uptime'].map(tag => (
              <div key={tag} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span>{tag}</span>
              </div>
            ))}
          </div>

          {/* Scroll hint */}
          <div className="mt-20 flex justify-center animate-bounce">
            <ChevronDown className="h-6 w-6 text-white/20" />
          </div>
        </div>

        {/* Hero dashboard mockup */}
        <div className="relative z-10 container mx-auto px-6 mt-8 max-w-5xl">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 rounded-2xl blur opacity-20" />
            <div className="relative bg-[#0d0d18] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              {/* Fake toolbar */}
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/5">
                <div className="h-3 w-3 rounded-full bg-red-500/70" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
                <div className="flex-1 mx-4 h-6 bg-white/5 rounded-md" />
              </div>
              {/* Dashboard content */}
              <div className="grid grid-cols-4 gap-4 mb-5">
                {[
                  { label: 'Properties', value: '147', icon: Building2, color: 'from-indigo-500 to-blue-600' },
                  { label: 'Monthly Revenue', value: '£892K', icon: DollarSign, color: 'from-emerald-500 to-teal-600' },
                  { label: 'Active Tenants', value: '483', icon: Home, color: 'from-purple-500 to-pink-600' },
                  { label: 'AI Resolution', value: '97%', icon: Brain, color: 'from-orange-500 to-red-600' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                      <stat.icon className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-white/40 text-xs mb-1">{stat.label}</p>
                    <p className="text-white text-xl font-bold">{stat.value}</p>
                  </div>
                ))}
              </div>
              {/* Bar chart mockup */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/50 text-xs">Revenue Overview</p>
                  <div className="flex gap-3 text-xs text-white/30">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500 inline-block"/>Rent</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"/>Collected</span>
                  </div>
                </div>
                <div className="flex items-end gap-2 h-20">
                  {[40,65,55,80,72,90,85,95,88,100,92,110].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col gap-1 items-center">
                      <div className="w-full bg-indigo-500/60 rounded-t-sm" style={{height: `${h*0.7}%`}} />
                      <div className="w-full bg-emerald-500/40 rounded-t-sm" style={{height: `${h*0.55}%`}} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-white/20 text-xs">
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/10 to-transparent" />
        <div className="container mx-auto px-6 relative">
          <div className="text-center mb-16">
            <p className="text-indigo-400 text-sm font-medium uppercase tracking-widest mb-3">Platform</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Everything automated</h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              Six AI-powered modules that replace an entire property management company
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <FeatureCard gradient="from-indigo-500 to-blue-600" icon={Brain} title="AI Tenant Screening" description="Claude-powered screening analyses employment, income, rental history, and references in under 60 seconds." />
            <FeatureCard gradient="from-purple-500 to-pink-600" icon={MessageSquare} title="WhatsApp AI Agent" description="Tenants message naturally via WhatsApp — our AI handles repairs, payments, and queries 24/7 in any language." />
            <FeatureCard gradient="from-emerald-500 to-teal-600" icon={DollarSign} title="Smart Rent Collection" description="Automated collection, late fees, reconciliation, and financial reporting — zero landlord effort required." />
            <FeatureCard gradient="from-orange-500 to-red-600" icon={Wrench} title="Predictive Maintenance" description="AI detects patterns, predicts failures before they happen, and dispatches vetted contractors automatically." />
            <FeatureCard gradient="from-blue-500 to-cyan-600" icon={Shield} title="Legal & Compliance AI" description="Automatically monitors regulatory changes, flags risks, and generates compliant lease documentation." />
            <FeatureCard gradient="from-violet-500 to-purple-600" icon={TrendingUp} title="Portfolio Analytics" description="Real-time yield optimisation, occupancy forecasting, and market-rate suggestions for every property." />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-24">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <p className="text-indigo-400 text-sm font-medium uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Live in 3 minutes</h2>
          </div>
          <div className="relative">
            {/* Connector line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/50 via-purple-500/50 to-transparent hidden md:block" />
            <div className="space-y-8">
              {[
                { step: '01', title: 'List your property', desc: 'Add your property details, set rent, and choose public or private listing. Takes under 3 minutes.', icon: Building2 },
                { step: '02', title: 'AI screens applicants', desc: 'Claude analyses every application — employment, income verification, rental history — and ranks them for you.', icon: Brain },
                { step: '03', title: 'Sign digitally', desc: 'Lease generated, signed, and stored automatically. WhatsApp agent activates for your new tenant.', icon: Lock },
                { step: '04', title: 'AI manages everything', desc: 'Rent collection, maintenance, communications. You get a monthly report. That\'s it.', icon: Zap },
              ].map((item, i) => (
                <div key={i} className="flex gap-6 group card-hover">
                  <div className="relative flex-shrink-0">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-2xl font-black text-indigo-400 group-hover:from-indigo-500/40 group-hover:to-purple-500/40 transition-all">
                      {item.step}
                    </div>
                  </div>
                  <div className="bg-white/3 border border-white/8 rounded-2xl p-6 flex-1 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                      <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-32 relative overflow-hidden">
        <div className="glow-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-600/20 rounded-full" />
        <div className="relative container mx-auto px-6 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-8">
            <Globe className="h-4 w-4" />
            Available in 12 countries
          </div>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
            Stop managing.<br />
            <span className="text-shimmer">Start earning.</span>
          </h2>
          <p className="text-white/40 text-lg mb-10">
            Join 3,200+ landlords who've automated their portfolio with PropAI.
            First property free, forever.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup/landlord" className="btn-primary px-10 py-5 rounded-xl text-lg font-bold text-white flex items-center gap-2 justify-center">
              List Your First Property Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/properties" className="px-10 py-5 rounded-xl text-lg font-semibold text-white/60 border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all flex items-center gap-2 justify-center">
              <BarChart3 className="h-5 w-5" />
              View Live Listings
            </Link>
          </div>
          <p className="text-white/20 text-sm mt-6">No credit card required · Setup in 3 minutes · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-white">PropAI</span>
              <span className="text-white/20 text-sm ml-2">© 2025 PropAI Ltd.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/30">
              <Link href="/properties" className="hover:text-white transition-colors">Browse Properties</Link>
              <Link href="/auth/login" className="hover:text-white transition-colors">Sign In</Link>
              <Link href="/auth/signup/landlord" className="hover:text-white transition-colors">List Property</Link>
              <Link href="/demo" className="hover:text-white transition-colors">Demo</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
