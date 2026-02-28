import { Card } from "@/components/ui/card";
import StatusBadge from "@/components/shared/StatusBadge";
import type { MaintenanceRequest } from "@/types";

interface MaintenanceRequestWithDetails extends MaintenanceRequest {
  lease?: { tenants?: { full_name: string }[]; unit?: { unit_identifier: string } };
  contractor?: { name: string } | null;
}
import { cn } from "@/lib/utils";
import { Clock, MapPin, Brain } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TicketCardProps {
  ticket: MaintenanceRequestWithDetails;
  isSelected?: boolean;
  onClick?: () => void;
}

export default function TicketCard({ ticket, isSelected, onClick }: TicketCardProps) {
  const tenantName = ticket.lease?.tenants?.[0]?.full_name;
  const unitIdentifier = ticket.lease?.unit?.unit_identifier;
  const contractorName = ticket.contractor?.name;

  return (
    <Card 
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary ai-glow"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium capitalize">{ticket.category}</h4>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {ticket.description}
          </p>
        </div>
        <StatusBadge status={(ticket.urgency ?? 'medium') as 'medium'} />
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        {(tenantName || unitIdentifier) && (
          <div className="flex items-center gap-4">
            {tenantName && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>{tenantName}</span>
              </div>
            )}
            {unitIdentifier && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Unit {unitIdentifier}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge status={(ticket.status ?? 'open') as 'open'} />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(ticket.created_at ?? new Date()), { addSuffix: true })}
          </div>
        </div>

        {contractorName && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Assigned to: <span className="font-medium">{contractorName}</span>
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
