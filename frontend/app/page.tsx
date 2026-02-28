<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PropAI - Automated Property Management</title>
  
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: { extend: { colors: { primary: '#6366f1' } } }
    }
  </script>

  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  
  <script src="https://unpkg.com/lucide@latest"></script>
  <script src="https://unpkg.com/lucide-react@latest"></script>

  <style>
    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
    .animate-float { animation: float 6s ease-in-out infinite; }
    .text-shimmer {
      background: linear-gradient(90deg, #a855f7, #6366f1, #3b82f6, #6366f1, #a855f7);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmer 4s linear infinite;
    }
    @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
    .grid-bg {
      background-image: linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px);
      background-size: 60px 60px;
    }
    body { background-color: #05050a; color: white; margin: 0; font-family: sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel" data-presets="react,env">
    const { useState, useEffect } = React;
    
    // In UMD, Lucide icons are available on the 'lucide' global
    const { 
      Brain, MessageSquare, DollarSign, Shield, Wrench, TrendingUp,
      ArrowRight, CheckCircle, Zap, Building2, Home,
      ChevronDown, Globe, Lock, BarChart3
    } = lucide;

    function FeatureCard({ icon: Icon, title, description, gradient }) {
      return (
        <div className="group relative p-px rounded-2xl bg-gradient-to-b from-white/10 to-transparent hover:from-primary/30 transition-all duration-500">
          <div className="relative bg-[#0a0a0f] rounded-2xl p-6 h-full">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${gradient}`}>
              <Icon size={24} color="white" />
            </div>
            <h4 className="text-lg font-semibold mb-2">{title}</h4>
            <p className="text-white/50 text-sm leading-relaxed">{description}</p>
          </div>
        </div>
      );
    }

    function App() {
      return (
        <div className="min-h-screen relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-50" />
          
          <nav className="relative z-50 flex items-center justify-between px-6 py-6 container mx-auto">
            <div className="flex items-center gap-2">
              <Building2 className="text-indigo-500" />
              <span className="text-xl font-bold">PropAI</span>
            </div>
            <div className="flex gap-4">
              <button className="bg-indigo-600 px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition">Get Started</button>
            </div>
          </nav>

          <main className="relative z-10 container mx-auto px-6 pt-20 pb-32 text-center">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6">
              The Future of <br/>
              <span className="text-shimmer">Property Management</span>
            </h1>
            <p className="text-xl text-white/50 max-w-2xl mx-auto mb-10">
              Autonomous AI agents handling your entire portfolio. Screening, maintenance, and rent—all on autopilot.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-5xl mx-auto">
              <FeatureCard 
                icon={Brain} 
                title="AI Screening" 
                description="Instant background and credit checks powered by Claude."
                gradient="from-indigo-500 to-blue-600"
              />
              <FeatureCard 
                icon={Zap} 
                title="Instant Repairs" 
                description="AI detects issues and dispatches contractors 24/7."
                gradient="from-purple-500 to-pink-600"
              />
              <FeatureCard 
                icon={Shield} 
                title="Legal Guard" 
                description="Automated compliance and digital lease management."
                gradient="from-emerald-500 to-teal-600"
              />
            </div>
          </main>
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>
