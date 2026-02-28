import { useState } from 'react';
import { MessageCircle, Send, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Conversation } from '@/types';

interface WhatsAppChatProps {
  conversations: Conversation[];
  onSendMessage?: (message: string) => void;
  tenantName?: string;
  className?: string;
}

export default function WhatsAppChat({ 
  conversations, 
  onSendMessage, 
  tenantName = "Tenant",
  className 
}: WhatsAppChatProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && onSendMessage) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-background rounded-lg border", className)}>
      {/* Header */}
      <div className="p-4 border-b bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{tenantName}</p>
            <p className="text-xs text-muted-foreground">WhatsApp Conversation</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversations.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No messages yet</p>
          </div>
        ) : (
          conversations.map((msg) => {
            const isInbound = msg.direction === 'inbound';
            
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2",
                  isInbound ? "justify-start" : "justify-end"
                )}
              >
                <div className={cn(
                  "max-w-[70%] rounded-lg p-3",
                  isInbound 
                    ? "bg-secondary text-secondary-foreground" 
                    : "bg-primary text-primary-foreground"
                )}>
                  <p className="text-sm whitespace-pre-wrap">{msg.message_body}</p>
                  <div className={cn(
                    "flex items-center gap-1 mt-1",
                    isInbound ? "justify-start" : "justify-end"
                  )}>
                    <span className="text-xs opacity-70">
                      {format(new Date(msg.timestamp || ''), 'HH:mm')}
                    </span>
                    {!isInbound && (
                      <CheckCheck className="h-3 w-3 opacity-70" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      {onSendMessage && (
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className={cn(
                "p-2 rounded-lg transition-colors",
                message.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}