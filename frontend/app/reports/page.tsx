'use client';

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, FileText, Download, Brain, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import useStore from "@/lib/store/useStore";
import { getMonthlyReport, type MonthlyReportResponse } from "@/lib/api/payments";
import {
  BarChart,
  Bar,
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
  const { payments, paymentPlans, landlords, units, leases, tenants, maintenanceRequests, agentActions } = useStore();

  const [selectedLandlordId, setSelectedLandlordId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [report, setReport] = useState<MonthlyReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  // Auto-select first landlord
  useEffect(() => {
    if (landlords.length > 0 && !selectedLandlordId) {
      setSelectedLandlordId(landlords[0].id);
    }
  }, [landlords, selectedLandlordId]);

  const fetchReport = async () => {
    if (!selectedLandlordId) return;
    setReportLoading(true);
    setReportError('');
    try {
      const data = await getMonthlyReport(selectedLandlordId, selectedYear, selectedMonth);
      setReport(data);
    } catch (err: any) {
      setReportError(err.message);
    } finally {
      setReportLoading(false);
    }
  };

  // Payment status distribution from live store data
  const paymentStatusData = [
    { name: 'Paid', value: payments.filter(p => p.status === 'paid').length, color: '#22c55e' },
    { name: 'Late', value: payments.filter(p => p.status === 'late').length, color: '#ef4444' },
    { name: 'Pending', value: payments.filter(p => p.status === 'pending').length, color: '#eab308' },
    { name: 'Partial', value: payments.filter(p => p.status === 'partial').length, color: '#f97316' },
    { name: 'Missed', value: payments.filter(p => p.status === 'missed').length, color: '#6b7280' },
  ].filter(d => d.value > 0);

  // Maintenance stats from store
  const maintenanceByCategory: Record<string, number> = {};
  maintenanceRequests.forEach(req => {
    const cat = req.category || 'other';
    maintenanceByCategory[cat] = (maintenanceByCategory[cat] || 0) + 1;
  });
  const maintenanceCategoryData = Object.entries(maintenanceByCategory).map(([category, count]) => ({
    category, count,
  }));

  const openMaintenance = maintenanceRequests.filter(r =>
    ['open', 'assigned', 'in_progress'].includes(r.status || '')
  ).length;
  const completedMaintenance = maintenanceRequests.filter(r => r.status === 'completed').length;

  // AI metrics from agent actions
  const paymentActions = agentActions.filter(a => a.action_category === 'payment').length;
  const maintenanceActions = agentActions.filter(a => a.action_category === 'maintenance').length;
  const totalActions = agentActions.length;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
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
          {/* Report Selector */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Monthly Report</h3>
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label>Landlord</Label>
                <Select value={selectedLandlordId} onValueChange={setSelectedLandlordId}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select landlord..." />
                  </SelectTrigger>
                  <SelectContent>
                    {landlords.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={fetchReport} disabled={reportLoading || !selectedLandlordId}>
                {reportLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-1" />}
                Load Report
              </Button>
            </div>
            {reportError && (
              <p className="mt-3 text-sm text-red-400">{reportError}</p>
            )}
          </Card>

          {/* Report Results */}
          {report && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-6">
                  <p className="text-sm text-muted-foreground">Total Expected</p>
                  <p className="text-2xl font-bold">£{report.total_expected.toLocaleString()}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-muted-foreground">Total Collected</p>
                  <p className="text-2xl font-bold text-green-500">£{report.total_collected.toLocaleString()}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-2xl font-bold text-red-500">£{report.total_outstanding.toLocaleString()}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-sm text-muted-foreground">Collection Rate</p>
                  <p className="text-2xl font-bold">{report.collection_rate}%</p>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Property Breakdown */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Property Breakdown</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.property_breakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="unit_identifier" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Legend />
                      <Bar dataKey="collected" fill="#22c55e" name="Collected" />
                      <Bar dataKey="expected" fill="#6b7280" name="Expected" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Late Patterns */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Late Payment Patterns</h3>
                  {report.late_patterns.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No late payments this period.</p>
                  ) : (
                    <div className="space-y-3">
                      {report.late_patterns.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                          <div>
                            <p className="font-medium">{item.tenant_name}</p>
                            <p className="text-sm text-muted-foreground">{item.unit_identifier}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-red-400 font-medium">{item.times_late}x late</p>
                            <p className="text-xs text-muted-foreground">Avg {item.avg_days_late.toFixed(0)} days</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Payment Stats */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Payment Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-500">{report.payments_on_time}</p>
                    <p className="text-sm text-muted-foreground">On Time</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-500">{report.payments_late}</p>
                    <p className="text-sm text-muted-foreground">Late</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-500">{report.payments_missed}</p>
                    <p className="text-sm text-muted-foreground">Missed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-500">{report.active_payment_plans}</p>
                    <p className="text-sm text-muted-foreground">Active Plans</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-orange-500">£{report.total_arrears_under_plan.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Under Plan</p>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* Live Payment Status Distribution */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Current Payment Status Distribution</h3>
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
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Requests by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={maintenanceCategoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="category" type="category" stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">Ticket Summary</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{maintenanceRequests.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold text-yellow-500">{openMaintenance}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-500">{completedMaintenance}</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Occupancy Tab */}
        <TabsContent value="occupancy" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Occupancy Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Units</p>
                <p className="text-3xl font-bold">{units.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Leases</p>
                <p className="text-3xl font-bold text-green-500">
                  {leases.filter(l => l.status === 'active').length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Tenants</p>
                <p className="text-3xl font-bold">{tenants.length}</p>
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
                <h3 className="text-lg font-semibold">AI Agent Activity</h3>
                <p className="text-sm text-muted-foreground">Automated actions and performance</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{totalActions}</p>
                <p className="text-sm text-muted-foreground mt-2">Total Actions</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{paymentActions}</p>
                <p className="text-sm text-muted-foreground mt-2">Payment Actions</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{maintenanceActions}</p>
                <p className="text-sm text-muted-foreground mt-2">Maintenance Actions</p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
