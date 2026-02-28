import { Card } from "@/components/ui/card";
import { Brain, Clock, Zap, User, DollarSign } from "lucide-react";
import { MaintenanceTicket, Contractor } from "@/types";
import { format } from "date-fns";
import StatusBadge from "@/components/shared/StatusBadge";

type AiDecision = { action?: string; reasoning?: string; confidence?: number; timestamp?: string };
type TicketAny = MaintenanceTicket & { ai_decisions?: AiDecision[] | null; estimated_cost?: number | null };

interface AIDecisionPanelProps {
  ticket: TicketAny;
  vendor?: Contractor;
}

export default function AIDecisionPanel({ ticket, vendor }: AIDecisionPanelProps) {
  return (
    <Card className="p-6 space-y-6 ai-glow">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-3">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">AI Decision Panel</h3>
          <p className="text-sm text-muted-foreground">Automated analysis and actions</p>
        </div>
      </div>

      {/* Classification Section */}
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Issue Classification
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Category</p>
            <p className="font-medium capitalize">{ticket.category}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Urgency</p>
            <StatusBadge status={(ticket.urgency ?? 'medium') as 'medium'} />
          </div>
        </div>
        
        {ticket.ai_decisions && Array.isArray(ticket.ai_decisions) && ((ticket.ai_decisions ?? []) as AiDecision[]).length > 0 && (
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-sm">{((ticket.ai_decisions ?? []) as AiDecision[])[0].reasoning}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Confidence: {((ticket.ai_decisions ?? []) as AiDecision[])[0].confidence}%
            </p>
          </div>
        )}
      </div>

      {/* Vendor Assignment Section */}
      {vendor && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Vendor Assignment
          </h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Selected Vendor</span>
              <span className="font-medium">{vendor.name}</span>
            </div>
            {vendor.phone && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Phone</span>
                <span className="text-sm">{vendor.phone}</span>
              </div>
            )}
          </div>
          
          {ticket.ai_decisions && Array.isArray(ticket.ai_decisions) && ((ticket.ai_decisions ?? []) as AiDecision[]).find(d => d.action === 'Vendor Assignment') && (
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-sm">
                {((ticket.ai_decisions ?? []) as AiDecision[]).find(d => d.action === 'Vendor Assignment')?.reasoning}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cost Estimation */}
      {ticket.estimated_cost && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Cost Estimation
          </h4>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estimated Cost</span>
            <span className="text-lg font-semibold">${ticket.estimated_cost}</span>
          </div>
        </div>
      )}

      {/* AI Actions Timeline */}
      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          AI Actions Timeline
        </h4>
        
        <div className="space-y-3">
          {ticket.ai_decisions && Array.isArray(ticket.ai_decisions) && ((ticket.ai_decisions ?? []) as AiDecision[]).map((decision, index) => (
            <div key={index} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{decision.action}</p>
                <p className="text-xs text-muted-foreground">
                  {decision.timestamp ? format(new Date(decision.timestamp), 'MMM d, h:mm a') : '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-4">
        <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          Owner Notified
        </button>
        <button className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors">
          View Full History
        </button>
      </div>
    </Card>
  );
}