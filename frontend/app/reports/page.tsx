'use client';

import { BarChart3, TrendingUp, FileText, Download, Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import useStore from "@/lib/store/useStore";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line,
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';

export default function ReportsPage() {
  const { payments, maintenanceRequests, tenants, contractors, agentActions } = useStore();

  // Calculate monthly cash flow data from actual payments
  const currentMonth = new Date().toLocaleString('default', { month: 'short' });
  const totalExpected = payments.reduce((sum: number, p) => sum + p.amount_due, 0);
  const totalCollected = payments.filter(p => p.status === 'paid').reduce((sum: number, p) => sum + (p.amount_paid ?? 0), 0);
  
  const monthlyData = [
    { month: currentMonth, collected: totalCollected, expected: totalExpected }
  ];

  // Calculate maintenance spend by category
  const maintenanceByCategory = Object.entries(
    maintenanceRequests.reduce((acc: Record<string, number>, ticket) => {
      if ((ticket as any).cost) {
        const cat = ticket.category || 'general';
        acc[cat] = (acc[cat] || 0) + ((ticket as any).cost as number);
      }
      return acc;
    }, {} as Record<string, number>)
  ).map(([category, amount]) => ({ category, amount }));

  // Payment status distribution
  const paymentStatusData = [
    { name: 'On Time', value: payments.filter(p => p.status === 'paid').length, color: '#22c55e' },
    { name: 'Late', value: payments.filter(p => p.status === 'late').length, color: '#ef4444' },
    { name: 'Pending', value: payments.filter(p => p.status === 'pending').length, color: '#eab308' },
  ];

  // AI efficiency metrics
  const totalRequests = maintenanceRequests.length;
  const aiDiagnosedRequests = maintenanceRequests.filter(t => (t as any).ai_diagnosed).length;
  const aiAssignedRequests = maintenanceRequests.filter(t => t.contractor_id && (t as any).ai_diagnosed).length;
  const totalAgentActions = agentActions.length;

  const aiEfficiencyData = [
    { metric: 'Issues AI Diagnosed', value: totalRequests > 0 ? Math.round((aiDiagnosedRequests / totalRequests) * 100) : 0 },
    { metric: 'Auto Contractor Assigned', value: totalRequests > 0 ? Math.round((aiAssignedRequests / totalRequests) * 100) : 0 },
    { metric: 'Agent Actions Logged', value: totalAgentActions },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">Property management insights and performance metrics</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Report Tabs */}
      <Tabs defaultValue="financial" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="ai-metrics">AI Metrics</TabsTrigger>
        </TabsList>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Cash Flow */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Monthly Cash Flow
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151' 
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="collected" fill="#22c55e" name="Collected" />
                  <Bar dataKey="expected" fill="#6b7280" name="Expected" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Payment Status Distribution */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Payment Status Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Financial Summary */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Current Financial Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Expected</p>
                <p className="text-2xl font-bold">${totalExpected.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Collected</p>
                <p className="text-2xl font-bold">${totalCollected.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold">${(totalExpected - totalCollected).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Collection Rate</p>
                <p className="text-2xl font-bold">
                  {totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0}%
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Maintenance Spend by Category */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Maintenance Spend by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={maintenanceByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="category" type="category" stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151' 
                    }} 
                  />
                  <Bar dataKey="amount" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Ticket Volume Summary */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Ticket Summary</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{maintenanceRequests.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Open Requests</p>
                  <p className="text-2xl font-bold text-yellow-500">
                    {maintenanceRequests.filter(t => ['open', 'assigned', 'in_progress'].includes(t.status ?? '')).length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-500">
                    {maintenanceRequests.filter(t => t.status === 'completed').length}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Occupancy Tab */}
        <TabsContent value="occupancy" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Occupancy Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Units</p>
                <p className="text-3xl font-bold">{tenants.length}</p>
                <p className="text-xs text-muted-foreground">Currently managed</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Leases</p>
                <p className="text-3xl font-bold">
                  {tenants.filter(t => t.lease_id).length}
                </p>
                <p className="text-xs text-muted-foreground">With lease agreements</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* AI Metrics Tab */}
        <TabsContent value="ai-metrics" className="space-y-6">
          <Card className="p-6 ai-glow">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-primary/10 p-3">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">AI Performance Metrics</h3>
                <p className="text-sm text-muted-foreground">Automation efficiency and impact</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {aiEfficiencyData.map((metric, idx) => (
                <div key={idx} className="text-center">
                  <p className="text-4xl font-bold text-primary">
                    {metric.metric === 'Avg Response Time' ? `${metric.value}h` : `${metric.value}%`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">{metric.metric}</p>
                </div>
              ))}
            </div>

          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}