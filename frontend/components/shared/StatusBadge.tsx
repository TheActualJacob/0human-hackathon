import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = 
  | 'paid' | 'pending' | 'late' | 'overdue' // Rent statuses
  | 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed' // Ticket statuses
  | 'active' | 'passive' | 'off' // Agent statuses
  | 'low' | 'medium' | 'high' | 'emergency'; // Urgency levels

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  // Rent statuses
  paid: { label: 'Paid', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
  pending: { label: 'Pending', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  late: { label: 'Late', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  overdue: { label: 'Overdue', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
  
  // Ticket statuses
  open: { label: 'Open', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  assigned: { label: 'Assigned', className: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  completed: { label: 'Completed', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
  closed: { label: 'Closed', className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
  
  // Agent statuses
  active: { label: 'Active', className: 'bg-primary/10 text-primary border-primary/20' },
  passive: { label: 'Passive', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  off: { label: 'Off', className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
  
  // Urgency levels
  low: { label: 'Low', className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
  medium: { label: 'Medium', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  high: { label: 'High', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  emergency: { label: 'Emergency', className: 'bg-red-500/10 text-red-500 border-red-500/20 pulse-glow' },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  if (!config) {
    return null;
  }
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}