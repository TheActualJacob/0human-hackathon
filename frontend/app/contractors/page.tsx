'use client';

import { Hammer, Phone, Mail, AlertCircle, Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import useStore from "@/lib/store/useStore";
import { cn } from "@/lib/utils";

export default function ContractorsPage() {
  const { contractors, maintenanceRequests } = useStore();

  const getContractorStats = (contractorId: string) => {
    const requests = maintenanceRequests.filter(r => r.contractor_id === contractorId);
    const completed = requests.filter(r => r.status === 'completed').length;
    const active = requests.filter(r => ['assigned', 'in_progress'].includes(r.status ?? '')).length;
    return { total: requests.length, completed, active };
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contractors</h1>
        <p className="text-muted-foreground">Manage service providers and maintenance assignments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contractors.map(contractor => {
          const stats = getContractorStats(contractor.id);

          return (
            <Card key={contractor.id} className={cn("p-6 space-y-4")}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{contractor.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(contractor.trades ?? []).map((trade, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {trade}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Badge
                  variant={contractor.emergency_available ? "default" : "secondary"}
                  className={contractor.emergency_available ? "bg-green-500/10 text-green-500" : ""}
                >
                  {contractor.emergency_available ? "24/7" : "Standard"}
                </Badge>
              </div>

              <div className="space-y-1 text-sm">
                {contractor.email && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {contractor.email}
                  </p>
                )}
                {contractor.phone && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {contractor.phone}
                  </p>
                )}
                {contractor.notes && (
                  <p className="text-muted-foreground text-xs mt-2">{contractor.notes}</p>
                )}
              </div>

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

        {contractors.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            <Hammer className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No contractors found</p>
          </div>
        )}
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Contractor Insights</h3>
            <p className="text-sm text-muted-foreground">Overview of contractor availability and activity</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{contractors.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Emergency Ready</p>
            <p className="text-2xl font-bold text-green-500">
              {contractors.filter(c => c.emergency_available).length}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active Jobs</p>
            <p className="text-2xl font-bold">
              {maintenanceRequests.filter(r => ['assigned', 'in_progress'].includes(r.status ?? '')).length}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
