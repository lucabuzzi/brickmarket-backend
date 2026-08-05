import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import {
  HelpCircle, Mail, ScrollText, ArrowRight,
  Bot, Send, User, Sparkles,
} from 'lucide-react';

function QuickLinkCard({ icon, title, desc, cta, to, href, color }) {
  const content = (
    <>
      <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-xs text-stone-400 mt-1 leading-relaxed">{desc}</p>
        <span className="inline-flex items-center gap-1 mt-3 text-xs font-black uppercase tracking-wider text-gold-400 group-hover:text-gold-300 transition-colors">
          {cta} <ArrowRight size={12} />
        </span>
      </div>
    </>
  );

  const className = 'group flex items-start gap-4 rounded-2xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10 p-5 transition-all duration-300';

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}

function ChatMessage({ role, text }) {
  const isUser = role === 'user';
  return (
    <div className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-gold-500/20 text-gold-400' : 'bg-pink-500/20 text-pink-400'}`}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
          isUser
            ? 'bg-gold-500 text-white font-medium rounded-tr-sm'
            : 'bg-white/5 border border-white/5 text-stone-200 rounded-tl-sm'
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function ChatWidget() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([{ role: 'bot', text: t('help.chat_greeting') }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const data = await apiFetch('/api/support/chat', {
        method: 'POST',
        body: {
          message: trimmed,
          history: nextMessages.slice(-6),
        },
      });
      setMessages((prev) => [...prev, { role: 'bot', text: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'bot', text: t('help.chat_error') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bento-card p-5 lg:p-8 flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-8 w-8 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
          <Sparkles size={15} />
        </div>
        <h2 className="text-lg font-black text-white uppercase tracking-tight font-mono">{t('help.chat_title')}</h2>
      </div>
      <p className="text-xs text-stone-400 mb-5">{t('help.chat_subtitle')}</p>

      <div
        ref={scrollRef}
        className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-black/20 p-4 h-80 overflow-y-auto"
      >
        {messages.map((m, i) => (
          <ChatMessage key={i} role={m.role} text={m.text} />
        ))}
        {loading && (
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 bg-pink-500/20 text-pink-400">
              <Bot size={13} />
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs text-stone-400">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse [animation-delay:0.15s]">●</span>
                <span className="animate-pulse [animation-delay:0.3s]">●</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('help.chat_placeholder')}
          maxLength={500}
          disabled={loading}
          className="flex-1 min-w-0 px-4 py-2.5 text-sm rounded-xl border border-white/10 bg-[#14120b]/50 text-white outline-none focus:border-pink-500 transition-all backdrop-blur-md font-medium placeholder:text-stone-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 disabled:opacity-40 disabled:hover:bg-pink-500 text-white font-black text-xs uppercase tracking-wider active-shrink transition-all duration-200 shrink-0"
        >
          <Send size={14} /> <span className="hidden sm:inline">{t('help.chat_send')}</span>
        </button>
      </form>
      <p className="text-[10px] text-stone-500 mt-2.5">{t('help.chat_disclaimer')}</p>
    </section>
  );
}

export default function Help() {
  const { t } = useTranslation();

  return (
    <div className="page help max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-16">
      <div className="bento-card p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-pink-400 mb-2">
            <HelpCircle size={12} /> {t('nav.help')}
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white leading-tight uppercase tracking-tight">
            {t('help.title')}
          </h1>
          <p className="text-stone-400 text-sm mt-1 max-w-xl">{t('help.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <QuickLinkCard
          icon={<HelpCircle size={18} />}
          title={t('help.faq_card_title')}
          desc={t('help.faq_card_desc')}
          cta={t('help.faq_card_cta')}
          to="/faq"
          color="text-gold-400 bg-gold-500/10 border-gold-500/20"
        />
        <QuickLinkCard
          icon={<Mail size={18} />}
          title={t('help.email_card_title')}
          desc={t('help.email_card_desc')}
          cta={t('help.email_card_cta')}
          href="mailto:support@brickmarket.com"
          color="text-gold-400 bg-gold-500/10 border-gold-500/20"
        />
        <QuickLinkCard
          icon={<ScrollText size={18} />}
          title={t('help.legal_card_title')}
          desc={t('help.legal_card_desc')}
          cta={t('help.legal_card_cta')}
          to="/norme-legali"
          color="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        />
      </div>

      <ChatWidget />
    </div>
  );
}
