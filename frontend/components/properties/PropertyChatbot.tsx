'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Sparkles } from 'lucide-react';
import type { UnitWithAttributes } from './MapView';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  message: string;
  propertyIds?: string[] | null;
}

interface PropertyChatbotProps {
  units: UnitWithAttributes[];
  filteredCount: number;
  onFilterToIds: (ids: string[] | null) => void;
  onResetFilters: () => void;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hi! I can help you find the perfect property. Tell me what you're looking for — budget, location, number of bedrooms, pets, parking, anything you need.",
};

export default function PropertyChatbot({
  units,
  filteredCount,
  onFilterToIds,
  onResetFilters,
}: PropertyChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.filter(m => m.role === 'user' || m.role === 'assistant'),
          properties: units,
        }),
      });

      const data: ClaudeResponse = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message || 'Sorry, I could not process that. Please try again.',
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (data.propertyIds !== undefined) {
        onFilterToIds(data.propertyIds ?? null);
        if (data.propertyIds !== null) {
          setHasAppliedFilters(true);
        }
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    onResetFilters();
    onFilterToIds(null);
    setHasAppliedFilters(false);
    setMessages([WELCOME_MESSAGE]);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Applied filters pill — shown above the button when filters are active */}
      {hasAppliedFilters && !isOpen && (
        <div className="fixed bottom-[5.5rem] right-6 z-[600] flex items-center gap-2 bg-indigo-600/90 backdrop-blur-sm border border-indigo-400/30 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
          <Sparkles className="w-3 h-3" />
          <span>AI filters active — {filteredCount} result{filteredCount !== 1 ? 's' : ''}</span>
          <button
            onClick={handleReset}
            className="ml-1 text-white/70 hover:text-white transition-colors"
            aria-label="Clear AI filters"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-[5.5rem] right-6 z-[600] flex flex-col w-[360px] h-[500px] bg-[#0d0d18] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium leading-none">Property Assistant</p>
                <p className="text-white/30 text-[10px] mt-0.5">Powered by Claude</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasAppliedFilters && (
                <button
                  onClick={handleReset}
                  className="text-white/40 hover:text-white/70 text-xs transition-colors border border-white/10 rounded-md px-2 py-1"
                >
                  Reset
                </button>
              )}
              <button
                onClick={handleClose}
                className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-white/[0.06] text-white/85 border border-white/[0.07] rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="bg-white/[0.06] border border-white/[0.07] rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Applied filters badge inside chat */}
            {hasAppliedFilters && !isLoading && (
              <div className="flex justify-center">
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-300/70 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{filteredCount} propert{filteredCount !== 1 ? 'ies' : 'y'} match your search</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-white/10 px-3 py-3 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 2 bed flat under £1,500 in Athens…"
                disabled={isLoading}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                aria-label="Send message"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`fixed bottom-6 right-6 z-[600] w-13 h-13 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 ${
          isOpen
            ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
        }`}
        style={{ width: '52px', height: '52px' }}
        aria-label={isOpen ? 'Close property assistant' : 'Open property assistant'}
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageSquare className="w-5 h-5" />
        )}
        {!isOpen && hasAppliedFilters && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0d0d18]" />
        )}
      </button>
    </>
  );
}
