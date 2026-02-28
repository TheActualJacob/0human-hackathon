'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Wrench, 
  Clock, 
  Calendar,
  MessageSquare,
  Send,
  DollarSign,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { VendorBid } from '@/types';

interface VendorCoordinationPanelProps {
  workflowId: string;
  vendorMessage: string | null;
  vendorBids: VendorBid[];
  onVendorResponse: (vendorId: string, eta: Date, notes?: string) => Promise<void>;
  isVisible: boolean;
  isLoading?: boolean;
}

export function VendorCoordinationPanel({
  workflowId,
  vendorMessage,
  vendorBids,
  onVendorResponse,
  isVisible,
  isLoading = false
}: VendorCoordinationPanelProps) {
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [etaDate, setEtaDate] = useState('');
  const [etaTime, setEtaTime] = useState('');
  const [notes, setNotes] = useState('');
  const [showResponseForm, setShowResponseForm] = useState(false);

  const handleSubmitResponse = async () => {
    if (!selectedVendorId || !etaDate || !etaTime) return;
    
    const eta = new Date(`${etaDate}T${etaTime}`);
    await onVendorResponse(selectedVendorId, eta, notes);
    
    // Reset form
    setSelectedVendorId('');
    setEtaDate('');
    setEtaTime('');
    setNotes('');
    setShowResponseForm(false);
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-6 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-purple-500/10 p-3">
          <Wrench className="h-6 w-6 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Vendor Coordination</h3>
          <p className="text-sm text-muted-foreground">Manage contractor assignment</p>
        </div>
      </div>

      {vendorMessage && (
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            AI-Generated Vendor Message:
          </p>
          <p className="text-sm whitespace-pre-wrap">{vendorMessage}</p>
        </div>
      )}

      {/* Vendor Selection / Bid Simulation */}
      {!showResponseForm ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Simulate vendor response by selecting a contractor:
          </p>
          
          <div className="space-y-2">
            <Button
              onClick={() => {
                setSelectedVendorId('vendor-1');
                setShowResponseForm(true);
              }}
              variant="outline"
              className="w-full justify-start"
              disabled={isLoading}
            >
              <User className="h-4 w-4 mr-2" />
              Quick Fix Plumbing - 4.8★ - Usually $150-$300
            </Button>
            
            <Button
              onClick={() => {
                setSelectedVendorId('vendor-2');
                setShowResponseForm(true);
              }}
              variant="outline"
              className="w-full justify-start"
              disabled={isLoading}
            >
              <User className="h-4 w-4 mr-2" />
              24/7 Emergency Services - 4.5★ - Premium rates
            </Button>
            
            <Button
              onClick={() => {
                setSelectedVendorId('vendor-3');
                setShowResponseForm(true);
              }}
              variant="outline"
              className="w-full justify-start"
              disabled={isLoading}
            >
              <User className="h-4 w-4 mr-2" />
              Budget Handyman - 4.2★ - Best prices
            </Button>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Vendor Response Form</p>
            <Badge variant="outline">
              {selectedVendorId === 'vendor-1' && 'Quick Fix Plumbing'}
              {selectedVendorId === 'vendor-2' && '24/7 Emergency Services'}
              {selectedVendorId === 'vendor-3' && 'Budget Handyman'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eta-date">
                <Calendar className="inline h-3 w-3 mr-1" />
                Date
              </Label>
              <Input
                id="eta-date"
                type="date"
                value={etaDate}
                onChange={(e) => setEtaDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="eta-time">
                <Clock className="inline h-3 w-3 mr-1" />
                Time
              </Label>
              <Input
                id="eta-time"
                type="time"
                value={etaTime}
                onChange={(e) => setEtaTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">
              <MessageSquare className="inline h-3 w-3 mr-1" />
              Additional Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes..."
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSubmitResponse}
              disabled={!etaDate || !etaTime || isLoading}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit ETA
            </Button>
            
            <Button
              onClick={() => {
                setShowResponseForm(false);
                setSelectedVendorId('');
                setEtaDate('');
                setEtaTime('');
                setNotes('');
              }}
              variant="outline"
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* Show existing bids if any */}
      {vendorBids.length > 0 && (
        <div className="pt-4 border-t border-border">
          <p className="text-sm font-medium mb-2">Vendor Bids Received:</p>
          <div className="space-y-2">
            {vendorBids.map((bid) => (
              <div key={bid.id} className="bg-muted/30 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Contractor #{bid.contractor_id.slice(0, 8)}</span>
                  <Badge variant="outline" className="text-xs">
                    <DollarSign className="h-3 w-3 mr-1" />
                    ${bid.bid_amount}
                  </Badge>
                </div>
                {bid.estimated_completion_time && (
                  <div className="text-muted-foreground text-xs mt-1">
                    ETA: {bid.estimated_completion_time} hours
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}