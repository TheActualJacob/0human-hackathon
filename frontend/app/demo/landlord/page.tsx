'use client';

import { useDemoStore } from '@/lib/store/demo';
import { 
  Building2, Users, Wrench, DollarSign, 
  TrendingUp, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DemoLandlordDashboard() {
  const { units, tenants, maintenanceRequests, payments, landlord } = useDemoStore();

  const stats = [
    {
      title: "Total Units",
      value: units.length,
      icon: Building2,
      trend: "+12%",
      trendUp: true
    },
    {
      title: "Active Tenants",
      value: tenants.length,
      icon: Users,
      trend: "+5%",
      trendUp: true
    },
    {
      title: "Pending Maintenance",
      value: maintenanceRequests.filter(r => r.status !== 'COMPLETED').length,
      icon: Wrench,
      trend: "-2",
      trendUp: false
    },
    {
      title: "Monthly Revenue",
      value: `$${payments.reduce((acc, p) => acc + (p.status === 'paid' ? p.amount : 0), 0).toLocaleString()}`,
      icon: DollarSign,
      trend: "+8%",
      trendUp: true
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {landlord?.full_name}</h1>
        <p className="text-muted-foreground mt-1">Here is what is happening with your properties today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center">
                {stat.trendUp ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                )}
                <span className={stat.trendUp ? "text-green-500" : "text-red-500 font-medium"}>
                  {stat.trend}
                </span>
                {" "}from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {maintenanceRequests.slice(0, 5).map((req) => (
                <div key={req.id} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{req.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.category} • {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-xs font-medium px-2 py-1 bg-secondary rounded-full">
                    {req.status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <button className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Add Property</p>
                <p className="text-xs text-muted-foreground">Register a new unit</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Invite Tenant</p>
                <p className="text-xs text-muted-foreground">Send an invite to a new tenant</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Create Invoice</p>
                <p className="text-xs text-muted-foreground">Charge a tenant for utilities/fees</p>
              </div>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
