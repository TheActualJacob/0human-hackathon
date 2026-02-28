'use client';

import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Calendar,
  FileText,
  Star
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ResolutionPanelProps {
  workflowId: string;
  isCompleted: boolean;
  startTime?: string;
  completionTime?: string;
  estimatedCost?: number;
  actualCost?: number;
  vendorEta?: string;
  wasEtaHonored?: boolean;
}

export function ResolutionPanel({
  workflowId,
  isCompleted,
  startTime,
  completionTime,
  estimatedCost,
  actualCost,
  vendorEta,
  wasEtaHonored = true
}: ResolutionPanelProps) {
  if (!isCompleted) return null;

  const calculateDuration = () => {
    if (!startTime || !completionTime) return null;
    const start = new Date(startTime);
    const end = new Date(completionTime);
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    
    if (hours < 24) {
      return `${hours} hours`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    }
  };

  const costSavings = estimatedCost && actualCost ? estimatedCost - actualCost : null;
  const duration = calculateDuration();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-lg p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-full bg-green-500/20 p-3">
          <CheckCircle className="h-6 w-6 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-green-400">Request Completed</h3>
          <p className="text-sm text-muted-foreground">Successfully resolved</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Duration */}
        {duration && (
          <div className="bg-background/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Total Duration</span>
            </div>
            <p className="text-lg font-semibold">{duration}</p>
          </div>
        )}

        {/* Cost */}
        {actualCost !== undefined && (
          <div className="bg-background/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">Final Cost</span>
            </div>
            <p className="text-lg font-semibold">${actualCost}</p>
            {costSavings && costSavings > 0 && (
              <p className="text-xs text-green-400 mt-1">
                Saved ${costSavings}
              </p>
            )}
          </div>
        )}

        {/* ETA Performance */}
        {vendorEta && (
          <div className="bg-background/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">ETA Performance</span>
            </div>
            <Badge 
              variant={wasEtaHonored ? "default" : "destructive"}
              className={wasEtaHonored ? "bg-green-500/20 text-green-400" : ""}
            >
              {wasEtaHonored ? 'On Time' : 'Delayed'}
            </Badge>
          </div>
        )}

        {/* Satisfaction (mock) */}
        <div className="bg-background/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Star className="h-4 w-4" />
            <span className="text-xs">Satisfaction</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "h-4 w-4",
                  star <= 4 ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <p className="text-sm font-medium mb-3">Performance Metrics</p>
        
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Response Time</span>
              <span className="font-medium">Excellent</span>
            </div>
            <Progress value={95} className="h-1.5" />
          </div>
          
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Cost Efficiency</span>
              <span className="font-medium">
                {costSavings && costSavings > 0 ? 'Above Average' : 'Average'}
              </span>
            </div>
            <Progress value={costSavings && costSavings > 0 ? 80 : 60} className="h-1.5" />
          </div>
          
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">AI Accuracy</span>
              <span className="font-medium">High</span>
            </div>
            <Progress value={88} className="h-1.5" />
          </div>
        </div>
      </div>

      {/* Report Link */}
      <button className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
        <FileText className="h-4 w-4" />
        View Full Resolution Report
      </button>
    </motion.div>
  );
}