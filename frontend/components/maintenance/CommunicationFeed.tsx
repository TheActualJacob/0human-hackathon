'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Home, Wrench, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowCommunication } from '@/types';

interface CommunicationFeedProps {
  communications: WorkflowCommunication[];
  currentUserType?: 'tenant' | 'owner' | 'vendor';
}

export function CommunicationFeed({ communications, currentUserType = 'owner' }: CommunicationFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [communications]);

  const getSenderIcon = (senderType: string) => {
    switch (senderType) {
      case 'tenant':
        return <User className="h-4 w-4" />;
      case 'owner':
        return <Home className="h-4 w-4" />;
      case 'vendor':
        return <Wrench className="h-4 w-4" />;
      case 'system':
        return <Bot className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getMessageAlignment = (senderType: string): 'left' | 'center' | 'right' => {
    if (senderType === 'system') return 'center';
    if (senderType === currentUserType) return 'right';
    return 'left';
  };

  const getMessageStyle = (senderType: string) => {
    if (senderType === 'system') {
      return 'bg-muted/50 text-muted-foreground text-sm max-w-md';
    }
    
    if (senderType === currentUserType) {
      return 'bg-primary text-primary-foreground';
    }
    
    switch (senderType) {
      case 'tenant':
        return 'bg-blue-500/20 text-blue-200';
      case 'vendor':
        return 'bg-purple-500/20 text-purple-200';
      case 'owner':
        return 'bg-green-500/20 text-green-200';
      default:
        return 'bg-card';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Communication Feed</h3>
      
      <div 
        ref={feedRef}
        className="bg-background/50 rounded-lg border border-border p-4 h-[400px] overflow-y-auto space-y-4"
      >
        <AnimatePresence initial={false}>
          {communications.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No messages yet
            </div>
          ) : (
            communications.map((comm, index) => {
              const alignment = getMessageAlignment(comm.sender_type);
              const isSystemMessage = comm.sender_type === 'system';
              
              return (
                <motion.div
                  key={comm.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={cn(
                    "flex",
                    alignment === 'left' && "justify-start",
                    alignment === 'center' && "justify-center",
                    alignment === 'right' && "justify-end"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[70%]",
                      isSystemMessage && "max-w-md"
                    )}
                  >
                    {/* Sender info */}
                    {!isSystemMessage && (
                      <div 
                        className={cn(
                          "flex items-center gap-2 mb-1 text-xs text-muted-foreground",
                          alignment === 'right' && "justify-end"
                        )}
                      >
                        {getSenderIcon(comm.sender_type)}
                        <span className="font-medium">
                          {comm.sender_name || comm.sender_type.charAt(0).toUpperCase() + comm.sender_type.slice(1)}
                        </span>
                        <span className="opacity-70">
                          {new Date(comm.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    )}
                    
                    {/* Message bubble */}
                    <div
                      className={cn(
                        "rounded-lg px-4 py-2.5",
                        getMessageStyle(comm.sender_type),
                        !isSystemMessage && "shadow-sm",
                        isSystemMessage && "text-center italic"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {comm.message}
                      </p>
                      
                      {/* Metadata (if any) */}
                      {comm.metadata && Object.keys(comm.metadata).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          {Object.entries(comm.metadata).map(([key, value]) => (
                            <div key={key} className="text-xs opacity-70">
                              <span className="font-medium">{key}:</span> {String(value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* System message timestamp */}
                    {isSystemMessage && (
                      <div className="text-center text-xs text-muted-foreground mt-1">
                        {new Date(comm.created_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}