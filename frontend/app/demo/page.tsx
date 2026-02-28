'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Building2, Home, ArrowRight } from 'lucide-react';

export default function DemoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/50">
      <div className="max-w-4xl w-full space-y-8 text-center">
        <div className="inline-flex items-center justify-center gap-2">
          <Building2 className="h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold">PropAI Demo</h1>
        </div>
        
        <p className="text-xl text-muted-foreground">
          Choose a dashboard to explore (authentication temporarily bypassed for demo)
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          <div className="bg-card border rounded-xl p-8 space-y-4">
            <Building2 className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-2xl font-semibold">Landlord Dashboard</h2>
            <p className="text-muted-foreground">
              Manage properties, tenants, maintenance requests, and payments
            </p>
            <Button asChild className="w-full">
              <Link href="/demo/landlord">
                Start Landlord Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          
          <div className="bg-card border rounded-xl p-8 space-y-4">
            <Home className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-2xl font-semibold">Tenant Dashboard</h2>
            <p className="text-muted-foreground">
              View lease details, make payments, submit maintenance requests
            </p>
            <Button asChild className="w-full">
              <Link href="/demo/tenant">
                Start Tenant Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> This is a demo mode. In production, users would need to authenticate 
            with their credentials to access their respective dashboards.
          </p>
        </div>
        
        <Button asChild variant="outline">
          <Link href="/">Back to Landing Page</Link>
        </Button>
      </div>
    </div>
  );
}