import PHRASES from '../config/plazaPhrases.json';

/** The text of a plaza chat message key: a translated phrase, or the emoji itself. */
export function chatText(t, k) {
  if (PHRASES.emojis[k]) return PHRASES.emojis[k];
  return t(`game.chat.phrases.${k}`);
}
