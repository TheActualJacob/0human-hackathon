'use client';

import { useState, useEffect } from 'react';
import { 
  Brain,
  Zap,
  Plus,
  Search,
  Filter,
  Home,
  User,
  Calendar,
  AlertCircle,
  Wrench,
  Clock,
  CheckCircle2,
  Circle,
  XCircle,
  MessageSquare,
  Shield,
  Building,
  Loader2,
  ChevronRight,
  Send,
  DollarSign,
  BarChart3,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Timer,
  Settings2,
  Sparkles,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useStore from '@/lib/store/useStore';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AIAnalysis, AutoApprovalPolicy, MaintenanceWorkflowWithDetails } from '@/types';

// ─── Workflow state definitions ───────────────────────────────────────────────

type WorkflowState =
  | 'SUBMITTED'
  | 'OWNER_NOTIFIED'
  | 'OWNER_RESPONDED'
  | 'DECISION_MADE'
  | 'VENDOR_CONTACTED'
  | 'AWAITING_VENDOR_RESPONSE'
  | 'ETA_CONFIRMED'
  | 'TENANT_NOTIFIED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED_DENIED';

const NORMAL_STATES: WorkflowState[] = [
  'SUBMITTED',
  'OWNER_NOTIFIED',
  'OWNER_RESPONDED',
  'DECISION_MADE',
  'VENDOR_CONTACTED',
  'AWAITING_VENDOR_RESPONSE',
  'ETA_CONFIRMED',
  'TENANT_NOTIFIED',
  'IN_PROGRESS',
  'COMPLETED',
];

const NORMAL_STATES_NO_VENDOR: WorkflowState[] = [
  'SUBMITTED',
  'OWNER_NOTIFIED',
  'OWNER_RESPONDED',
  'DECISION_MADE',
  'IN_PROGRESS',
  'COMPLETED',
];

const STATE_LABELS: Record<WorkflowState, string> = {
  SUBMITTED: 'Submitted',
  OWNER_NOTIFIED: 'Owner Notified',
  OWNER_RESPONDED: 'Owner Responded',
  DECISION_MADE: 'Decision Made',
  VENDOR_CONTACTED: 'Vendor Contacted',
  AWAITING_VENDOR_RESPONSE: 'Awaiting Vendor',
  ETA_CONFIRMED: 'ETA Confirmed',
  TENANT_NOTIFIED: 'Tenant Notified',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CLOSED_DENIED: 'Closed / Denied',
};

