'use client';

import { motion } from 'framer-motion';
import { Check, Circle, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowState } from '@/types';

interface WorkflowStep {
  state: WorkflowState;
  label: string;
  description: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    state: 'SUBMITTED',
    label: 'Submitted',
    description: 'Request received'
  },
  {
    state: 'OWNER_NOTIFIED',
    label: 'Owner Notified',
    description: 'Awaiting approval'
  },
  {
    state: 'OWNER_RESPONDED',
    label: 'Owner Responded',
    description: 'Decision received'
  },
  {
    state: 'DECISION_MADE',
    label: 'Decision Made',
    description: 'Processing request'
  },
  {
    state: 'VENDOR_CONTACTED',
    label: 'Vendor Contacted',
    description: 'Finding contractor'
  },
  {
    state: 'AWAITING_VENDOR_RESPONSE',
    label: 'Awaiting Vendor',
    description: 'Getting quotes'
  },
  {
    state: 'ETA_CONFIRMED',
    label: 'ETA Confirmed',
    description: 'Scheduled'
  },
  {
    state: 'TENANT_NOTIFIED',
    label: 'Tenant Notified',
    description: 'Update sent'
  },
  {
    state: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Work underway'
  },
  {
    state: 'COMPLETED',
    label: 'Completed',
    description: 'All done!'
  }
];

interface WorkflowTimelineProps {
  currentState: WorkflowState;
  stateHistory?: Array<{
    from_state?: string;
    to_state: string;
    timestamp: string;
    metadata?: any;
  }>;
  isDenied?: boolean;
}

export function WorkflowTimeline({ currentState, stateHistory = [], isDenied = false }: WorkflowTimelineProps) {
  const getStepStatus = (step: WorkflowStep): 'completed' | 'current' | 'upcoming' | 'skipped' => {
    if (isDenied && step.state === 'CLOSED_DENIED') return 'current';
    if (isDenied) return 'skipped';
    
    const stepIndex = WORKFLOW_STEPS.findIndex(s => s.state === step.state);
    const currentIndex = WORKFLOW_STEPS.findIndex(s => s.state === currentState);
    
    if (currentState === 'CLOSED_DENIED') {
      // For denied workflows, show completed up to OWNER_RESPONDED
      const deniedIndex = WORKFLOW_STEPS.findIndex(s => s.state === 'OWNER_RESPONDED');
      if (stepIndex < deniedIndex) return 'completed';
      if (stepIndex === deniedIndex) return 'completed';
      return 'skipped';
    }
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-white" />;
      case 'current':
        return (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Circle className="h-3 w-3 fill-white text-white" />
          </motion.div>
        );
      case 'skipped':
        return <X className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Circle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'current':
        return 'bg-primary ai-glow';
      case 'skipped':
        return 'bg-muted';
      default:
        return 'bg-muted/50';
    }
  };

  const getLineColor = (index: number) => {
    if (isDenied && index >= 2) return 'bg-muted';
    
    const currentIndex = WORKFLOW_STEPS.findIndex(s => s.state === currentState);
    return index < currentIndex ? 'bg-green-500' : 'bg-muted/30';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Workflow Progress</h3>
      
      <div className="relative">
        {WORKFLOW_STEPS.map((step, index) => {
          const status = getStepStatus(step);
          const isLast = index === WORKFLOW_STEPS.length - 1;
          
          return (
            <motion.div
              key={step.state}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative flex items-start pb-8 last:pb-0"
            >
              {/* Connecting line */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-4 top-8 w-0.5 h-full",
                    getLineColor(index),
                    "transition-colors duration-500"
                  )}
                />
              )}
              
              {/* Step indicator */}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 items-center justify-center rounded-full",
                  getStepColor(status),
                  "transition-all duration-300",
                  status === 'current' && "ring-4 ring-primary/20"
                )}
              >
                {getStepIcon(status)}
              </div>
              
              {/* Step content */}
              <div className="ml-4 flex-1">
                <div
                  className={cn(
                    "font-medium",
                    status === 'completed' && "text-green-400",
                    status === 'current' && "text-primary",
                    status === 'upcoming' && "text-muted-foreground",
                    status === 'skipped' && "text-muted-foreground line-through"
                  )}
                >
                  {step.label}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {step.description}
                </div>
                
                {/* Timestamp from history */}
                {stateHistory.find(h => h.to_state === step.state) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    {new Date(stateHistory.find(h => h.to_state === step.state)!.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        
        {/* Show denied state if applicable */}
        {isDenied && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative flex items-start"
          >
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-500">
              <X className="h-4 w-4 text-white" />
            </div>
            <div className="ml-4 flex-1">
              <div className="font-medium text-red-400">Request Denied</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Owner rejected the request
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}