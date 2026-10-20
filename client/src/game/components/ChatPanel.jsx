import { useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PHRASES from '../../config/plazaPhrases.json';
import { chatText } from '../chatText';

/**
 * Plaza chat with fixed phrases and emojis only (no free text, so nothing to moderate and no off-site contacts).
 * Messages show as "[Username]: text" in the viewer's own language; the buttons rest for the server cooldown.
 */
export default function ChatPanel({ messages, onSay, cooldown, canSpeak, className = '' }) {
  const { t } = useTranslation();
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <section className={`cbg-chat ${className}`} aria-label={t('game.chat.title')}>
      <div ref={listRef} className="cbg-chat-list" aria-live="polite">
        {messages.length === 0 ? (
          <p className="text-white/45">{t('game.chat.empty')}</p>
        ) : messages.map((m) => (
          <p key={m.n} className="leading-snug">
            <span className="font-black" style={{ color: m.mine ? '#c6ff3d' : '#22d3ee' }}>[{m.u}]</span>
            <span className="text-white/90">: {chatText(t, m.k)}</span>
          </p>
        ))}
      </div>
      {canSpeak ? (
        <div className="cbg-chat-bar" role="group" aria-label={t('game.chat.say')}>
          <MessageCircle className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
          {PHRASES.phrases.map((k) => (
            <button key={k} type="button" className="cbg-chip" disabled={cooldown} onClick={() => onSay(k)}>{t(`game.chat.phrases.${k}`)}</button>
          ))}
          {Object.entries(PHRASES.emojis).map(([k, emoji]) => (
            <button key={k} type="button" className="cbg-chip cbg-chip--emoji" disabled={cooldown} onClick={() => onSay(k)} aria-label={t(`game.chat.emoji.${k}`)}>{emoji}</button>
          ))}
        </div>
      ) : (
        <p className="cbg-chat-bar text-white/55">{t('game.chat.hidden_note')}</p>
      )}
    </section>
  );
}
