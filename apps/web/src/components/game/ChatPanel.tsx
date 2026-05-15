'use client';

import { useState, useRef, useEffect } from 'react';
import { SendIcon, ChatIcon, UsersIcon, ShieldIcon } from '../layout/Icons';

interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  timestamp: number;
  roomId?: string;
  type?: 'system' | 'chat';
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string, roomId?: string) => void;
  myId?: string;
}

export const ChatPanel = ({ messages, onSend, myId }: ChatPanelProps) => {
  const [input, setInput] = useState('');
  const [activeRoom, setActiveRoom] = useState<'all' | 'team'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim(), activeRoom === 'team' ? 'team' : undefined);
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/[0.02] border-l border-white/5 overflow-hidden">
      {/* Tabs */}
      <div className="flex p-1 bg-black/40 border-b border-white/5">
        <button
          onClick={() => setActiveRoom('all')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
            ${activeRoom === 'all' 
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20 shadow-lg shadow-purple-500/5' 
              : 'text-white/30 hover:text-white/60'
            }
          `}
        >
          <ChatIcon /> Public
        </button>
        <button
          onClick={() => setActiveRoom('team')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
            ${activeRoom === 'team' 
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5' 
              : 'text-white/30 hover:text-white/60'
            }
          `}
        >
          <UsersIcon /> Team
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
        {messages.filter(msg => activeRoom === 'all' ? !msg.roomId : msg.roomId === 'team').map((msg) => {
          const isMe = msg.userId === myId;
          const isSystem = msg.type === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex flex-col items-center gap-1 py-1 px-4 text-center">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white/40 uppercase tracking-tighter">
                  <ShieldIcon /> {msg.text}
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1`}
            >
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-tighter">
                  {isMe ? 'You' : msg.displayName}
                </span>
                <span className="text-[9px] text-white/10">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <div
                className={`
                  relative px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-xl max-w-[90%]
                  ${isMe 
                    ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-tr-none border border-white/10' 
                    : 'bg-white/5 text-white/80 rounded-tl-none border border-white/10'
                  }
                `}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-black/60 border-t border-white/5">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50 transition-all focus:bg-white/[0.05]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`
              absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all
              ${input.trim() 
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95' 
                : 'text-white/10 bg-white/5'
              }
            `}
          >
            <SendIcon />
          </button>
        </div>
        <p className="text-[9px] text-white/20 mt-2 text-center uppercase font-black tracking-widest">
          Press Enter to transmit
        </p>
      </div>
    </div>
  );
};