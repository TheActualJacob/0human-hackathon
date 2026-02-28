'use client';

import { motion } from 'framer-motion';
import { 
  Brain, 
  Zap, 
  DollarSign, 
  Wrench, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AIAnalysis } from '@/types';

interface AIDecisionPanelProps {
  analysis: AIAnalysis | null;
  isLoading?: boolean;
}

export function AIDecisionPanel({ analysis, isLoading = false }: AIDecisionPanelProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="rounded-lg bg-primary/10 p-3"
          >
            <Brain className="h-6 w-6 text-primary" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold">AI Analysis</h3>
            <p className="text-sm text-muted-foreground">Analyzing maintenance request...</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-muted p-3">
            <Brain className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">AI Analysis</h3>
            <p className="text-sm text-muted-foreground">No analysis available</p>
          </div>
        </div>
      </div>
    );
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, JSX.Element> = {
      plumbing: <Wrench className="h-5 w-5" />,
      electrical: <Zap className="h-5 w-5" />,
      hvac: <Info className="h-5 w-5" />,
      appliance: <Info className="h-5 w-5" />,
      structural: <AlertTriangle className="h-5 w-5" />,
      pest: <Info className="h-5 w-5" />,
      cosmetic: <Info className="h-5 w-5" />,
      other: <Info className="h-5 w-5" />
    };
    return icons[category] || <Info className="h-5 w-5" />;
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'high':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'medium':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'low':
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getCostEstimate = (range: string) => {
    switch (range) {
      case 'low':
        return '< $200';
      case 'medium':
        return '$200 - $800';
      case 'high':
        return '> $800';
      default:
        return 'Unknown';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-primary/20 rounded-lg p-6 ai-glow"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-lg bg-primary/10 p-3">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">AI Decision Analysis</h3>
          <p className="text-sm text-muted-foreground">Claude&apos;s assessment of the issue</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Category */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Category</span>
          <div className="flex items-center gap-2">
            {getCategoryIcon(analysis.category)}
            <span className="font-medium capitalize">{analysis.category}</span>
          </div>
        </div>

        {/* Urgency */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Urgency</span>
          <Badge 
            variant="outline" 
            className={cn("capitalize", getUrgencyColor(analysis.urgency))}
          >
            {analysis.urgency}
          </Badge>
        </div>

        {/* Cost Estimate */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Estimated Cost</span>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="font-medium">{getCostEstimate(analysis.estimated_cost_range)}</span>
          </div>
        </div>

        {/* Vendor Required */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Vendor Required</span>
          <div className="flex items-center gap-2">
            {analysis.vendor_required ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <Badge variant="default" className="bg-green-500/10 text-green-500">
                  Yes
                </Badge>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <Badge variant="outline" className="text-red-500">
                  No
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Reasoning */}
        <div className="pt-3 border-t border-border">
          <p className="text-sm font-medium text-muted-foreground mb-2">AI Reasoning</p>
          <p className="text-sm bg-muted/50 rounded-lg p-3">
            {analysis.reasoning}
          </p>
        </div>

        {/* Confidence Score */}
        <div className="pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Confidence Score</span>
            <span className="text-sm font-medium">
              {Math.round(analysis.confidence_score * 100)}%
            </span>
          </div>
          <Progress 
            value={analysis.confidence_score * 100} 
            className="h-2"
          />
        </div>
      </div>
    </motion.div>
  );
}