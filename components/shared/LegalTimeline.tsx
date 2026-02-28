import { Clock, FileText, Gavel, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { LegalAction, Dispute } from '@/types';

interface TimelineEvent {
  id: string;
  type: 'dispute' | 'legal_action';
  date: Date;
  title: string;
  description?: string;
  status?: string;
  data: Dispute | LegalAction;
}

interface LegalTimelineProps {
  dispute?: Dispute;
  legalActions?: LegalAction[];
  className?: string;
}

export default function LegalTimeline({ 
  dispute, 
  legalActions = [],
  className 
}: LegalTimelineProps) {
  // Combine dispute and legal actions into timeline events
  const events: TimelineEvent[] = [];
  
  if (dispute) {
    events.push({
      id: dispute.id,
      type: 'dispute',
      date: new Date(dispute.opened_at || ''),
      title: `Dispute Opened: ${dispute.category.replace(/_/g, ' ')}`,
      description: dispute.description,
      status: dispute.status || 'open',
      data: dispute
    });
    
    if (dispute.closed_at) {
      events.push({
        id: `${dispute.id}-closed`,
        type: 'dispute',
        date: new Date(dispute.closed_at),
        title: `Dispute ${dispute.status === 'ruled' ? 'Ruled' : 'Closed'}`,
        description: dispute.ruling || undefined,
        status: 'closed',
        data: dispute
      });
    }
  }
  
  legalActions.forEach(action => {
    events.push({
      id: action.id,
      type: 'legal_action',
      date: new Date(action.issued_at || ''),
      title: action.action_type.replace(/_/g, ' '),
      description: action.agent_reasoning || undefined,
      status: action.status || 'issued',
      data: action
    });
  });
  
  // Sort by date descending (newest first)
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  const getEventIcon = (event: TimelineEvent) => {
    if (event.type === 'dispute') {
      return event.status === 'closed' ? CheckCircle : AlertTriangle;
    }
    
    const action = event.data as LegalAction;
    switch (action.action_type) {
      case 'eviction_notice':
      case 'section_8':
      case 'section_21':
        return AlertTriangle;
      case 'payment_demand':
      case 'payment_plan_agreement':
        return FileText;
      default:
        return Gavel;
    }
  };

  const getEventColor = (event: TimelineEvent) => {
    if (event.type === 'dispute') {
      switch (event.status) {
        case 'closed':
        case 'ruled':
          return 'bg-green-500';
        case 'appealed':
          return 'bg-orange-500';
        default:
          return 'bg-yellow-500';
      }
    }
    
    const action = event.data as LegalAction;
    switch (action.status) {
      case 'complied':
        return 'bg-green-500';
      case 'acknowledged':
        return 'bg-blue-500';
      case 'escalated':
        return 'bg-red-500';
      case 'expired':
        return 'bg-gray-500';
      default:
        return 'bg-yellow-500';
    }
  };

  if (events.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No legal history</p>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Timeline line */}
      <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-border" />
      
      {/* Timeline events */}
      <div className="space-y-6">
        {events.map((event, index) => {
          const Icon = getEventIcon(event);
          const isLast = index === events.length - 1;
          
          return (
            <div key={event.id} className="relative flex gap-4">
              {/* Icon */}
              <div className={cn(
                "relative z-10 h-10 w-10 rounded-full flex items-center justify-center text-white",
                getEventColor(event)
              )}>
                <Icon className="h-5 w-5" />
              </div>
              
              {/* Content */}
              <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{event.title}</h4>
                    <span className="text-xs text-muted-foreground">
                      {format(event.date, 'MMM d, yyyy')}
                    </span>
                  </div>
                  
                  {event.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {event.description}
                    </p>
                  )}
                  
                  {/* Additional details */}
                  {event.type === 'legal_action' && (
                    <div className="flex items-center gap-4 text-xs">
                      {(event.data as LegalAction).response_deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Response due: {format(new Date((event.data as LegalAction).response_deadline!), 'MMM d')}
                        </span>
                      )}
                      <span className={cn(
                        "px-2 py-1 rounded",
                        (event.data as LegalAction).status === 'complied' && "bg-green-500/20 text-green-300",
                        (event.data as LegalAction).status === 'escalated' && "bg-red-500/20 text-red-300",
                        !['complied', 'escalated'].includes((event.data as LegalAction).status || '') && "bg-gray-500/20 text-gray-300"
                      )}>
                        {(event.data as LegalAction).status}
                      </span>
                    </div>
                  )}
                  
                  {event.type === 'dispute' && event.status === 'ruled' && dispute?.ruling && (
                    <div className="mt-2 p-2 bg-primary/10 rounded text-sm">
                      <p className="font-medium mb-1">Ruling:</p>
                      <p className="text-muted-foreground">{dispute.ruling}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}