const STATE_COLORS: Record<WorkflowState, string> = {
  SUBMITTED: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  OWNER_NOTIFIED: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  OWNER_RESPONDED: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  DECISION_MADE: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  VENDOR_CONTACTED: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  AWAITING_VENDOR_RESPONSE: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  ETA_CONFIRMED: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  TENANT_NOTIFIED: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  IN_PROGRESS: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
  COMPLETED: 'bg-green-500/20 text-green-300 border-green-500/30',
  CLOSED_DENIED: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const URGENCY_COLORS: Record<string, string> = {
  emergency: 'bg-red-500/20 text-red-300 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  routine: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const CATEGORY_ICONS: Record<string, string> = {
  plumbing: '🔧',
  electrical: '⚡',
  hvac: '❄️',
  heating: '🔥',
  appliance: '🍳',
  structural: '🏗️',
  pest: '🐛',
  cosmetic: '🎨',
  other: '🔩',
  damp: '💧',
  access: '🔑',
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function WorkflowTimeline({
  currentState,
  vendorRequired,
}: {
  currentState: WorkflowState;
  vendorRequired: boolean;
}) {
  const isDenied = currentState === 'CLOSED_DENIED';
  const states = isDenied
    ? (['SUBMITTED', 'OWNER_NOTIFIED', 'OWNER_RESPONDED', 'CLOSED_DENIED'] as WorkflowState[])
    : vendorRequired
      ? NORMAL_STATES
      : NORMAL_STATES_NO_VENDOR;

  const currentIdx = states.indexOf(currentState);

  return (
    <div className="space-y-1">
      {states.map((state, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;
        const isDeniedState = state === 'CLOSED_DENIED';

        return (
          <div key={state} className="flex items-start gap-3">
            {/* Connector line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border text-xs font-bold transition-all',
                  isCompleted && 'bg-green-500/20 border-green-500/50 text-green-400',
                  isCurrent && !isDeniedState && 'bg-primary/20 border-primary text-primary animate-pulse',
                  isCurrent && isDeniedState && 'bg-red-500/20 border-red-500/50 text-red-400',
                  isFuture && 'bg-card border-border/50 text-muted-foreground/40'
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : isCurrent && isDeniedState ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : isCurrent ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
              {idx < states.length - 1 && (
                <div
                  className={cn(
                    'w-px h-5 mt-0.5',
                    isCompleted ? 'bg-green-500/30' : 'bg-border/30'
                  )}
                />
              )}
            </div>

            {/* Label */}
            <div className="pb-4 flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm font-medium leading-tight',
                  isCompleted && 'text-green-400',
                  isCurrent && !isDeniedState && 'text-primary',
                  isCurrent && isDeniedState && 'text-red-400',
                  isFuture && 'text-muted-foreground/40'
                )}
              >
                {STATE_LABELS[state]}
              </p>
              {isCurrent && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isDeniedState ? 'Request closed by owner' : 'Current stage'}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommunicationFeed({ communications }: { communications: any[] }) {
  const sorted = [...communications].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  if (!sorted.length) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        No communications yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((comm) => {
        const isSystem = comm.sender_type === 'system';
        const isOwner = comm.sender_type === 'owner';
        const isVendor = comm.sender_type === 'vendor';
        const isTenant = comm.sender_type === 'tenant';

        if (isSystem) {
          return (
            <div key={comm.id} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-gray-500/20 border border-gray-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap className="h-3 w-3 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-card/50 border border-border/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    AI System · {formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{comm.message}</p>
                </div>
              </div>
            </div>
          );
        }

        const bubbleColor = isTenant
          ? 'bg-blue-500/10 border-blue-500/20'
          : isOwner
            ? 'bg-green-500/10 border-green-500/20'
            : isVendor
              ? 'bg-orange-500/10 border-orange-500/20'
              : 'bg-card border-border/50';

        const nameColor = isTenant
          ? 'text-blue-400'
          : isOwner
            ? 'text-green-400'
            : isVendor
              ? 'text-orange-400'
              : 'text-muted-foreground';

        const SenderIcon = isTenant ? User : isOwner ? Shield : isVendor ? Wrench : MessageSquare;

        return (
          <div key={comm.id} className={cn('flex items-start gap-2', isOwner && 'flex-row-reverse')}>
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border',
                isTenant && 'bg-blue-500/20 border-blue-500/30',
                isOwner && 'bg-green-500/20 border-green-500/30',
                isVendor && 'bg-orange-500/20 border-orange-500/30'
              )}
            >
              <SenderIcon className={cn('h-3 w-3', nameColor)} />
            </div>
            <div className={cn('flex-1 min-w-0', isOwner && 'flex flex-col items-end')}>
              <div className={cn('rounded-lg px-3 py-2 border max-w-[85%]', bubbleColor)}>
                <p className={cn('text-xs font-medium mb-0.5', nameColor)}>
                  {comm.sender_name} ·{' '}
                  {formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}
                </p>
                <p className="text-sm text-foreground leading-relaxed">{comm.message}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AIDecisionPanel({ analysis }: { analysis: AIAnalysis }) {
  const costLabels = { low: '< $200', medium: '$200–$800', high: '> $800' };
  const costColors = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-red-400',
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-accent/30">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">AI Analysis</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {Math.round(analysis.confidence_score * 100)}% confidence
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Confidence bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Confidence</span>
            <span>{Math.round(analysis.confidence_score * 100)}%</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.round(analysis.confidence_score * 100)}%` }}
            />
          </div>
        </div>

        {/* Category */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Category</span>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{CATEGORY_ICONS[analysis.category] ?? '🔩'}</span>
            <span className="text-sm font-medium capitalize">{analysis.category}</span>
          </div>
        </div>

        {/* Urgency */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Urgency</span>
          <span
            className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded border uppercase tracking-wide',
              URGENCY_COLORS[analysis.urgency] ?? URGENCY_COLORS.medium
            )}
          >
            {analysis.urgency}
          </span>
        </div>

        {/* Estimated cost */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Est. Cost</span>
          <span
            className={cn(
              'text-sm font-bold',
              costColors[analysis.estimated_cost_range] ?? 'text-foreground'
            )}
          >
            {costLabels[analysis.estimated_cost_range]}
          </span>
        </div>

        {/* Vendor required */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Vendor Required</span>
          <span
            className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded border',
              analysis.vendor_required
                ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                : 'bg-green-500/20 text-green-300 border-green-500/30'
            )}
          >
            {analysis.vendor_required ? 'Yes' : 'No'}
          </span>
        </div>

        {/* Reasoning */}
        <div className="pt-1 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Reasoning</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{analysis.reasoning}</p>
        </div>
      </div>
    </div>
  );
}

function OwnerActionPanel({
  workflowId,
  onSubmit,
}: {
  workflowId: string;
  onSubmit: (response: 'approved' | 'denied' | 'question', message?: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<'approved' | 'denied' | 'question' | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await onSubmit(selected, message || undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-yellow-500/30 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-yellow-500/20 bg-yellow-500/5">
        <Shield className="h-4 w-4 text-yellow-400" />
        <span className="text-sm font-semibold text-yellow-300">Owner Decision Required</span>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          AI has analyzed this request. Review the AI assessment and approve, deny, or ask a
          question before proceeding.
        </p>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setSelected('approved')}
            className={cn(
              'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all',
              selected === 'approved'
                ? 'bg-green-500/20 border-green-500/50 text-green-300'
                : 'bg-card border-border hover:border-green-500/40 text-muted-foreground hover:text-green-400'
            )}
          >
            <ThumbsUp className="h-4 w-4" />
            Approve
          </button>
          <button
            onClick={() => setSelected('denied')}
            className={cn(
              'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all',
              selected === 'denied'
                ? 'bg-red-500/20 border-red-500/50 text-red-300'
                : 'bg-card border-border hover:border-red-500/40 text-muted-foreground hover:text-red-400'
            )}
          >
            <ThumbsDown className="h-4 w-4" />
            Deny
          </button>
          <button
            onClick={() => setSelected('question')}
            className={cn(
              'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all',
              selected === 'question'
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                : 'bg-card border-border hover:border-blue-500/40 text-muted-foreground hover:text-blue-400'
            )}
          >
            <HelpCircle className="h-4 w-4" />
            Question
          </button>
        </div>

        {selected && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {selected === 'approved'
                ? 'Optional note for vendor/tenant'
                : selected === 'denied'
                  ? 'Reason for denial (optional)'
                  : 'Your question'}
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                selected === 'approved'
                  ? 'e.g. Please fix ASAP...'
                  : selected === 'denied'
                    ? 'e.g. Not covered under our agreement...'
                    : 'e.g. Has the tenant tried...'
              }
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!selected || loading}
          className={cn(
            'w-full text-sm h-9',
            selected === 'approved' && 'bg-green-600 hover:bg-green-700 text-white',
            selected === 'denied' && 'bg-red-600 hover:bg-red-700 text-white',
            selected === 'question' && 'bg-blue-600 hover:bg-blue-700 text-white'
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processing...
            </>
          ) : selected ? (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit{' '}
              {selected === 'approved'
                ? 'Approval'
                : selected === 'denied'
                  ? 'Denial'
                  : 'Question'}
            </>
          ) : (
            'Select a decision above'
          )}
        </Button>
      </div>
    </div>
  );
}

function VendorCoordinationPanel({
  workflowId,
  vendorMessage,
  onSubmit,
}: {
  workflowId: string;
  vendorMessage: string | null;
  onSubmit: (eta: Date, notes: string) => Promise<void>;
}) {
  const [eta, setEta] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!eta) return;
    setLoading(true);
    try {
      await onSubmit(new Date(eta), notes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-indigo-500/30 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-500/20 bg-indigo-500/5">
        <Building className="h-4 w-4 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300">Vendor Coordination</span>
      </div>

      <div className="p-4 space-y-4">
        {vendorMessage && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">AI-Crafted Outreach Message</p>
            <div className="bg-accent/40 border border-border/50 rounded-lg p-3">
              <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {vendorMessage}
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-border/50 pt-3 space-y-3">
          <p className="text-xs font-medium text-orange-300 flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" />
            Simulate Vendor Response
          </p>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Vendor ETA</Label>
            <Input
              type="datetime-local"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              className="text-sm h-9"
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Vendor Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Will bring replacement parts, need access to utility room..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!eta || loading}
            className="w-full text-sm h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Confirm ETA & Notify Tenant
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResolutionSummary({
  workflow,
  requestDetails,
}: {
  workflow: any;
  requestDetails: any;
}) {
  const createdAt = new Date(workflow.created_at);
  const completedAt = requestDetails?.completed_at ? new Date(requestDetails.completed_at) : new Date();
  const durationMs = completedAt.getTime() - createdAt.getTime();
  const durationHours = Math.round(durationMs / (1000 * 60 * 60));
  const durationText =
    durationHours < 24
      ? `${durationHours}h`
      : `${Math.round(durationHours / 24)}d`;

  return (
    <div className="bg-card border border-green-500/30 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-green-500/20 bg-green-500/5">
        <CheckCircle2 className="h-4 w-4 text-green-400" />
        <span className="text-sm font-semibold text-green-300">Resolution Complete</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-accent/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Resolution Time</p>
            <p className="text-2xl font-bold text-green-400">{durationText}</p>
          </div>
          <div className="bg-accent/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Outcome</p>
            <p className="text-sm font-semibold text-green-300">Resolved</p>
          </div>
        </div>
        {requestDetails?.cost && (
          <div className="flex items-center justify-between bg-accent/40 rounded-lg p-3">
            <span className="text-xs text-muted-foreground">Final Cost</span>
            <span className="font-bold text-green-400">${requestDetails.cost}</span>
          </div>
        )}
        {workflow.vendor_eta && (
          <div className="flex items-center justify-between bg-accent/40 rounded-lg p-3">
            <span className="text-xs text-muted-foreground">Vendor ETA was</span>
            <span className="text-sm">{format(new Date(workflow.vendor_eta), 'MMM d, h:mm a')}</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center">
          Completed {format(completedAt, 'MMM d, yyyy h:mm a')}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const {
    maintenanceWorkflows,
    maintenanceRequests,
    workflowCommunications,
    leases,
    tenants,
    units,
    getMaintenanceRequestWithDetails,
    getWorkflowWithDetails,
    selectedWorkflow,
    setSelectedWorkflow,
    submitMaintenanceWorkflow,
    handleOwnerResponse,
    handleVendorResponse,
    completeMaintenanceWorkflow,
    loading,
  } = useStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ leaseId: '', description: '' });

  const DEFAULT_POLICY: AutoApprovalPolicy = {
    enabled: false,
    minConfidence: 0.9,
    maxCostRange: 'low',
    excludeEmergency: true,
  };

  const [policy, setPolicy] = useState<AutoApprovalPolicy>(() => {
    if (typeof window === 'undefined') return DEFAULT_POLICY;
    try {
      const stored = localStorage.getItem('maintenance_auto_approval_policy');
      return stored ? { ...DEFAULT_POLICY, ...JSON.parse(stored) } : DEFAULT_POLICY;
    } catch {
      return DEFAULT_POLICY;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('maintenance_auto_approval_policy', JSON.stringify(policy));
    } catch {
      // localStorage unavailable
    }
  }, [policy]);

  const activeLeasesWithTenants = leases
    .filter((l) => l.status === 'active')
    .map((lease) => ({
      lease,
      tenant: tenants.find((t) => t.lease_id === lease.id && t.is_primary_tenant),
      unit: units.find((u) => u.id === lease.unit_id),
    }))
    .filter((l) => l.tenant && l.unit);

  // Build enriched workflow list
  const enrichedWorkflows = maintenanceWorkflows
    .map((wf) => {
      const request = maintenanceRequests.find((r) => r.id === wf.maintenance_request_id);
      const requestDetails = request ? getMaintenanceRequestWithDetails(request.id) : null;
      return { workflow: wf, request, requestDetails };
    })
    .filter(({ workflow, request }) => {
      if (!request) return true;
      const matchesSearch =
        !searchTerm ||
        request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getMaintenanceRequestWithDetails(request.id)
          ?.lease?.tenants?.[0]?.full_name.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        getMaintenanceRequestWithDetails(request.id)
          ?.lease?.unit?.unit_identifier.toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesFilter =
        filterState === 'all' ||
        (filterState === 'active'
          ? !['COMPLETED', 'CLOSED_DENIED'].includes(workflow.current_state ?? '')
          : workflow.current_state === filterState);
      return matchesSearch && matchesFilter;
    })
    .sort(
      (a, b) =>
        new Date(b.workflow.created_at).getTime() - new Date(a.workflow.created_at).getTime()
    );

  const selectedWorkflowData = selectedWorkflow ? getWorkflowWithDetails(selectedWorkflow) : null;
  const selectedRequest = selectedWorkflowData?.maintenance_request;
  const selectedComms = workflowCommunications.filter((c) => c.workflow_id === selectedWorkflow);
  const selectedAI = (selectedWorkflowData?.ai_analysis as AIAnalysis) ?? null;
  const currentState = (selectedWorkflowData?.current_state ?? 'SUBMITTED') as WorkflowState;
  const vendorRequired = selectedAI?.vendor_required ?? false;

  const handleCreateRequest = async () => {
    if (!formData.leaseId || !formData.description) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitMaintenanceWorkflow(formData.leaseId, formData.description, policy);
      setIsCreateDialogOpen(false);
      setFormData({ leaseId: '', description: '' });
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOwnerAction = async (
    response: 'approved' | 'denied' | 'question',
    message?: string
  ) => {
    if (!selectedWorkflow) return;
    await handleOwnerResponse(selectedWorkflow, response, message);
  };

  const handleVendorAction = async (eta: Date, notes: string) => {
    if (!selectedWorkflow) return;
    await handleVendorResponse(selectedWorkflow, null, eta, notes || undefined);
  };

  const handleComplete = async () => {
    if (!selectedWorkflow) return;
    await completeMaintenanceWorkflow(selectedWorkflow);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading AI Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Left Panel ─────────────────────────────────────────────────────── */}
      <div className="w-[420px] border-r border-border flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">AI Maintenance Command Center</h1>
          </div>
          <p className="text-xs text-muted-foreground pl-9 mb-4">
            Autonomous triage, approval, and dispatch
          </p>

          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium ai-glow"
            >
              <Plus className="h-4 w-4" />
              New Request
            </button>
            <Link
              href="/landlord/settings?tab=automation"
              title="AI Automation Settings"
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                policy.enabled
                  ? 'bg-green-500/15 border-green-500/40 text-green-300 hover:bg-green-500/25'
                  : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {policy.enabled ? 'Agent ON' : 'Agent OFF'}
            </Link>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <Select value={filterState} onValueChange={setFilterState}>
              <SelectTrigger className="h-8 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="OWNER_NOTIFIED">Awaiting Owner</SelectItem>
                <SelectItem value="AWAITING_VENDOR_RESPONSE">Awaiting Vendor</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CLOSED_DENIED">Closed / Denied</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Workflow List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {enrichedWorkflows.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Wrench className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No maintenance requests found</p>
              <p className="text-xs text-muted-foreground/60">
                Submit a new request to start the AI workflow
              </p>
            </div>
          ) : (
            enrichedWorkflows.map(({ workflow, request, requestDetails }) => {
              const isSelected = selectedWorkflow === workflow.id;
              const state = (workflow.current_state ?? 'SUBMITTED') as WorkflowState;
              const ai = workflow.ai_analysis as AIAnalysis | null;
              const wasAutoApproved =
                workflow.owner_response === 'approved' &&
                typeof workflow.owner_message === 'string' &&
                workflow.owner_message.startsWith('Auto-approved');
              
              return (
                <div
                  key={workflow.id}
                  onClick={() => setSelectedWorkflow(workflow.id)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    isSelected
                      ? 'bg-accent border-primary/60 ai-glow'
                      : 'bg-card border-border hover:border-primary/30 hover:bg-accent/30'
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0">
                        {CATEGORY_ICONS[ai?.category ?? 'other'] ?? '🔩'}
                      </span>
                      <p className="text-sm font-medium line-clamp-2 flex-1 leading-snug">
                        {request?.description ?? 'Maintenance request'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded border font-medium',
                          STATE_COLORS[state]
                        )}
                      >
                        {STATE_LABELS[state]}
                      </span>
                      {ai?.urgency && (
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded border uppercase tracking-wide',
                            URGENCY_COLORS[ai.urgency] ?? URGENCY_COLORS.medium
                          )}
                        >
                          {ai.urgency}
                      </span>
                      )}
                      {wasAutoApproved && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-green-500/15 border-green-500/30 text-green-400 font-medium">
                          <Sparkles className="h-2.5 w-2.5" />
                          Auto
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {requestDetails?.lease?.tenants?.[0] && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {requestDetails.lease.tenants[0].full_name}
                        </span>
                      )}
                      {requestDetails?.lease?.unit && (
                        <span className="flex items-center gap-1">
                          <Home className="h-3 w-3" />
                          {requestDetails.lease.unit.unit_identifier}
                        </span>
                      )}
                      <span className="flex items-center gap-1 ml-auto">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(workflow.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {selectedWorkflowData && selectedRequest ? (
          <div className="p-6 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={cn(
                      'text-xs font-semibold px-2.5 py-1 rounded border',
                      STATE_COLORS[currentState]
                    )}
                  >
                    {STATE_LABELS[currentState]}
                </span>
                  {selectedAI?.urgency && (
                    <span
                      className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded border uppercase tracking-wide',
                        URGENCY_COLORS[selectedAI.urgency] ?? URGENCY_COLORS.medium
                      )}
                    >
                      {selectedAI.urgency}
                    </span>
                  )}
                  {selectedAI?.category && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{CATEGORY_ICONS[selectedAI.category] ?? '🔩'}</span>
                      <span className="capitalize">{selectedAI.category}</span>
                    </span>
                  )}
              </div>
                {selectedWorkflowData.owner_response === 'approved' &&
                  typeof selectedWorkflowData.owner_message === 'string' &&
                  selectedWorkflowData.owner_message.startsWith('Auto-approved') && (
                    <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-green-500/10 border border-green-500/25 rounded-lg">
                      <Sparkles className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                      <p className="text-xs text-green-300 font-medium">
                        Auto-approved by policy —{' '}
                        <span className="font-normal text-green-300/80">
                          {selectedWorkflowData.owner_message}
                        </span>
                      </p>
                </div>
                  )}
                <h2 className="text-xl font-bold line-clamp-2 leading-snug">
                  {selectedRequest.description ?? 'Maintenance Request'}
                </h2>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {selectedRequest.lease?.tenants?.[0] && (
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {selectedRequest.lease.tenants[0].full_name}
                    </span>
                  )}
                  {selectedRequest.lease?.unit && (
                    <span className="flex items-center gap-1">
                      <Home className="h-3.5 w-3.5" />
                      {selectedRequest.lease.unit.unit_identifier}
                      {selectedRequest.lease.unit.address &&
                        `, ${selectedRequest.lease.unit.address}`}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(selectedWorkflowData.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                </div>

              {currentState === 'IN_PROGRESS' && (
                <Button
                  onClick={handleComplete}
                  className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Completed
                </Button>
              )}
            </div>

            {/* Main 2-column grid */}
            <div className="grid grid-cols-5 gap-6">
              {/* Primary column (3/5) */}
              <div className="col-span-3 space-y-6">
                {/* Workflow Timeline */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-accent/30">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Workflow Timeline</span>
                  </div>
                  <div className="p-4">
                    <WorkflowTimeline
                      currentState={currentState}
                      vendorRequired={vendorRequired}
                    />
              </div>
            </div>

                {/* Communication Feed */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-accent/30">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Communication Feed</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {selectedComms.length} messages
                      </span>
                    </div>
                  <div className="p-4 max-h-[600px] overflow-y-auto">
                    <CommunicationFeed communications={selectedComms} />
                    </div>
                </div>
              </div>

              {/* Secondary column (2/5) */}
              <div className="col-span-2 space-y-4">
                {/* AI Decision Panel */}
                {selectedAI && <AIDecisionPanel analysis={selectedAI} />}

                {/* Owner Action Panel */}
                {currentState === 'OWNER_NOTIFIED' && (
                  <OwnerActionPanel workflowId={selectedWorkflow!} onSubmit={handleOwnerAction} />
                )}

                {/* Vendor Coordination Panel */}
                {(currentState === 'VENDOR_CONTACTED' ||
                  currentState === 'AWAITING_VENDOR_RESPONSE') && (
                  <VendorCoordinationPanel
                    workflowId={selectedWorkflow!}
                    vendorMessage={selectedWorkflowData.vendor_message}
                    onSubmit={handleVendorAction}
                  />
                )}

                {/* Resolution Summary */}
                {currentState === 'COMPLETED' && (
                  <ResolutionSummary
                    workflow={selectedWorkflowData}
                    requestDetails={selectedRequest}
                  />
                )}

                {/* Denial notice */}
                {currentState === 'CLOSED_DENIED' && (
                  <div className="bg-card border border-red-500/30 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-red-500/20 bg-red-500/5">
                      <XCircle className="h-4 w-4 text-red-400" />
                      <span className="text-sm font-semibold text-red-300">Request Denied</span>
                  </div>
                    <div className="p-4 space-y-2">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        This request was denied by the property owner.{' '}
                        {selectedWorkflowData.owner_message
                          ? `Reason: ${selectedWorkflowData.owner_message}`
                          : 'No reason was provided.'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Closed on{' '}
                        {format(new Date(selectedWorkflowData.updated_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
              </div>
            )}

                {/* Tenant info card */}
                {selectedRequest.lease && (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-accent/30">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Tenant & Location</span>
                    </div>
                    <div className="p-4 space-y-2">
                      {selectedRequest.lease.tenants?.[0] && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">
                            {selectedRequest.lease.tenants[0].full_name}
                          </span>
                  </div>
                      )}
                      {selectedRequest.lease.unit && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Home className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>
                            {selectedRequest.lease.unit.unit_identifier}
                            {selectedRequest.lease.unit.address &&
                              ` · ${selectedRequest.lease.unit.address}`}
                          </span>
                </div>
                      )}
                      {selectedWorkflowData.vendor_eta && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>
                            Vendor ETA:{' '}
                            {format(new Date(selectedWorkflowData.vendor_eta), 'MMM d, h:mm a')}
                          </span>
              </div>
            )}
                </div>
              </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full space-y-4 text-center p-8">
            <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
              <Brain className="h-10 w-10 text-primary/60" />
            </div>
            <h3 className="text-lg font-semibold">AI Maintenance Command Center</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Select a maintenance request from the list to view the full AI workflow, or submit a
              new request to start autonomous triage.
            </p>
          </div>
        )}
      </div>

      {/* ── Create Request Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) {
            setIsCreateDialogOpen(open);
            if (!open) {
              setFormData({ leaseId: '', description: '' });
              setSubmitError(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Submit Maintenance Request
            </DialogTitle>
            <DialogDescription>
              Describe the issue. Claude will analyze it, classify urgency and category, determine
              vendor requirements, and immediately notify the property owner for approval.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lease">Unit / Tenant</Label>
              <Select
                value={formData.leaseId}
                onValueChange={(value) => setFormData({ ...formData, leaseId: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger id="lease">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {activeLeasesWithTenants.map(({ lease, tenant, unit }) => (
                    <SelectItem key={lease.id} value={lease.id}>
                      {unit?.unit_identifier ?? lease.unit_id} — {tenant?.full_name ?? 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Issue Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the maintenance issue in detail..."
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                className="resize-none"
              />
              {formData.description === '' && !isSubmitting && (
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                    ...formData, 
                      description:
                        'There is water leaking from under my kitchen sink. It started two days ago and is getting worse. The cabinet below is soaked.',
                    })
                  }
                  className="text-xs text-primary hover:underline"
                >
                  Try example: "Water leaking under kitchen sink..."
                </button>
              )}
            </div>

            {isSubmitting && (
              <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary">AI analyzing and notifying owner...</p>
                  <p className="text-xs text-muted-foreground">
                    Claude is classifying the issue and creating the workflow
                  </p>
                </div>
              </div>
            )}

            {submitError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{submitError}</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateRequest}
              disabled={isSubmitting || !formData.leaseId || !formData.description}
              className="ai-glow"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Running AI Agent...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Submit to AI Engine
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
