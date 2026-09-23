// Tiny HTML helpers for the server-rendered content shell. Everything that reaches the page goes
// through esc(): listing titles/descriptions are user-written text and must never become markup.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;

/** Plain text (possibly multi-line, user-written) -> escaped <p> blocks, capped at `max` characters. */
function paragraphs(text, max = 1500) {
  const clean = String(text ?? '').replace(/\r/g, '').trim();
  if (!clean) return '';
  const capped = clean.length > max ? `${clean.slice(0, max).replace(/\s+\S*$/, '')}…` : clean;
  return capped
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
}

const list = (items, cls = '') => (items.length ? `<ul${cls ? ` class="${cls}"` : ''}>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '');

const section = (heading, inner) => (inner ? `<section><h2>${esc(heading)}</h2>${inner}</section>` : '');

/** Visible words in an HTML fragment (tags dropped), the same notion the SEO audit uses. */
function wordCount(html) {
  const text = String(html || '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
}

module.exports = { esc, link, paragraphs, list, section, wordCount };
