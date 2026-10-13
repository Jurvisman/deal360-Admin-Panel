/*
 * Blog editor text format <-> website block JSON.
 *
 * The editor is one text box. Each line is read like this:
 *   ## Heading            ### Subheading          > Quote
 *   - item / • item       1. item (numbered)       💡 Tip text
 *   ![alt](url "caption") [CTA: listing | app | demo | whatsapp]
 *   anything else         paragraph (lines joined until a blank line)
 * Inline: **bold** and [label](https://link) are kept as-is for the website.
 *
 * Pasted content goes through `smartParse` first, which also understands Google Docs / Word
 * HTML, plain text with short standalone headings, Q:/A: FAQ lines and the
 * "**[Heading]** / **[Paragraph]**" block-marker format with a metadata table.
 */

export const CATEGORIES = [
  { key: 'business-growth', label: 'Business Growth' },
  { key: 'gst-govt', label: 'GST & Govt Schemes' },
  { key: 'local-markets', label: 'Local Markets' },
  { key: 'free-tools', label: 'Free Tools' },
  { key: 'success-stories', label: 'Success Stories' },
  { key: 'deal360-guides', label: 'Deal360 Guides' },
  { key: 'festival', label: 'Festival Tips' },
];

export const CTA_VARIANTS = [
  { key: 'listing', label: 'Free listing' },
  { key: 'app', label: 'Download app' },
  { key: 'demo', label: 'Book demo' },
  { key: 'whatsapp', label: 'WhatsApp chat' },
];

const BULLET = /^(?:[-*•·▪●◦‣]|\u2022)\s+(.*)$/;
const NUMBERED = /^(\d{1,2})[.)]\s+(.*)$/;
const TIP = /^(?:💡|tip\s*:|ટીપ\s*:|ટિપ\s*:|टिप\s*:)\s*(.*)$/i;
const IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;
const CTA = /^\[cta(?:\s*:\s*([^\]]*))?\]$/i;
const QUESTION = /^(?:q\s*\d*|પ્રશ્ન|प्रश्न)\s*[:.)-]\s*(.*)$/i;
const ANSWER = /^(?:a\s*\d*|જવાબ|उत्तर)\s*[:.)-]\s*(.*)$/i;
const MARKER = /^\[(heading|subheading|paragraph|list[^\]]*|tip[^\]]*|quote|image|cta[^\]]*)\](?:\s*[→:-]+\s*(.*))?$/i;

const unbold = (text) => String(text || '').replace(/^\*\*(.+?)\*\*(.*)$/, '$1$2').trim();
const stripWrap = (text) => String(text || '').replace(/^[*_]+|[*_]+$/g, '').trim();

export const ctaVariant = (text) => {
  const value = String(text || '').toLowerCase();
  if (/whats\s*app|chat/.test(value)) return 'whatsapp';
  if (/demo/.test(value)) return 'demo';
  if (/download|app\b|install app/.test(value) && !/listing/.test(value)) return 'app';
  return 'listing';
};

// ── Strict: editor text -> blocks ──────────────────────────────────────────────

export const parseBody = (text) => {
  const blocks = [];
  let para = [];
  let list = null;
  let quote = [];

  const flush = () => {
    if (para.length) blocks.push({ type: 'paragraph', text: para.join(' ') });
    if (list) blocks.push(list);
    if (quote.length) blocks.push({ type: 'quote', text: quote.join(' ') });
    para = [];
    list = null;
    quote = [];
  };

  String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return flush();
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flush();
      blocks.push({ type: m[1].length <= 2 ? 'heading' : 'subheading', text: m[2].trim() });
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      if (para.length || list) flush();
      quote.push(m[1]);
    } else if ((m = TIP.exec(line))) {
      flush();
      blocks.push({ type: 'tip', text: m[1] });
    } else if ((m = IMAGE.exec(line))) {
      flush();
      blocks.push({ type: 'image', alt: m[1], url: m[2], caption: m[3] || '' });
    } else if ((m = CTA.exec(line))) {
      flush();
      blocks.push({ type: 'cta', variant: ctaVariant(m[1]) });
    } else if ((m = BULLET.exec(line)) || (m = NUMBERED.exec(line))) {
      const style = BULLET.test(line) ? 'bullet' : 'number';
      const item = BULLET.test(line) ? m[1] : m[2];
      if (!list || list.style !== style) {
        flush();
        list = { type: 'list', style, items: [] };
      }
      list.items.push(item);
    } else {
      if (list || quote.length) flush();
      para.push(line);
    }
  });
  flush();
  return blocks;
};

