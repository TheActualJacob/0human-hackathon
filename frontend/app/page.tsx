import Link from 'next/link';
import { 
  Building2, DollarSign, Wrench, Shield, Brain, MessageSquare,
  TrendingUp, Users, CheckCircle, ArrowRight, Home, Zap
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50">
      {/* Hero Section */}
      <header className="px-4 py-6 border-b">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">PropAI</h1>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#for-landlords" className="text-muted-foreground hover:text-foreground transition-colors">
              For Landlords
            </Link>
            <Link href="#for-tenants" className="text-muted-foreground hover:text-foreground transition-colors">
              For Tenants
            </Link>
            <Link href="/auth/login" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              Login
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Content */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="flex flex-col items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary text-sm">
              <Zap className="h-4 w-4" />
              <span>AI-Powered Property Management</span>
            </div>
            <Link href="/demo" className="text-xs text-muted-foreground hover:text-primary">
              Skip to Demo →
            </Link>
          </div>
          
          <h2 className="text-5xl font-bold leading-tight">
            Property Management
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
              Reimagined with AI
            </span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your property operations with autonomous AI agents that handle maintenance, 
            payments, and tenant communications 24/7.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup/landlord" 
              className="group px-8 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-lg font-medium">
              I'm a Landlord
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/auth/signup/tenant" 
              className="group px-8 py-4 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-all flex items-center justify-center gap-2 text-lg font-medium border">
              I'm a Tenant
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Powered by Advanced AI</h3>
            <p className="text-muted-foreground text-lg">
              Our AI agents work around the clock to manage your properties efficiently
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={Brain}
              title="AI Maintenance Orchestration"
              description="Autonomous triage, approval, and vendor dispatch for all maintenance requests"
            />
            <FeatureCard 
              icon={MessageSquare}
              title="Intelligent Communication"
              description="Multi-modal WhatsApp integration with voice and image analysis"
            />
            <FeatureCard 
              icon={DollarSign}
              title="Smart Payment Processing"
              description="Automated rent collection, late fee management, and financial reporting"
            />
            <FeatureCard 
              icon={Shield}
              title="Legal Compliance"
              description="AI-powered lease analysis and automated compliance monitoring"
            />
            <FeatureCard 
              icon={Wrench}
              title="Predictive Maintenance"
              description="Prevent issues before they happen with pattern recognition"
            />
            <FeatureCard 
              icon={TrendingUp}
              title="Advanced Analytics"
              description="Real-time insights and predictive analytics for better decision making"
            />
          </div>
        </div>
      </section>

      {/* For Landlords Section */}
      <section id="for-landlords" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-3xl font-bold mb-6">For Landlords</h3>
                <p className="text-lg text-muted-foreground mb-8">
                  Manage multiple properties effortlessly with AI-powered automation that handles 
                  the complexities of property management.
                </p>
                <ul className="space-y-4">
                  <BenefitItem text="Manage unlimited properties and tenants from one dashboard" />
                  <BenefitItem text="AI handles maintenance requests automatically" />
                  <BenefitItem text="Automated rent collection and late fee management" />
                  <BenefitItem text="Real-time property performance analytics" />
                  <BenefitItem text="Integrated contractor and vendor management" />
                  <BenefitItem text="Legal compliance automation and alerts" />
                </ul>
                <Link href="/auth/signup/landlord" 
                  className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  Get Started as Landlord
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-600/20 blur-3xl" />
                <div className="relative bg-card border rounded-xl p-8 shadow-xl">
                  <div className="flex items-center gap-2 mb-6">
                    <Building2 className="h-6 w-6 text-primary" />
                    <h4 className="text-lg font-semibold">Landlord Dashboard</h4>
                  </div>
                  <div className="space-y-4">
                    <StatItem label="Properties Managed" value="12" />
                    <StatItem label="Active Tenants" value="48" />
                    <StatItem label="Monthly Revenue" value="$156,420" />
                    <StatItem label="AI Resolutions" value="94%" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Tenants Section */}
      <section id="for-tenants" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-600/20 blur-3xl" />
                <div className="relative bg-card border rounded-xl p-8 shadow-xl">
                  <div className="flex items-center gap-2 mb-6">
                    <Home className="h-6 w-6 text-primary" />
                    <h4 className="text-lg font-semibold">Tenant Portal</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Next Rent Due</p>
                      <p className="font-semibold">March 1, 2024</p>
                    </div>
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-sm text-green-600 mb-1">Maintenance Request</p>
                      <p className="font-semibold">Resolved in 4 hours</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h3 className="text-3xl font-bold mb-6">For Tenants</h3>
                <p className="text-lg text-muted-foreground mb-8">
                  Experience hassle-free renting with instant support, automated payments, 
                  and AI-powered maintenance resolution.
                </p>
                <ul className="space-y-4">
                  <BenefitItem text="Submit maintenance requests 24/7 via WhatsApp" />
                  <BenefitItem text="AI instantly triages and resolves issues" />
                  <BenefitItem text="Automated rent payments and reminders" />
                  <BenefitItem text="Access lease documents anytime" />
                  <BenefitItem text="Real-time updates on maintenance progress" />
                  <BenefitItem text="Direct communication with property manager" />
                </ul>
                <Link href="/auth/signup/tenant" 
                  className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors border">
                  Get Started as Tenant
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h3 className="text-3xl font-bold">
              Ready to Transform Your Property Management?
            </h3>
            <p className="text-lg text-muted-foreground">
              Join thousands of landlords and tenants already using PropAI
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup/landlord" 
                className="px-8 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-lg font-medium">
                Start as Landlord
              </Link>
              <Link href="/auth/signup/tenant" 
                className="px-8 py-4 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors text-lg font-medium border">
                Start as Tenant
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-semibold">PropAI</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/demo" className="text-sm text-muted-foreground hover:text-primary">
                Demo Mode
              </Link>
              <p className="text-sm text-muted-foreground">
                © 2024 PropAI. AI-Powered Property Management.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-card border rounded-xl hover:border-primary/50 transition-all">
      <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h4 className="text-lg font-semibold mb-2">{title}</h4>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </li>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}