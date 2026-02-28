'use client';

import { useDemoStore } from '@/lib/store/demo';
import { 
  Building2, Home, Wrench, DollarSign, 
  Calendar, FileText, Download, CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function DemoTenantDashboard() {
  const { leases, maintenanceRequests, payments, tenants } = useDemoStore();
  
  // Find Sarah Miller's data for the demo
  const tenant = tenants.find(t => t.id === 'tenant-1');
  const lease = leases.find(l => l.tenant_id === 'tenant-1');
  const myRequests = maintenanceRequests.filter(r => r.tenant_id === 'tenant-1');
  const myPayments = payments.filter(p => p.lease_id === lease?.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hello, {tenant?.full_name}</h1>
        <p className="text-muted-foreground mt-1">Welcome to your tenant portal. Everything is up to date.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Left Section - Main Info */}
        <div className="md:col-span-8 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>My Lease</CardTitle>
                <CardDescription>Current lease information and status</CardDescription>
              </div>
              <Building2 className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-medium">Unit</p>
                  <p className="text-sm font-semibold">Loft 402</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-medium">Monthly Rent</p>
                  <p className="text-sm font-semibold">$3,200.00</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-medium">Status</p>
                  <p className="text-sm font-semibold text-green-500">Active</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-medium">Ends</p>
                  <p className="text-sm font-semibold">Jan 1, 2025</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {myPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{p.type.charAt(0).toUpperCase() + p.type.slice(1)}</p>
                        <p className="text-xs text-muted-foreground">Due {new Date(p.due_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">${p.amount.toLocaleString()}</p>
                      <p className={cn(
                        "text-xs font-medium",
                        p.status === 'paid' ? "text-green-500" : "text-yellow-500"
                      )}>
                        {p.status === 'paid' ? 'Paid' : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Section - Sidebar like cards */}
        <div className="md:col-span-4 space-y-6">
          <Card className="bg-primary text-primary-foreground ai-glow">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full bg-white text-primary hover:bg-white/90">
                <Link href="/demo/tenant/maintenance">
                  <Wrench className="mr-2 h-4 w-4" />
                  Request Repair
                </Link>
              </Button>
              <Button variant="outline" className="w-full border-white/20 hover:bg-white/10 text-white">
                <DollarSign className="mr-2 h-4 w-4" />
                Pay Rent
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maintenance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {myRequests.length > 0 ? (
                myRequests.map((req) => (
                  <div key={req.id} className="space-y-2 p-3 rounded-lg border bg-muted/30">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium">{req.title}</p>
                      <span className="text-[10px] px-2 py-0.5 bg-secondary rounded-full uppercase">
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-10 w-10 text-muted mx-auto mb-2 opacity-20" />
                  <p className="text-sm text-muted-foreground">No active requests</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
