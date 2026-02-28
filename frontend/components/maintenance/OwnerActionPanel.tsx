'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface OwnerActionPanelProps {
  workflowId: string;
  onResponse: (response: 'approved' | 'denied' | 'question', message?: string) => Promise<void>;
  isVisible: boolean;
  isLoading?: boolean;
}

export function OwnerActionPanel({ workflowId, onResponse, isVisible, isLoading = false }: OwnerActionPanelProps) {
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [message, setMessage] = useState('');
  const [actionType, setActionType] = useState<'approved' | 'denied' | 'question' | null>(null);

  const handleAction = async (action: 'approved' | 'denied' | 'question') => {
    if (action === 'approved' && !showMessageInput) {
      await onResponse('approved');
    } else if (!showMessageInput) {
      setActionType(action);
      setShowMessageInput(true);
    } else {
      await onResponse(action, message);
      setShowMessageInput(false);
      setMessage('');
      setActionType(null);
    }
  };

  const handleCancel = () => {
    setShowMessageInput(false);
    setMessage('');
    setActionType(null);
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-card border border-border rounded-lg p-6"
    >
      <h3 className="text-lg font-semibold mb-4">Owner Action Required</h3>
      
      <AnimatePresence mode="wait">
        {!showMessageInput ? (
          <motion.div
            key="buttons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <Button
              onClick={() => handleAction('approved')}
              disabled={isLoading}
              className="w-full bg-green-500 hover:bg-green-600 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Request
            </Button>
            
            <Button
              onClick={() => handleAction('denied')}
              disabled={isLoading}
              variant="outline"
              className="w-full border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Deny Request
            </Button>
            
            <Button
              onClick={() => handleAction('question')}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Ask Question
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="message"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <p className="text-sm text-muted-foreground">
              {actionType === 'denied' && 'Provide a reason for denial:'}
              {actionType === 'question' && 'What would you like to ask?'}
            </p>
            
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                actionType === 'denied' 
                  ? 'Explain why the request is denied...'
                  : 'Type your question...'
              }
              rows={3}
              className="resize-none"
            />
            
            <div className="flex gap-2">
              <Button
                onClick={() => handleAction(actionType!)}
                disabled={!message.trim() || isLoading}
                className={cn(
                  "flex-1",
                  actionType === 'denied' && "bg-red-500 hover:bg-red-600"
                )}
              >
                <Send className="h-4 w-4 mr-2" />
                Send {actionType === 'denied' ? 'Denial' : 'Question'}
              </Button>
              
              <Button
                onClick={handleCancel}
                disabled={isLoading}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}