import { CATEGORIES } from './blogMarkdown';

// Mirrors the website article page (deal360-website src/components/blog/*) closely enough to judge
// layout and wording before publishing. CTA copy matches the website's BlogCta.

const CTA_COPY = {
  en: {
    listing: ['Bring your shop to Deal360', 'Free listing, leads from nearby buyers and online payments in one app.', 'Start free'],
    app: ['Get daily leads from nearby buyers', 'Thousands of local businesses grow with the Deal360 app.', 'Download app'],
    demo: ['Want to see how Deal360 works?', 'Book a free 15-minute demo with our team.', 'Book free demo'],
    whatsapp: ['Have a question?', 'Talk to the Deal360 team on WhatsApp.', 'Chat on WhatsApp'],
  },
  gu: {
    listing: ['તમારી દુકાન Deal360 પર લાવો', 'ફ્રી લિસ્ટિંગ, નજીકના ગ્રાહકોની લીડ્સ અને ઓનલાઇન પેમેન્ટ, એક જ એપમાં.', 'ફ્રીમાં શરૂ કરો'],
    app: ['રોજ નજીકના ગ્રાહકોની લીડ્સ મેળવો', 'હજારો લોકલ બિઝનેસ Deal360 એપથી આગળ વધી રહ્યા છે.', 'એપ ડાઉનલોડ કરો'],
    demo: ['Deal360 કેવી રીતે કામ કરે છે તે જોવું છે?', 'અમારી ટીમ સાથે 15 મિનિટનો ફ્રી ડેમો બુક કરો.', 'ફ્રી ડેમો બુક કરો'],
    whatsapp: ['કોઈ સવાલ છે?', 'Deal360 ટીમ સાથે WhatsApp પર વાત કરો.', 'WhatsApp પર વાત કરો'],
  },
};

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

const inline = (text) => {
  const value = String(text || '');
  const parts = [];
  let last = 0;
  let match;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(value))) {
    if (match.index > last) parts.push(value.slice(last, match.index));
    const href = /^(https?:\/\/|\/|mailto:|tel:)/i.test(match[3] || '') ? match[3] : null;
    parts.push(
      match[1] ? (
        <strong key={match.index}>{match[1]}</strong>
      ) : href ? (
        <a key={match.index} href={href} target="_blank" rel="noreferrer">{match[2]}</a>
      ) : (
        match[2]
      )
    );
    last = match.index + match[0].length;
  }
  if (last < value.length) parts.push(value.slice(last));
  return parts;
};

const Cta = ({ variant, language, card = false }) => {
  const [title, text, button] = (CTA_COPY[language] || CTA_COPY.en)[variant] || CTA_COPY.en.listing;
  return (
    <div className={`bp-cta ${card ? 'bp-cta-card' : ''}`}>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <span className="bp-cta-btn">{button} →</span>
    </div>
  );
};

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

function BlogPreview({ form, blocks, faqs, imageSrc, readMinutes, device = 'desktop' }) {
  const language = form.language || 'en';
  const gu = language === 'gu';
  const headings = blocks.filter((b) => b.type === 'heading');
  const hasCta = blocks.some((b) => b.type === 'cta');
  const category = CATEGORIES.find((c) => c.key === form.category)?.label || 'Blog';

  return (
    <div className={`bp-frame bp-${device}`}>
      <div className="bp-url">thedeal360.com/blog/{form.slug || 'url-slug'}</div>
      <article className="bp-article" lang={language}>
        <div className="bp-crumb">Blog › {category}</div>
        <h1>{form.title || (gu ? 'અહીં લેખનું શીર્ષક દેખાશે' : 'Your post title appears here')}</h1>
        <div className="bp-byline">
          <span className="bp-avatar">{(form.authorName || 'D').trim().charAt(0)}</span>
          {form.authorName || 'Team Deal360'} · {formatDate(form.publishedAt)} · {readMinutes} min read
        </div>
        <div className="bp-layout">
          <div className="bp-main">
            {form.coverImageUrl ? <img className="bp-cover" src={imageSrc(form.coverImageUrl)} alt="" /> : null}
            {form.excerpt ? <p className="bp-lead">{form.excerpt}</p> : null}
            {blocks.length === 0 ? (
              <div className="bp-empty">{gu ? 'Content લખો અથવા paste કરો, preview અહીં દેખાશે.' : 'Write or paste content to see the preview.'}</div>
            ) : null}
            {blocks.map((block, i) => {
              switch (block.type) {
                case 'heading':
                  return <h2 key={i}>{block.text}</h2>;
                case 'subheading':
                  return <h3 key={i}>{block.text}</h3>;
                case 'list': {
                  const List = block.style === 'number' ? 'ol' : 'ul';
                  return <List key={i}>{block.items.map((item, j) => <li key={j}>{inline(item)}</li>)}</List>;
                }
                case 'quote':
                  return <blockquote key={i}>{inline(block.text)}</blockquote>;
                case 'tip':
                  return <div key={i} className="bp-tip">💡 <span>{inline(block.text)}</span></div>;
                case 'image':
                  return (
                    <figure key={i}>
                      <img src={imageSrc(block.url)} alt={block.alt || ''} />
                      {block.caption ? <figcaption>{block.caption}</figcaption> : null}
                    </figure>
                  );
                case 'cta':
                  return <Cta key={i} variant={block.variant} language={language} />;
                default:
                  return <p key={i}>{inline(block.text)}</p>;
              }
            })}
            {blocks.length > 0 && !hasCta ? <Cta variant="listing" language={language} /> : null}
            {faqs.length ? (
              <section className="bp-faq">
                <h2>{gu ? 'વારંવાર પૂછાતા પ્રશ્નો' : 'Frequently asked questions'}</h2>
                {faqs.map((f, i) => (
                  <details key={i} open={i === 0}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </section>
            ) : null}
          </div>
          <aside className="bp-side">
            {headings.length > 1 ? (
              <div className="bp-toc">
                <strong>{gu ? 'આ લેખમાં' : 'In this article'}</strong>
                <ol>{headings.map((h, i) => <li key={i}>{h.text}</li>)}</ol>
              </div>
            ) : null}
            <Cta variant="app" language={language} card />
          </aside>
        </div>
      </article>
    </div>
  );
}

export default BlogPreview;
