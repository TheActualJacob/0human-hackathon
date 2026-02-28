'use client';

import { useEffect, useState, useRef } from 'react';
import { 
  MessageCircle, Send, Search, Phone, User, Home, 
  Clock, AlertCircle, Check, CheckCheck, Bot, Filter
} from 'lucide-react';
import useStore from '@/lib/store/useStore';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Conversation, ConversationContext, Tenant, Lease, Unit } from '@/types';

interface ConversationGroup {
  lease: Lease;
  tenant: Tenant;
  unit: Unit;
  conversations: Conversation[];
  context: ConversationContext | null;
}

export default function ConversationsPage() {
  const { 
    conversations, 
    conversationContexts,
    tenants,
    leases,
    units,
    addConversation,
    updateConversationContext,
    loading 
  } = useStore();

  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Group conversations by lease
  const conversationGroups: ConversationGroup[] = leases
    .filter(lease => lease.status === 'active')
    .map(lease => {
      const tenant = tenants.find(t => t.lease_id === lease.id && t.is_primary_tenant);
      const unit = units.find(u => u.id === lease.unit_id);
      if (!tenant || !unit) return null;

      return {
        lease,
        tenant,
        unit,
        conversations: conversations.filter(c => c.lease_id === lease.id),
        context: conversationContexts.find(ctx => ctx.lease_id === lease.id) || null
      };
    })
    .filter(Boolean) as ConversationGroup[];

  // Filter by search query
  const filteredGroups = searchQuery 
    ? conversationGroups.filter(group => 
        group.tenant.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.unit.unit_identifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.tenant.whatsapp_number.includes(searchQuery)
      )
    : conversationGroups;

  // Get selected conversation group
  const selectedGroup = selectedLeaseId 
    ? conversationGroups.find(g => g.lease.id === selectedLeaseId)
    : null;

  // Sort conversations by timestamp
  const selectedConversations = selectedGroup 
    ? [...selectedGroup.conversations].sort((a, b) => 
        new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime()
      )
    : [];

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversations]);

  // Send message handler
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedLeaseId) return;

    await addConversation({
      lease_id: selectedLeaseId,
      direction: 'outbound',
      message_body: messageInput,
      intent_classification: 'general'
    });

    setMessageInput('');
  };

  // Format timestamp for messages
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday ' + format(date, 'HH:mm');
    return format(date, 'MMM d, HH:mm');
  };

  // Get last message preview
  const getLastMessage = (group: ConversationGroup) => {
    const lastConvo = group.conversations[group.conversations.length - 1];
    if (!lastConvo) return 'No messages yet';
    return lastConvo.message_body;
  };

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading conversations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4">
        <h1 className="text-2xl font-semibold">WhatsApp Conversations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage tenant communications and AI-assisted responses
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-96 border-r border-border flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {filteredGroups.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No active conversations</p>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isSelected = selectedLeaseId === group.lease.id;
                const hasUnread = group.conversations.some(c => 
                  c.direction === 'inbound' && !c.whatsapp_message_id?.includes('read')
                );

                return (
                  <div
                    key={group.lease.id}
                    onClick={() => setSelectedLeaseId(group.lease.id)}
                    className={cn(
                      "p-4 border-b border-border cursor-pointer transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-accent/50",
                      hasUnread && "bg-accent/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium truncate">
                            {group.tenant.full_name}
                          </p>
                          {group.conversations.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {formatMessageTime(group.conversations[group.conversations.length - 1].timestamp || '')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-1">
                          {group.unit.unit_identifier} • {group.tenant.whatsapp_number}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {getLastMessage(group)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedGroup ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedGroup.tenant.full_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Home className="h-3 w-3" />
                        {selectedGroup.unit.unit_identifier}
                        <Phone className="h-3 w-3" />
                        {selectedGroup.tenant.whatsapp_number}
                      </p>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                    <Filter className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Conversation Context */}
              {selectedGroup.context && selectedGroup.context.open_threads && 
                (selectedGroup.context.open_threads as any[]).length > 0 && (
                <div className="bg-accent/50 border-b border-border p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">Open Threads</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {(selectedGroup.context.open_threads as any[]).map((thread, idx) => (
                          <li key={idx}>• {thread}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedConversations.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No messages yet</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Send a message to start the conversation
                    </p>
                  </div>
                ) : (
                  <>
                    {selectedConversations.map((message) => {
                      const isInbound = message.direction === 'inbound';
                      
                      return (
                        <div
                          key={message.id}
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
                            <p className="text-sm whitespace-pre-wrap">
                              {message.message_body}
                            </p>
                            <div className={cn(
                              "flex items-center gap-1 mt-1",
                              isInbound ? "justify-start" : "justify-end"
                            )}>
                              <span className="text-xs opacity-70">
                                {formatMessageTime(message.timestamp || '')}
                              </span>
                              {!isInbound && (
                                <CheckCheck className="h-3 w-3 opacity-70" />
                              )}
                              {message.intent_classification && (
                                <span className="text-xs opacity-70 ml-2">
                                  [{message.intent_classification}]
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      messageInput.trim()
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">
                    AI is analyzing this conversation for context and suggested responses
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">Select a conversation</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Choose a tenant conversation from the list to view messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}