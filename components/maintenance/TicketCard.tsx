import { Card } from "@/components/ui/card";
import StatusBadge from "@/components/shared/StatusBadge";
import { MaintenanceTicket } from "@/types";
import { cn } from "@/lib/utils";
import { Clock, User, MapPin, Brain } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TicketCardProps {
  ticket: MaintenanceTicket;
  isSelected?: boolean;
  onClick?: () => void;
}

export default function TicketCard({ ticket, isSelected, onClick }: TicketCardProps) {
  return (
    <Card 
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary ai-glow",
        ticket.ai_classified && "border-primary/30"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium">{ticket.title}</h4>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {ticket.description}
          </p>
        </div>
        <StatusBadge status={ticket.urgency} />
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-muted-foreground">
            <User className="h-3 w-3" />
              {ticket.tenant_name}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            Unit {ticket.unit}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            {ticket.ai_classified && (
              <div className="flex items-center gap-1 text-xs text-primary">
                <Brain className="h-3 w-3" />
                AI Classified
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
          </div>
        </div>

        {ticket.vendor_name && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Assigned to: <span className="font-medium">{ticket.vendor_name}</span>
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}