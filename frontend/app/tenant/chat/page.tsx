'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Brain, Send, Paperclip, Plus, X, Loader2,
  MessageSquare, Trash2, ImageIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url: string | null;
  created_at: string;
  // Optimistic — not yet in DB
  pending?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix: "data:image/jpeg;base64,"
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TenantChatPage() {
  const supabase = createClient();

  // Auth
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [leaseId, setLeaseId] = useState<string | null>(null);
  const [initDone, setInitDone] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Input
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const user = await getCurrentUser();
      if (!user?.entityId) { setInitDone(true); return; }
      setTenantId(user.entityId);

      // Resolve lease_id from tenants table
      const { data: tenant } = await supabase
        .from('tenants')
        .select('lease_id')
        .eq('id', user.entityId)
        .maybeSingle();
      setLeaseId(tenant?.lease_id ?? null);

      // Load existing sessions
      await loadSessions(user.entityId);
      setInitDone(true);
    }
    init();
  }, []);

  const loadSessions = useCallback(async (tid: string) => {
    const { data } = await supabase
      .from('tenant_chat_sessions')
      .select('id, title, updated_at, created_at')
      .eq('tenant_id', tid)
      .order('updated_at', { ascending: false });
    setSessions((data as ChatSession[]) ?? []);
  }, [supabase]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Session management ────────────────────────────────────────────────────

  async function selectSession(id: string) {
    if (id === activeSessionId) return;
    setActiveSessionId(id);
    setLoadingMessages(true);
    const { data } = await supabase
      .from('tenant_chat_messages')
      .select('id, role, content, image_url, created_at')
      .eq('session_id', id)
      .order('created_at', { ascending: true });
    setMessages((data as ChatMessage[]) ?? []);
    setLoadingMessages(false);
  }

  async function startNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    clearImage();
    textareaRef.current?.focus();
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from('tenant_chat_sessions').delete().eq('id', id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
    }
  }

  // ── Image handling ────────────────────────────────────────────────────────

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5 MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  }

  async function uploadImageToStorage(file: File, tid: string): Promise<string | null> {
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `chat/${tid}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('property-images')
        .upload(path, file, { contentType: file.type });
      if (error) return null;
      const { data } = supabase.storage.from('property-images').getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage() {
    const text = input.trim();
    if (!text || !tenantId || sending) return;

    setSending(true);
    const capturedFile = imageFile;
    const capturedPreview = imagePreview;
    setInput('');
    clearImage();

    // Optimistic user bubble
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      role: 'user',
      content: text,
      image_url: capturedPreview,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      // Convert image to base64 if present
      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;
      let uploadedImageUrl: string | null = null;

      if (capturedFile) {
        [imageBase64, uploadedImageUrl] = await Promise.all([
          fileToBase64(capturedFile),
          uploadImageToStorage(capturedFile, tenantId),
        ]);
        imageMimeType = capturedFile.type;
      }

      // Call API
      const response = await fetch('/api/tenant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          tenantId,
          leaseId,
          message: text,
          imageBase64,
          imageMimeType,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to send message');

      const returnedSessionId: string = data.sessionId;

      // Update session list
      if (!activeSessionId) {
        setActiveSessionId(returnedSessionId);
        await loadSessions(tenantId);
      } else {
        setSessions(prev =>
          prev
            .map(s => s.id === returnedSessionId ? { ...s, updated_at: new Date().toISOString() } : s)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        );
      }

      // Replace optimistic message + add assistant reply
      const realUserMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        image_url: uploadedImageUrl,
        created_at: new Date().toISOString(),
      };
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        image_url: null,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev.filter(m => m.id !== optimisticId), realUserMsg, assistantMsg]);

    } catch (err: any) {
      // Remove optimistic on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      console.error('Chat error:', err);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (!initDone) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="flex h-full items-center justify-center text-center p-8">
        <div>
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">You must be logged in as a tenant to use this feature.</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Sessions sidebar ─────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 border-r border-border flex flex-col bg-card/40">
        {/* Header */}
        <div className="p-3 border-b border-border">
          <Button
            onClick={startNewChat}
            variant="outline"
            size="sm"
            className="w-full gap-2 justify-start"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center mt-6 px-3">
              No past conversations yet. Start by asking a question below.
            </p>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => selectSession(session.id)}
                onKeyDown={e => e.key === 'Enter' && selectSession(session.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors group flex items-start gap-2 cursor-pointer ${
                  activeSessionId === session.id
                    ? 'bg-primary/15 text-foreground'
                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 opacity-60" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate leading-snug">{session.title}</p>
                  <p className="text-[10px] opacity-50 mt-0.5">{formatDate(session.updated_at)}</p>
                </div>
                <button
                  onClick={e => deleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-destructive transition-opacity flex-shrink-0 mt-0.5"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Chat area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-shrink-0">
          <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">PropAI Property Manager</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">AI-powered · always available</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

          {/* Empty / welcome state */}
          {!activeSessionId && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto gap-4 pb-8">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Brain className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Your Property Manager</h2>
                <p className="text-sm text-muted-foreground">
                  Ask me anything about your tenancy. I have access to your lease, payment history, and maintenance requests.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full mt-2">
                {[
                  'How much longer do I have on my lease?',
                  'Why was my rent increased?',
                  'I have a noisy boiler — what should I do?',
                  'When is my next payment due?',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                    className="text-left text-sm px-4 py-2.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading messages */}
          {loadingMessages && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Message bubbles */}
          {!loadingMessages && messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                </div>
              )}

              {/* Bubble */}
              <div className={`max-w-[72%] space-y-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                {msg.image_url && (
                  <div className={`rounded-xl overflow-hidden border border-border ${msg.role === 'user' ? 'ml-auto' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={msg.image_url}
                      alt="Attached image"
                      className="max-w-[280px] max-h-[200px] object-cover"
                    />
                  </div>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card border border-border text-foreground rounded-bl-sm'
                  } ${msg.pending ? 'opacity-60' : ''}`}
                >
                  {msg.content}
                </div>
                <p className="text-[10px] text-muted-foreground px-1">
                  {msg.pending ? 'Sending…' : formatDate(msg.created_at)}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                <Brain className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input bar ────────────────────────────────────────────────────── */}
        <div className="border-t border-border p-3 flex-shrink-0">
          {/* Image preview */}
          {imagePreview && (
            <div className="mb-2 relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Preview"
                className="h-16 w-16 rounded-lg object-cover border border-border"
              />
              <button
                onClick={clearImage}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* Image upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-9 w-9 flex-shrink-0 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors mb-0.5"
              title="Attach image"
            >
              {imageFile ? (
                <ImageIcon className="h-4 w-4 text-primary" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageSelect}
            />

            {/* Textarea */}
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your property manager anything…"
              rows={1}
              className="flex-1 resize-none min-h-[38px] max-h-32 py-2 text-sm leading-snug"
              disabled={sending}
            />

            {/* Send button */}
            <Button
              onClick={sendMessage}
              disabled={(!input.trim() && !imageFile) || sending}
              size="sm"
              className="h-9 w-9 p-0 flex-shrink-0 mb-0.5"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Enter to send · Shift+Enter for new line · Max image size 5 MB
          </p>
        </div>
      </div>
    </div>
  );
}
