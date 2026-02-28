'use client';

import { Hammer, Clock, DollarSign, Star, Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import useStore from "@/lib/store/useStore";
import { cn } from "@/lib/utils";

export default function VendorsPage() {
  const { vendors, tickets } = useStore();

  // Calculate vendor stats
  const getVendorStats = (vendorId: string) => {
    const vendorTickets = tickets.filter(t => t.vendorId === vendorId);
    const completed = vendorTickets.filter(t => t.status === 'completed').length;
    const active = vendorTickets.filter(t => ['assigned', 'in_progress'].includes(t.status)).length;
    
    return { total: vendorTickets.length, completed, active };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Vendors</h1>
        <p className="text-muted-foreground">Manage service providers and performance metrics</p>
      </div>

      {/* Vendor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vendors.map(vendor => {
          const stats = getVendorStats(vendor.id);
          
          return (
            <Card key={vendor.id} className={cn(
              "p-6 space-y-4",
              vendor.aiPerformanceScore > 90 && "ai-glow"
            )}>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{vendor.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {vendor.specialty.map((spec, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Badge 
                  variant={vendor.isAvailable ? "default" : "secondary"}
                  className={vendor.isAvailable ? "bg-green-500/10 text-green-500" : ""}
                >
                  {vendor.isAvailable ? "Available" : "Busy"}
                </Badge>
              </div>

              {/* Contact Info */}
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">{vendor.email}</p>
                <p className="text-muted-foreground">{vendor.phone}</p>
              </div>

              {/* Performance Metrics */}
              <div className="space-y-3">
                {/* Response Time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Avg Response</span>
                  </div>
                  <span className="text-sm font-medium">{vendor.avgResponseTime}h</span>
                </div>

                {/* Average Cost */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Avg Cost</span>
                  </div>
                  <span className="text-sm font-medium">${vendor.avgCost}</span>
                </div>

                {/* Rating */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Rating</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">{vendor.rating}</span>
                    <span className="text-xs text-muted-foreground">/5</span>
                  </div>
                </div>

                {/* AI Performance Score */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Brain className="h-4 w-4 text-primary" />
                      <span className="font-medium">AI Performance Score</span>
                    </div>
                    <span className="text-sm font-medium text-primary">
                      {vendor.aiPerformanceScore}%
                    </span>
                  </div>
                  <Progress 
                    value={vendor.aiPerformanceScore} 
                    className="h-2"
                  />
                </div>
              </div>

              {/* Job Stats */}
              <div className="flex items-center justify-between pt-3 border-t text-sm">
                <span className="text-muted-foreground">
                  Jobs: {stats.total} total
                </span>
                <div className="flex gap-3">
                  <span className="text-green-500">{stats.completed} done</span>
                  <span className="text-yellow-500">{stats.active} active</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* AI Insights Card */}
      <Card className="p-6 ai-glow">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">AI Vendor Insights</h3>
            <p className="text-sm text-muted-foreground">Performance analysis and recommendations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-medium text-green-500">Top Performer</h4>
            <p className="text-sm">PowerPro Electric</p>
            <p className="text-xs text-muted-foreground">
              95% AI score • 0.8h response time • 4.9/5 rating
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-yellow-500">Needs Improvement</h4>
            <p className="text-sm">HandyPro Services</p>
            <p className="text-xs text-muted-foreground">
              78% AI score • Consider performance review
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-primary">Recommendation</h4>
            <p className="text-sm">Add HVAC Specialist</p>
            <p className="text-xs text-muted-foreground">
              High demand detected for AC repairs this month
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}