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
  const { rentPayments, tickets, tenants, vendors } = useStore();

  // Calculate monthly cash flow data
  const monthlyData = [
    { month: 'Jan', collected: 22400, expected: 23200 },
    { month: 'Feb', collected: 23200, expected: 23200 },
    { month: 'Mar', collected: 21500, expected: 23200 },
  ];

  // Calculate maintenance spend by category
  const maintenanceByCategory = Object.entries(
    tickets.reduce((acc, ticket) => {
      if (ticket.estimatedCost) {
        acc[ticket.category] = (acc[ticket.category] || 0) + ticket.estimatedCost;
      }
      return acc;
    }, {} as Record<string, number>)
  ).map(([category, amount]) => ({ category, amount }));

  // Payment status distribution
  const paymentStatusData = [
    { name: 'On Time', value: rentPayments.filter(p => p.status === 'paid').length, color: '#22c55e' },
    { name: 'Late', value: rentPayments.filter(p => p.status === 'late').length, color: '#ef4444' },
    { name: 'Pending', value: rentPayments.filter(p => p.status === 'pending').length, color: '#eab308' },
  ];

  // AI efficiency metrics
  const totalTickets = tickets.length;
  const aiClassifiedTickets = tickets.filter(t => t.aiClassified).length;
  const aiAssignedVendors = tickets.filter(t => t.vendorId && t.aiClassified).length;
  const avgResponseTime = vendors.reduce((sum, v) => sum + v.avgResponseTime, 0) / vendors.length;

  const aiEfficiencyData = [
    { metric: 'Tickets Classified', value: Math.round((aiClassifiedTickets / totalTickets) * 100) },
    { metric: 'Vendors Auto-Assigned', value: Math.round((aiAssignedVendors / totalTickets) * 100) },
    { metric: 'Avg Response Time', value: Math.round(avgResponseTime * 10) / 10 },
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
            <h3 className="font-semibold mb-4">Q1 2024 Financial Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">$67,100</p>
                <p className="text-xs text-green-500">+12% from Q4</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Operating Expenses</p>
                <p className="text-2xl font-bold">$12,450</p>
                <p className="text-xs text-red-500">+5% from Q4</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Income</p>
                <p className="text-2xl font-bold">$54,650</p>
                <p className="text-xs text-green-500">+14% from Q4</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Collection Rate</p>
                <p className="text-2xl font-bold">96.5%</p>
                <p className="text-xs text-green-500">+2% from Q4</p>
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

            {/* Ticket Volume Trend */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Ticket Volume Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={[
                  { month: 'Jan', tickets: 12 },
                  { month: 'Feb', tickets: 8 },
                  { month: 'Mar', tickets: 5 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151' 
                    }} 
                  />
                  <Line type="monotone" dataKey="tickets" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        {/* Occupancy Tab */}
        <TabsContent value="occupancy" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Occupancy Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                <p className="text-3xl font-bold">100%</p>
                <p className="text-xs text-green-500">All units occupied</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Tenant Tenure</p>
                <p className="text-3xl font-bold">18 months</p>
                <p className="text-xs text-muted-foreground">Industry avg: 12 months</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Renewal Rate</p>
                <p className="text-3xl font-bold">85%</p>
                <p className="text-xs text-green-500">+10% YoY</p>
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

            <div className="mt-6 pt-6 border-t space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Time Saved Monthly</span>
                <span className="font-medium">~40 hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Cost Reduction</span>
                <span className="font-medium text-green-500">-18%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Tenant Satisfaction</span>
                <span className="font-medium">+22%</span>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}