// ── Blocks -> editor text ──────────────────────────────────────────────────────

export const blocksToBody = (blocks) =>
  (blocks || [])
    .map((block) => {
      switch (block?.type) {
        case 'heading':
          return `## ${block.text}`;
        case 'subheading':
          return `### ${block.text}`;
        case 'list':
          return (block.items || []).map((item, i) => (block.style === 'number' ? `${i + 1}. ${item}` : `- ${item}`)).join('\n');
        case 'quote':
          return `> ${block.text}`;
        case 'tip':
          return `💡 ${block.text}`;
        case 'image':
          return `![${block.alt || ''}](${block.url}${block.caption ? ` "${block.caption}"` : ''})`;
        case 'cta':
          return `[CTA: ${block.variant || 'listing'}]`;
        case 'paragraph':
          return block.text;
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');

// ── FAQ text ("Q: … / A: …") ───────────────────────────────────────────────────

export const parseFaqText = (text) => {
  const faqs = [];
  let current = null;
  String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach((raw) => {
    const line = unbold(raw.trim());
    let m;
    if ((m = QUESTION.exec(line))) {
      current = { q: m[1].trim(), a: '' };
      faqs.push(current);
    } else if ((m = ANSWER.exec(line)) && current) {
      current.a = m[1].trim();
    } else if (line && current) {
      if (current.a) current.a = `${current.a} ${line}`;
      else current.q = `${current.q} ${line}`.trim();
    }
  });
  return faqs.filter((f) => f.q && f.a);
};

export const faqsToText = (faqs) => (faqs || []).map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');

// ── Smart paste ────────────────────────────────────────────────────────────────

const META_KEYS = [
  [/^title$/i, 'title'],
  [/slug/i, 'slug'],
  [/^category$/i, 'category'],
  [/^language$/i, 'language'],
  [/^tags?$/i, 'tags'],
  [/^featured$/i, 'featured'],
  [/seo\s*title|meta\s*title/i, 'metaTitle'],
  [/seo\s*description|meta\s*description/i, 'metaDescription'],
  [/short\s*intro|excerpt|intro/i, 'excerpt'],
];

const metaValue = (field, value) => {
  const clean = stripWrap(value.replace(/`/g, '').replace(/\\\|/g, '|'));
  if (field === 'category') {
    const lower = clean.toLowerCase();
    return CATEGORIES.find((c) => c.key === lower || c.label.toLowerCase() === lower || lower.includes(c.label.toLowerCase().split(' ')[0]))?.key;
  }
  if (field === 'language') {
    if (/ગુજ|guj/i.test(clean)) return 'gu';
    if (/हिं|hindi/i.test(clean)) return 'hi';
    if (/eng/i.test(clean)) return 'en';
    return undefined;
  }
  if (field === 'featured') return /✅|yes|હા|हाँ|true/i.test(clean);
  return clean;
};

const readMeta = (line, meta) => {
  // Table row "| **Title** | value |" or "Title: value".
  const row = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/.exec(line);
  const pair = row ? [row[1], row[2]] : /^\**([A-Za-z ]{3,24})\**\s*:\s*(.+)$/.exec(line)?.slice(1);
  if (!pair) return false;
  const key = stripWrap(pair[0]);
  const hit = META_KEYS.find(([re]) => re.test(key));
  if (!hit || /^-+$/.test(pair[1])) return Boolean(row);
  const value = metaValue(hit[1], pair[1]);
  if (value !== undefined && value !== '') meta[hit[1]] = value;
  return true;
};

const isHeadingGuess = (line, nextLine) =>
  line.length <= 80 &&
  !/[.!?।:,;]$/.test(line) &&
  !BULLET.test(line) &&
  Boolean(nextLine) &&
  !/^\d+$/.test(line);

/**
 * Turns pasted text into clean editor text.
 * Returns { body, faqs, meta, title } — `meta` holds post fields found in a metadata table.
 */
export const smartParse = (input, { guessHeadings = true } = {}) => {
  const lines = String(input || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const markerMode = lines.some((l) => MARKER.test(unbold(l)));
  const meta = {};
  const faqs = [];
  const out = [];
  let pending = null;
  let faq = null;
  let introNext = false;
  let title = '';

  const chunkEnd = (i) => {
    // Index of the next non-empty line after the current chunk (for heading guesses).
    let j = i + 1;
    while (j < lines.length && lines[j]) j += 1;
    while (j < lines.length && !lines[j]) j += 1;
    return lines[j];
  };

  lines.forEach((raw, i) => {
    const line = raw;
    const plain = unbold(line);
    let m;

    if (!line) {
      out.push('');
      if (pending && pending.used) pending = null;
      if (faq && faq.a) faq = null;
      return;
    }
    if (/^-{3,}$|^_{3,}$|^\*{3,}$/.test(line)) return;

    if ((m = QUESTION.exec(plain))) {
      faq = { q: m[1].trim(), a: '' };
      faqs.push(faq);
      return;
    }
    if ((m = ANSWER.exec(plain)) && faq) {
      faq.a = m[1].trim();
      return;
    }
    if (faq && !pending) {
      if (faq.a) faq.a = `${faq.a} ${plain}`;
      else faq.q = `${faq.q} ${plain}`;
      return;
    }

    if (/^\**\s*short\s*intro\s*:?\s*\**$/i.test(line)) {
      introNext = true;
      return;
    }
    if (introNext) {
      meta.excerpt = line.replace(/^>\s?/, '');
      introNext = false;
      return;
    }
    if (line.startsWith('|') && readMeta(line, meta)) return;

    if ((m = MARKER.exec(plain))) {
      const kind = m[1].toLowerCase();
      if (kind.startsWith('cta')) {
        out.push(`[CTA: ${ctaVariant(m[2])}]`, '');
        pending = null;
      } else {
        out.push('');
        pending = { kind, used: false };
      }
      return;
    }

    if (markerMode) {
      if (!pending) {
        // Outside a block marker: only metadata lines matter (titles, notes and tips for the editor are dropped).
        readMeta(line, meta);
        return;
      }
      const { kind } = pending;
      pending.used = true;
      if (kind === 'heading' || kind === 'subheading') {
        out.push(`${kind === 'heading' ? '##' : '###'} ${stripWrap(line.replace(/^#+\s*/, ''))}`);
        pending = null;
      } else if (kind.startsWith('list')) {
        const item = (BULLET.exec(line) || NUMBERED.exec(line))?.pop() ?? line;
        out.push(/number/.test(kind) ? `1. ${item}` : `- ${item}`);
      } else if (kind.startsWith('tip')) {
        out.push(`💡 ${line.replace(TIP, '$1')}`);
        pending = null;
      } else if (kind === 'quote') {
        out.push(`> ${line.replace(/^>\s?/, '')}`);
      } else if (kind === 'image') {
        out.push(IMAGE.test(line) ? line : `![](${line})`);
        pending = null;
      } else {
        out.push(line);
      }
      return;
    }

    // Free text (Google Docs, ChatGPT, WhatsApp, plain typing).
    if (/^#\s+/.test(line) && !title && out.every((l) => !l)) {
      title = line.replace(/^#\s+/, '');
      return;
    }
    if (/^#{1,6}\s+/.test(line) || /^>/.test(line) || TIP.test(line) || IMAGE.test(line) || CTA.test(line)) {
      out.push(line.replace(/^#\s+/, '## '));
      return;
    }
    if ((m = BULLET.exec(line))) {
      out.push(`- ${m[1]}`);
      return;
    }
    const prevBlank = i === 0 || !lines[i - 1];
    const nextBlank = i === lines.length - 1 || !lines[i + 1];
    if ((m = NUMBERED.exec(line))) {
      const prevNum = !prevBlank && NUMBERED.test(lines[i - 1]);
      const nextNum = !nextBlank && NUMBERED.test(lines[i + 1]);
      // A lone "1. Something short" line between paragraphs is a numbered section heading.
      if (guessHeadings && !prevNum && !nextNum && isHeadingGuess(stripWrap(line), chunkEnd(i))) {
        out.push(`## ${stripWrap(line)}`);
      } else {
        out.push(`${m[1]}. ${m[2]}`);
      }
      return;
    }
    if (prevBlank && nextBlank) {
      const whole = /^\*\*(.+)\*\*$/.exec(line);
      if (whole && whole[1].length <= 100) {
        out.push(`## ${whole[1]}`);
        return;
      }
      // First short standalone line of plain text is usually the article title.
      if (guessHeadings && !title && out.every((l) => !l) && isHeadingGuess(line, chunkEnd(i))) {
        title = line;
        return;
      }
      if (guessHeadings && i > 0 && isHeadingGuess(line, chunkEnd(i))) {
        out.push(`## ${line}`);
        return;
      }
    }
    out.push(line);
  });

  const body = blocksToBody(parseBody(out.join('\n')));
  return { body, faqs: faqs.filter((f) => f.q && f.a), meta, title: title || meta.title || '' };
};

// ── HTML (Google Docs / Word / web page) -> editor text ────────────────────────

const isBoldStyle = (el) => {
  const weight = el.style?.fontWeight;
  if (weight === 'normal' || weight === '400') return false;
  return /^(b|strong)$/i.test(el.tagName) || weight === 'bold' || Number(weight) >= 600;
};

const inlineText = (node) => {
  if (node.nodeType === 3) return node.textContent.replace(/\s+/g, ' ');
  if (node.nodeType !== 1) return '';
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return '\n';
  const inner = Array.from(node.childNodes).map(inlineText).join('');
  if (tag === 'a' && node.getAttribute('href') && /^https?:|^\//.test(node.getAttribute('href'))) {
    return inner.trim() ? `[${inner.trim()}](${node.getAttribute('href')})` : '';
  }
  if (isBoldStyle(node) && inner.trim()) {
    const lead = inner.match(/^\s*/)[0];
    const tail = inner.match(/\s*$/)[0];
    return `${lead}**${inner.trim()}**${tail}`;
  }
  return inner;
};

export const htmlToBody = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,meta,title,head').forEach((el) => el.remove());
  const out = [];
  const walk = (node) => {
    if (node.nodeType === 3) {
      if (node.textContent.trim()) out.push(node.textContent.trim(), '');
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    const text = () => inlineText(node).replace(/\*\*\s*\*\*/g, '').trim();
    if (/^h[1-6]$/.test(tag)) {
      const value = stripWrap(text());
      if (value) out.push(`${tag === 'h1' ? '#' : Number(tag[1]) <= 2 ? '##' : '###'} ${value}`, '');
    } else if (tag === 'ul' || tag === 'ol') {
      Array.from(node.children).forEach((li, i) => {
        const value = inlineText(li).trim();
        if (value) out.push(tag === 'ol' ? `${i + 1}. ${value}` : `- ${value}`);
      });
      out.push('');
    } else if (tag === 'blockquote') {
      out.push(`> ${text()}`, '');
    } else if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (/^https?:/.test(src)) out.push(`![${node.getAttribute('alt') || ''}](${src})`, '');
    } else if (tag === 'p' || tag === 'li' || tag === 'td' || tag === 'th') {
      const imgs = node.querySelectorAll('img');
      const value = text();
      if (value) out.push(...value.split('\n').map((l) => l.trim()), '');
      imgs.forEach(walk);
    } else if (tag === 'table') {
      node.querySelectorAll('tr').forEach((tr) => {
        const cells = Array.from(tr.children).map((c) => inlineText(c).trim()).filter(Boolean);
        if (cells.length) out.push(`| ${cells.join(' | ')} |`);
      });
      out.push('');
    } else {
      Array.from(node.childNodes).forEach(walk);
    }
  };
  Array.from(doc.body.childNodes).forEach(walk);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

// ── Stats ──────────────────────────────────────────────────────────────────────

export const wordCount = (blocks) =>
  blocks.reduce((sum, b) => {
    const text = [b.text, ...(b.items || [])].filter(Boolean).join(' ').trim();
    return sum + (text ? text.split(/\s+/).length : 0);
  }, 0);
