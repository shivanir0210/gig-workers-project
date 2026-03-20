import { useState, useRef, useEffect } from 'react';
import api from '../api';
import { Send, Bot, User, MessageCircle } from 'lucide-react';

const QUICK_QUESTIONS = [
  'How is my premium calculated?',
  'How are claims triggered?',
  'What does this policy cover?',
  'How do payouts work?',
  'What are the available plans?'
];

export default function Chatbot() {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Welcome to GigShield Support. I can assist you with questions about your coverage, premiums, claims, and payouts.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/chatbot/chat', { message: msg });
      setMessages(prev => [...prev, { role: 'bot', text: res.data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Unable to respond at this time. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col" style={{ height: 'calc(100vh - 0px)' }}>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">AI Assistant</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Policy support and guidance</p>
      </div>

      <div className="flex-1 card flex flex-col overflow-hidden" style={{ minHeight: 0, borderColor: 'rgba(59,130,246,0.2)' }}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: '1px solid #1F2937' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
            <Bot size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">GigShield Assistant</p>
            <p className="text-xs flex items-center gap-1" style={{ color: '#22C55E' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22C55E', boxShadow: '0 0 6px #22C55E' }}></span> Online
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'bot' && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                  <Bot size={13} className="text-white" />
                </div>
              )}
              <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white rounded-tr-sm'
                  : 'text-white rounded-tl-sm'
              }`}
              style={{
                background: msg.role === 'user' ? 'rgba(59,130,246,0.15)' : '#1F2937',
                border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.3)' : '#374151'}`
              }}>
                {msg.text}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: '#1F2937' }}>
                  <User size={13} style={{ color: '#9CA3AF' }} />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                <Bot size={13} className="text-white" />
              </div>
              <div className="px-4 py-3 rounded-xl rounded-tl-sm" style={{ background: '#1F2937' }}>
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: '#9CA3AF', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick Questions */}
        <div className="px-4 pt-3" style={{ borderTop: '1px solid #1F2937' }}>
          <p className="text-xs mb-2 font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>SUGGESTED</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_QUESTIONS.map(q => (
              <button key={q} onClick={() => send(q)}
                className="text-xs px-3 py-1.5 rounded-full transition font-medium"
                style={{ background: '#1F2937', color: '#9CA3AF', border: '1px solid #374151' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#E5E7EB'; e.currentTarget.style.borderColor = '#4B5563'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.borderColor = '#374151'; }}>
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask me anything..."
              className="flex-1 rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-all"
              style={{ background: '#0B1220', color: '#E5E7EB', border: '1px solid #1F2937' }}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#1F2937'} />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              className="btn-neon p-2.5 rounded-lg disabled:opacity-50 flex items-center justify-center flex-shrink-0">
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
