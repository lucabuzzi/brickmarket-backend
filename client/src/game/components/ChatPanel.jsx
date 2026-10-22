import { useEffect, useRef, useState } from 'react';
import { Keyboard, Loader2, MessageCircle, Send, Smile } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PHRASES from '../../config/plazaPhrases.json';
import { chatText } from '../chatText';
import { canSend, refusalMessage } from '../../lib/game/chatInput';

/**
 * Plaza chat. Messages show as "[Username]: text" (fixed phrases in the viewer's own language). When the admin has
 * switched typed messages on (`chat.freeText`), the bar is a text box, and the fixed phrases and emojis are one tap
 * away; otherwise only the phrases, as before. Typed messages are moderated by the server before anyone sees them: a
 * refused one shows here, to its author only, with the reason. The buttons rest for the server cooldown.
 */
export default function ChatPanel({ messages, onSay, onSend, chat, sending, cooldown, canSpeak, className = '' }) {
  const { t, i18n } = useTranslation();
  const listRef = useRef(null);
  const [text, setText] = useState('');
  const [phrases, setPhrases] = useState(false); // typed chat on: show the phrase chips instead of the text box
  const typing = Boolean(chat?.freeText) && !phrases;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = (e) => {
    e.preventDefault();
    if (!canSend(text, chat) || sending || cooldown) return;
    if (onSend(text.trim())) setText('');
  };

  const line = (m) => {
    if (m.refused) {
      const r = refusalMessage(m.refused, i18n.language);
      return (
        <p key={m.n} className="leading-snug text-amber-300" role="status">
          {t(r.key, r.vars)}{r.muted ? ` ${t('game.chat.refused.now_muted', r.muted)}` : ''}
        </p>
      );
    }
    return (
      <p key={m.n} className="break-words leading-snug">
        <span className="font-black" style={{ color: m.mine ? '#c6ff3d' : '#22d3ee' }}>[{m.u}]</span>
        <span className="text-white/90">: {m.x != null ? m.x : chatText(t, m.k)}</span>
      </p>
    );
  };

  const chips = (
    <>
      {PHRASES.phrases.map((k) => (
        <button key={k} type="button" className="cbg-chip" disabled={cooldown} onClick={() => onSay(k)}>{t(`game.chat.phrases.${k}`)}</button>
      ))}
      {Object.entries(PHRASES.emojis).map(([k, emoji]) => (
        <button key={k} type="button" className="cbg-chip cbg-chip--emoji" disabled={cooldown} onClick={() => onSay(k)} aria-label={t(`game.chat.emoji.${k}`)}>{emoji}</button>
      ))}
    </>
  );

  let bar;
  if (!canSpeak) {
    bar = <p className="cbg-chat-bar text-white/55">{t('game.chat.hidden_note')}</p>;
  } else if (typing) {
    const left = (chat.maxLength || 0) - text.trim().length;
    bar = (
      <form className="cbg-chat-bar cbg-chat-form" onSubmit={submit}>
        <button type="button" className="cbg-chip cbg-chip--emoji" onClick={() => setPhrases(true)} aria-label={t('game.chat.show_phrases')} title={t('game.chat.show_phrases')}>
          <Smile className="h-4 w-4" aria-hidden />
        </button>
        <input
          className="cbg-chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={chat.maxLength}
          placeholder={t('game.chat.placeholder')}
          aria-label={t('game.chat.placeholder')}
          enterKeyHint="send"
          autoComplete="off"
        />
        {left < 20 ? <span className={`shrink-0 text-[10px] tabular-nums ${left < 0 ? 'text-amber-300' : 'text-white/45'}`} aria-live="polite">{left}</span> : null}
        <button type="submit" className="cbg-chip cbg-chip--emoji" disabled={!canSend(text, chat) || sending || cooldown} aria-label={t('game.chat.send')} title={t('game.chat.send')}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        </button>
      </form>
    );
  } else {
    bar = (
      <div className="cbg-chat-bar" role="group" aria-label={t('game.chat.say')}>
        {chat?.freeText ? (
          <button type="button" className="cbg-chip cbg-chip--emoji" onClick={() => setPhrases(false)} aria-label={t('game.chat.show_keyboard')} title={t('game.chat.show_keyboard')}>
            <Keyboard className="h-4 w-4" aria-hidden />
          </button>
        ) : <MessageCircle className="h-4 w-4 shrink-0 text-white/40" aria-hidden />}
        {chips}
      </div>
    );
  }

  return (
    <section className={`cbg-chat ${className}`} aria-label={t('game.chat.title')}>
      <div ref={listRef} className="cbg-chat-list" aria-live="polite">
        {messages.length === 0 ? (
          <p className="text-white/45">{t(chat?.freeText ? 'game.chat.empty_typed' : 'game.chat.empty')}</p>
        ) : messages.map(line)}
      </div>
      {bar}
    </section>
  );
}
