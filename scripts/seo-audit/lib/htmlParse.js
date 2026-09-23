// Small, dependency-free HTML extractor. It is deliberately not a full parser: the audit only needs
// head tags, headings, images, links, JSON-LD and a visible-word count from the RAW html a crawler
// receives, and the repo has no HTML-parsing dependency to lean on.

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };

function decode(str) {
  if (!str) return '';
  return str
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function attrs(tag) {
  const out = {};
  const re = /([^\s=>/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const inner = tag.replace(/^<[a-z0-9-]+/i, '').replace(/\/?>$/, '');
  let m;
  while ((m = re.exec(inner))) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

function parseHtml(html) {
  const src = String(html || '').replace(/<!--[\s\S]*?-->/g, '');

  const titleMatch = src.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decode(titleMatch[1]).replace(/\s+/g, ' ').trim() : null;

  const metas = (src.match(/<meta\b[^>]*>/gi) || []).map(attrs);
  const metaContent = (key, value) => {
    const m = metas.find((x) => (x[key] || '').toLowerCase() === value);
    return m ? m.content ?? '' : null;
  };

  const links = (src.match(/<link\b[^>]*>/gi) || []).map(attrs);
  const canonical = links.find((l) => (l.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
  const hreflangs = links
    .filter((l) => (l.rel || '').toLowerCase() === 'alternate' && l.hreflang)
    .map((l) => ({ lang: l.hreflang, href: l.href }));

  const htmlTag = src.match(/<html\b[^>]*>/i);
  const lang = htmlTag ? attrs(htmlTag[0]).lang || null : null;

  const headings = { h1: [], h2: 0, h3: 0 };
  for (const m of src.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    if (m[1] === '1') headings.h1.push(decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
    else headings[`h${m[1]}`] += 1;
  }

  const images = (src.match(/<img\b[^>]*>/gi) || []).map((t) => {
    const a = attrs(t);
    return { src: a.src || a['data-src'] || '', alt: a.alt ?? null };
  });

  const anchors = [];
  for (const m of src.matchAll(/<a\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a.href) anchors.push({ href: a.href, rel: a.rel || '' });
  }

  const jsonLd = [];
  for (const m of src.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      jsonLd.push({ parsed: JSON.parse(m[1]), error: null });
    } catch (err) {
      jsonLd.push({ parsed: null, error: err.message });
    }
  }

  const text = decode(
    src
      .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title,
    description: metaContent('name', 'description'),
    robotsMeta: metaContent('name', 'robots'),
    viewport: metaContent('name', 'viewport'),
    og: {
      title: metaContent('property', 'og:title'),
      description: metaContent('property', 'og:description'),
      image: metaContent('property', 'og:image'),
      url: metaContent('property', 'og:url'),
    },
    twitterCard: metaContent('name', 'twitter:card'),
    canonical: canonical ? canonical.href || '' : null,
    hreflangs,
    lang,
    headings,
    images,
    anchors,
    jsonLd,
    wordCount: text ? text.split(' ').length : 0,
  };
}

/** Flattens JSON-LD payloads (arrays and @graph) into a list of typed nodes. */
function jsonLdNodes(jsonLd) {
  const nodes = [];
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(visit);
    if (n['@graph']) visit(n['@graph']);
    if (n['@type']) nodes.push(n);
  };
  jsonLd.forEach((j) => visit(j.parsed));
  return nodes;
}

const typesOf = (node) => [].concat(node['@type'] || []);

module.exports = { parseHtml, jsonLdNodes, typesOf, decode };
