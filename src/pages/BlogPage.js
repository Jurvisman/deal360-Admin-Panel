import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner, ConfirmDialog, DataTable, TableRowActionMenu } from '../components';
import {
  createBlogPost,
  deleteBlogPost,
  fetchBlogPost,
  fetchBlogPosts,
  publishBlogPost,
  unpublishBlogPost,
  updateBlogPost,
  uploadBlogImage,
} from '../services/adminApi';
import { API_ORIGIN, WEBSITE_BASE_URL } from '../config/runtime';
import { usePermissions } from '../shared/permissions';
import BlogPreview from './blog/BlogPreview';
import {
  CATEGORIES,
  CTA_VARIANTS,
  blocksToBody,
  faqsToText,
  htmlToBody,
  parseBody,
  parseFaqText,
  smartParse,
  wordCount,
} from './blog/blogMarkdown';

const LANGUAGES = [
  { key: 'gu', label: 'ગુજરાતી' },
  { key: 'en', label: 'English' },
  { key: 'hi', label: 'हिंदी' },
];

const STATUS_FILTERS = ['All', 'Live', 'Scheduled', 'Draft'];
const META_TITLE_MAX = 60;
const META_DESCRIPTION_MAX = 160;
const WEBSITE_HOST = WEBSITE_BASE_URL.replace(/^https?:\/\//, '');

const BODY_PLACEHOLDER = `Paste your full article here: from Google Docs, Word, ChatGPT or WhatsApp.
Headings, lists, tips, CTAs and Q:/A: FAQs are picked up automatically.

Or type using:
## Heading
### Smaller heading
- list item
1. numbered item
💡 Tip shown in a green box
> Quote
[CTA: app]
**bold** and [link text](https://...)`;

const FAQ_PLACEHOLDER = `Q: How much is the GST registration fee?
A: Registration on the government portal is free.

Q: Next question?
A: Answer`;

const unwrap = (response, fallback) => response?.data ?? response ?? fallback;

const parseArray = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const emptyForm = () => ({
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  coverImageUrl: '',
  category: 'business-growth',
  language: 'gu',
  authorName: 'Team Deal360',
  tags: '',
  featured: false,
  publishedAt: '',
  metaTitle: '',
  metaDescription: '',
  status: 'DRAFT',
  body: '',
  faqText: '',
});

const toForm = (post) => ({
  id: post.id,
  title: post.title || '',
  slug: post.slug || '',
  excerpt: post.excerpt || '',
  coverImageUrl: post.coverImageUrl || '',
  category: post.category || 'business-growth',
  language: post.language || 'en',
  authorName: post.authorName || '',
  tags: post.tags || '',
  featured: Boolean(post.featured),
  // <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm".
  publishedAt: post.publishedAt ? String(post.publishedAt).slice(0, 16) : '',
  metaTitle: post.metaTitle || '',
  metaDescription: post.metaDescription || '',
  status: post.status || 'DRAFT',
  body: blocksToBody(parseArray(post.contentJson)),
  faqText: faqsToText(parseArray(post.faqJson)),
});

const toPayload = (form) => ({
  title: form.title,
  slug: form.slug,
  excerpt: form.excerpt,
  coverImageUrl: form.coverImageUrl,
  category: form.category,
  language: form.language,
  authorName: form.authorName,
  tags: form.tags,
  featured: form.featured,
  publishedAt: form.publishedAt ? `${form.publishedAt}:00` : null,
  metaTitle: form.metaTitle,
  metaDescription: form.metaDescription,
  contentJson: JSON.stringify(parseBody(form.body)),
  faqJson: JSON.stringify(parseFaqText(form.faqText)),
});

const imageSrc = (url) => (!url || /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`);

const postState = (post) => {
  if (post.status !== 'PUBLISHED') return { label: 'Draft', pill: 'pending' };
  if (post.publishedAt && new Date(post.publishedAt) > new Date()) return { label: 'Scheduled', pill: 'pending-review' };
  return { label: 'Live', pill: 'approved' };
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const categoryLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || key;

const PlusIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

function BlogPage({ token }) {
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('ADMIN_BLOG_UPDATE');
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [openActionRowId, setOpenActionRowId] = useState(null);
  const [form, setForm] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [message, setMessage] = useState({ type: 'info', text: '' });
  const [view, setView] = useState('split');
  const [device, setDevice] = useState('desktop');
  const [smartPaste, setSmartPaste] = useState(true);
  const [pasteNote, setPasteNote] = useState(null);
  const bodyRef = useRef(null);

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = unwrap(await fetchBlogPosts(token), []);
      setPosts(Array.isArray(list) ? list : []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to load blog posts.' });
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const isDirty = form ? JSON.stringify(form) !== savedSnapshot : false;

  // Live parse of the editor text for preview, stats and saving.
  const blocks = useMemo(() => (form ? parseBody(form.body) : []), [form]);
  const faqs = useMemo(() => (form ? parseFaqText(form.faqText) : []), [form]);
  const words = useMemo(() => wordCount(blocks), [blocks]);
  const readMinutes = Math.max(1, Math.ceil(words / 200));

  const openEditor = (next) => {
    setForm(next);
    setSavedSnapshot(JSON.stringify(next));
    setPasteNote(null);
    setMessage({ type: 'info', text: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openPost = async (id) => {
    try {
      openEditor(toForm(unwrap(await fetchBlogPost(token, id), {})));
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to open post.' });
    }
  };

  const closeEditor = () => {
    if (isDirty) {
      setConfirm({
        title: 'Discard unsaved changes?',
        message: 'Your latest edits to this post are not saved yet.',
        label: 'Discard',
        run: () => setForm(null),
      });
      return;
    }
    setForm(null);
  };

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // ── Editor text helpers ────────────────────────────────────────────────────

  const replaceSelection = (transform) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const { text, cursor } = transform(value.slice(start, end), value, start, end);
    const next = value.slice(0, start) + text + value.slice(end);
    setField('body', next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + (cursor ?? text.length);
      el.setSelectionRange(pos, pos);
    });
  };

  const wrap = (before, after, placeholder) =>
    replaceSelection((selected) => {
      const inner = selected || placeholder;
      return { text: `${before}${inner}${after}`, cursor: before.length + inner.length + after.length };
    });

  // Puts `prefix` at the start of every selected line (or the current line).
  const prefixLines = (prefix) => {
    const el = bodyRef.current;
    if (!el) return;
    const { value, selectionStart, selectionEnd } = el;
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const lineEndIdx = value.indexOf('\n', selectionEnd);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const strip = (l) => l.replace(/^(#{1,6}\s+|>\s?|[-*•]\s+|\d+[.)]\s+|💡\s*)/, '');
    const replaced = lines.map((l, i) => {
      const p = typeof prefix === 'function' ? prefix(i) : prefix;
      return `${p}${strip(l)}`;
    }).join('\n');
    setField('body', value.slice(0, lineStart) + replaced + value.slice(lineEnd));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart + replaced.length, lineStart + replaced.length);
    });
  };

  const insertBlock = (text) =>
    replaceSelection((_, value, start) => {
      const before = start > 0 && value[start - 1] !== '\n' ? '\n\n' : start > 1 && value[start - 2] !== '\n' ? '\n' : '';
      return { text: `${before}${text}\n\n` };
    });

  const upload = async (file, key, onDone) => {
    if (!file) return;
    setUploadingKey(key);
    try {
      onDone(unwrap(await uploadBlogImage(token, file), ''));
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Image upload failed.' });
    } finally {
      setUploadingKey('');
    }
  };

  const handlePaste = (event) => {
    if (!smartPaste || !canUpdate) return;
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    const source = html && /<(p|h[1-6]|li|div|table|br)\b/i.test(html) ? htmlToBody(html) : text;
    // Short pastes (a word, a sentence) go in untouched.
    if (!source || !/\n/.test(source.trim())) return;
    event.preventDefault();

    const result = smartParse(source, { guessHeadings: !html });
    const previous = form;
    const el = bodyRef.current;
    const start = el ? el.selectionStart : form.body.length;
    const end = el ? el.selectionEnd : form.body.length;
    const sep = (s) => (s && !s.endsWith('\n\n') ? (s.endsWith('\n') ? '\n' : '\n\n') : '');
    const head = form.body.slice(0, start);
    const nextBody = `${head}${sep(head)}${result.body}\n\n${form.body.slice(end)}`.replace(/\n{3,}/g, '\n\n').trim();

    const filled = [];
    const next = { ...form, body: nextBody };
    const fill = (field, value, label) => {
      if (value === undefined || value === '' || (next[field] && next[field] !== emptyForm()[field])) return;
      next[field] = value;
      filled.push(label);
    };
    fill('title', result.title, 'title');
    fill('slug', result.meta.slug, 'slug');
    fill('excerpt', result.meta.excerpt, 'intro');
    fill('tags', result.meta.tags, 'tags');
    fill('metaTitle', result.meta.metaTitle, 'SEO title');
    fill('metaDescription', result.meta.metaDescription, 'SEO description');
    if (result.meta.category && next.category === emptyForm().category && !form.id) {
      next.category = result.meta.category;
      filled.push('category');
    }
    if (result.meta.language && !form.id) {
      next.language = result.meta.language;
      filled.push('language');
    }
    if (result.meta.featured !== undefined && !form.id) next.featured = result.meta.featured;
    if (result.faqs.length) {
      next.faqText = [form.faqText.trim(), faqsToText(result.faqs)].filter(Boolean).join('\n\n');
    }
    setForm(next);

    const found = parseBody(result.body);
    const count = (type) => found.filter((b) => b.type === type).length;
    setPasteNote({
      previous,
      text: [
        `${found.length} blocks formatted`,
        count('heading') ? `${count('heading')} headings` : null,
        count('list') ? `${count('list')} lists` : null,
        count('cta') ? `${count('cta')} CTA` : null,
        result.faqs.length ? `${result.faqs.length} FAQs moved to the FAQ box` : null,
        filled.length ? `filled ${filled.join(', ')}` : null,
      ].filter(Boolean).join(' · '),
    });
  };

  // ── Save / publish ─────────────────────────────────────────────────────────

  const save = async () => {
    if (!form.title.trim()) {
      setMessage({ type: 'error', text: 'Add a title first.' });
      return null;
    }
    setIsSaving(true);
    try {
      const payload = toPayload(form);
      const saved = unwrap(form.id ? await updateBlogPost(token, form.id, payload) : await createBlogPost(token, payload), null);
      const next = toForm(saved);
      setForm(next);
      setSavedSnapshot(JSON.stringify(next));
      return saved;
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to save post.' });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const saveDraft = async () => {
    const saved = await save();
    if (saved) {
      setMessage({ type: 'success', text: saved.status === 'PUBLISHED' ? 'Changes saved and live.' : 'Draft saved.' });
      loadPosts();
    }
  };

  const publish = async () => {
    const saved = await save();
    if (!saved) return;
    setIsSaving(true);
    try {
      const published = unwrap(await publishBlogPost(token, saved.id), saved);
      const next = toForm(published);
      setForm(next);
      setSavedSnapshot(JSON.stringify(next));
      const scheduled = published.publishedAt && new Date(published.publishedAt) > new Date();
      setMessage({
        type: 'success',
        text: scheduled
          ? `Scheduled for ${formatDate(published.publishedAt)}.`
          : 'Published. The website rebuilds in a few minutes so Google sees the new page.',
      });
      loadPosts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to publish.' });
    } finally {
      setIsSaving(false);
    }
  };

  const unpublish = async () => {
    setIsSaving(true);
    try {
      const next = toForm(unwrap(await unpublishBlogPost(token, form.id), {}));
      setForm(next);
      setSavedSnapshot(JSON.stringify(next));
      setMessage({ type: 'success', text: 'Moved back to draft. It is no longer on the website.' });
      loadPosts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to unpublish.' });
    } finally {
      setIsSaving(false);
    }
  };

  const askDelete = (id, title) =>
    setConfirm({
      title: 'Delete this post?',
      message: `"${title}" is removed from the website and can't be recovered.`,
      label: 'Delete',
      run: async () => {
        try {
          await deleteBlogPost(token, id);
          if (form?.id === id) setForm(null);
          setMessage({ type: 'success', text: 'Post deleted.' });
          loadPosts();
        } catch (error) {
          setMessage({ type: 'error', text: error.message || 'Failed to delete post.' });
        }
      },
    });

  // Ctrl/Cmd + S saves while editing.
  useEffect(() => {
    if (!form || !canUpdate) return undefined;
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!isSaving) saveDraft();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── List view ──────────────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const c = { All: posts.length, Live: 0, Scheduled: 0, Draft: 0 };
    posts.forEach((p) => { c[postState(p).label] += 1; });
    return c;
  }, [posts]);

  const tableRows = useMemo(
    () =>
      posts
        .filter((p) => statusFilter === 'All' || postState(p).label === statusFilter)
        .map((p) => ({ ...p, categoryName: categoryLabel(p.category), stateLabel: postState(p).label })),
    [posts, statusFilter]
  );

  const columns = [
    {
      key: 'title',
      header: 'Post',
      sortable: true,
      render: (_, post) => (
        <div className="blog-row-title">
          {post.coverImageUrl ? <img src={imageSrc(post.coverImageUrl)} alt="" /> : <span className="blog-row-thumb">✎</span>}
          <div>
            <strong>{post.featured ? '★ ' : ''}{post.title}</strong>
            <small>/blog/{post.slug}</small>
          </div>
        </div>
      ),
    },
    { key: 'categoryName', header: 'Category', sortable: true },
    {
      key: 'language',
      header: 'Language',
      render: (value) => LANGUAGES.find((l) => l.key === value)?.label || value,
    },
    {
      key: 'stateLabel',
      header: 'Status',
      sortable: true,
      render: (_, post) => {
        const s = postState(post);
        return <span className={`status-pill ${s.pill}`}>{s.label}</span>;
      },
    },
    { key: 'readMinutes', header: 'Read', render: (value) => `${value || 1} min` },
    { key: 'updatedAt', header: 'Updated', sortable: true, render: (value) => formatDate(value) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, post) => {
        const actions = [{ label: canUpdate ? 'Edit' : 'View', onClick: () => openPost(post.id) }];
        if (postState(post).label === 'Live') {
          actions.push({ label: 'Open on website', onClick: () => window.open(`${WEBSITE_BASE_URL}/blog/${post.slug}`, '_blank', 'noopener') });
        }
        if (canUpdate) actions.push({ label: 'Delete', danger: true, onClick: () => askDelete(post.id, post.title) });
        return (
          <div className="table-actions" onClick={(e) => e.stopPropagation()}>
            <TableRowActionMenu rowId={post.id} openRowId={openActionRowId} onToggle={setOpenActionRowId} actions={actions} />
          </div>
        );
      },
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  const state = form?.id ? postState(form) : null;
  const scheduledPick = form?.publishedAt && new Date(form.publishedAt) > new Date();
  const googleTitle = (form?.metaTitle || form?.title || 'Post title').trim();
  const googleDescription = (form?.metaDescription || form?.excerpt || 'Short description of the post shown in Google results.').trim();

  return (
    <div className="blog-admin-page users-page">
      <Banner message={message} />

      {!form ? (
        <div className="panel card users-table-card">
          <DataTable
            columns={columns}
            data={tableRows}
            isLoading={isLoading}
            searchPlaceholder="Search posts..."
            onRowClick={(post) => openPost(post.id)}
            emptyTitle={posts.length ? 'No posts in this filter' : 'No blog posts yet'}
            emptyDescription={posts.length ? 'Try another status.' : 'Click + to write the first article for the website blog.'}
            toolbarLeft={
              <div className="blog-filter">
                {STATUS_FILTERS.map((s) => (
                  <button key={s} type="button" className={statusFilter === s ? 'active' : ''} onClick={() => setStatusFilter(s)}>
                    {s} <span>{counts[s]}</span>
                  </button>
                ))}
              </div>
            }
            toolbarRight={
              canUpdate ? (
                <button type="button" className="gsc-create-btn" onClick={() => openEditor(emptyForm())} title="New blog post" aria-label="New blog post">
                  {PlusIcon}
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          <div className="blog-topbar blog-panel">
            <button type="button" className="blog-btn ghost" onClick={closeEditor} title="Back to all posts">← Posts</button>
            <span className="blog-topbar-divider" />
            <div className="blog-topbar-title">
              <strong>{form.title || (form.id ? 'Untitled post' : 'New post')}</strong>
              <span>
                {state ? <span className={`status-pill ${state.pill}`}>{state.label}</span> : null}
                {isDirty ? <em>Unsaved changes</em> : form.id ? <em>Saved</em> : null}
              </span>
            </div>
            <div className="blog-topbar-actions">
              {state?.label === 'Live' ? (
                <a className="blog-btn" href={`${WEBSITE_BASE_URL}/blog/${form.slug}`} target="_blank" rel="noreferrer">View live ↗</a>
              ) : null}
              {canUpdate ? (
                <>
                  {form.id ? (
                    <button type="button" className="blog-btn danger" onClick={() => askDelete(form.id, form.title)} disabled={isSaving}>Delete</button>
                  ) : null}
                  {form.status === 'PUBLISHED' ? (
                    <button type="button" className="blog-btn" onClick={unpublish} disabled={isSaving}>Unpublish</button>
                  ) : null}
                  <button type="button" className="blog-btn" onClick={saveDraft} disabled={isSaving} title="Ctrl + S">
                    {isSaving ? 'Saving...' : form.status === 'PUBLISHED' ? 'Save changes' : 'Save draft'}
                  </button>
                  {form.status !== 'PUBLISHED' ? (
                    <button type="button" className="blog-btn primary" onClick={publish} disabled={isSaving}>
                      {scheduledPick ? 'Schedule' : 'Publish'}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <div className="blog-two-col">
            <section className="blog-panel">
              <h3 className="blog-card-title">Post details</h3>
              <label className="blog-field">
                <span>Title</span>
                <input className="blog-input-title" value={form.title} disabled={!canUpdate} placeholder="Diwali 2026: 10 ways to double footfall" onChange={(e) => setField('title', e.target.value)} />
              </label>
              <label className="blog-field">
                <span>URL slug <small>English letters only · empty = built from title</small></span>
                <div className="blog-slug">
                  <em>{WEBSITE_HOST}/blog/</em>
                  <input value={form.slug} disabled={!canUpdate} placeholder="diwali-offer-ideas" onChange={(e) => setField('slug', e.target.value)} />
                </div>
              </label>
              <label className="blog-field">
                <span>Short intro <small>shown on cards and under the title</small></span>
                <textarea rows={2} value={form.excerpt} disabled={!canUpdate} maxLength={500} onChange={(e) => setField('excerpt', e.target.value)} />
              </label>
              <div className="blog-field">
                <span>Cover image <small>1200 × 630 works best for WhatsApp and Google</small></span>
                <div className="blog-cover-row">
                  {form.coverImageUrl ? <img src={imageSrc(form.coverImageUrl)} alt="" /> : <div className="blog-cover-empty">No cover</div>}
                  <div className="blog-cover-actions">
                    <label className="blog-btn sm blog-upload">
                      {uploadingKey === 'cover' ? 'Uploading…' : form.coverImageUrl ? 'Replace' : 'Upload cover'}
                      <input type="file" accept="image/*" hidden disabled={!canUpdate} onChange={(e) => upload(e.target.files?.[0], 'cover', (url) => setField('coverImageUrl', url))} />
                    </label>
                    {form.coverImageUrl ? (
                      <button type="button" className="blog-btn sm" disabled={!canUpdate} onClick={() => setField('coverImageUrl', '')}>Remove</button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="blog-panel">
              <h3 className="blog-card-title">Settings</h3>
              <label className="blog-field">
                <span>Category</span>
                <select value={form.category} disabled={!canUpdate} onChange={(e) => setField('category', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </label>
              <div className="blog-field">
                <span>Language</span>
                <div className="blog-segment">
                  {LANGUAGES.map((l) => (
                    <button key={l.key} type="button" disabled={!canUpdate} className={form.language === l.key ? 'active' : ''} onClick={() => setField('language', l.key)}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="blog-field-row">
                <label className="blog-field">
                  <span>Author</span>
                  <input value={form.authorName} disabled={!canUpdate} onChange={(e) => setField('authorName', e.target.value)} />
                </label>
                <label className="blog-field">
                  <span>Publish time <small>empty = now</small></span>
                  <input type="datetime-local" value={form.publishedAt} disabled={!canUpdate} onChange={(e) => setField('publishedAt', e.target.value)} />
                </label>
              </div>
              <label className="blog-field">
                <span>Tags <small>comma separated</small></span>
                <input value={form.tags} disabled={!canUpdate} placeholder="gst, registration, msme" onChange={(e) => setField('tags', e.target.value)} />
              </label>
              <label className="blog-check">
                <input type="checkbox" checked={form.featured} disabled={!canUpdate} onChange={(e) => setField('featured', e.target.checked)} />
                <span>Feature at the top of the blog</span>
              </label>
            </section>
          </div>

          <section className="blog-panel blog-content-card">
            <div className="blog-content-head">
              <div>
                <h3 className="blog-card-title">Content</h3>
                <p className="blog-muted">{words} words · {readMinutes} min read · {blocks.length} blocks</p>
              </div>
              <div className="blog-content-controls">
                <label className="blog-check compact" title="Formats pasted articles into headings, lists, tips and FAQs">
                  <input type="checkbox" checked={smartPaste} onChange={(e) => setSmartPaste(e.target.checked)} />
                  <span>Smart paste</span>
                </label>
                <div className="blog-segment small">
                  {[['write', 'Write'], ['split', 'Split'], ['preview', 'Preview']].map(([key, label]) => (
                    <button key={key} type="button" className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            {canUpdate && view !== 'preview' ? (
              <div className="blog-toolbar-row">
                <button type="button" onClick={() => prefixLines('## ')} title="Heading">H2</button>
                <button type="button" onClick={() => prefixLines('### ')} title="Smaller heading">H3</button>
                <button type="button" onClick={() => wrap('**', '**', 'bold text')} title="Bold"><b>B</b></button>
                <button type="button" onClick={() => wrap('[', '](https://)', 'link text')} title="Link">Link</button>
                <span className="blog-toolbar-sep" />
                <button type="button" onClick={() => prefixLines('- ')} title="Bullet list">• List</button>
                <button type="button" onClick={() => prefixLines((i) => `${i + 1}. `)} title="Numbered list">1. List</button>
                <button type="button" onClick={() => prefixLines('> ')} title="Quote">❝ Quote</button>
                <button type="button" onClick={() => prefixLines('💡 ')} title="Tip box">💡 Tip</button>
                <label className="blog-toolbar-upload" title="Upload image">
                  {uploadingKey === 'inline' ? 'Uploading…' : '🖼 Image'}
                  <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], 'inline', (url) => insertBlock(`![](${url})`))} />
                </label>
                <span className="blog-toolbar-sep" />
                <select value="" onChange={(e) => { if (e.target.value) insertBlock(`[CTA: ${e.target.value}]`); }} title="Insert CTA">
                  <option value="">+ CTA block</option>
                  {CTA_VARIANTS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                </select>
              </div>
            ) : null}

            {pasteNote ? (
              <div className="blog-paste-note">
                <span>✨ {pasteNote.text}</span>
                <button type="button" onClick={() => { setForm(pasteNote.previous); setPasteNote(null); }}>Undo</button>
                <button type="button" onClick={() => setPasteNote(null)} aria-label="Dismiss">✕</button>
              </div>
            ) : null}

            <div className={`blog-editor blog-editor-${view}`}>
              {view !== 'preview' ? (
                <textarea
                  ref={bodyRef}
                  className="blog-body"
                  value={form.body}
                  disabled={!canUpdate}
                  placeholder={BODY_PLACEHOLDER}
                  onPaste={handlePaste}
                  onChange={(e) => setField('body', e.target.value)}
                  spellCheck={false}
                />
              ) : null}
              {view !== 'write' ? (
                <div className="blog-preview-pane">
                  <div className="blog-preview-head">
                    <span>Preview</span>
                    <div className="blog-segment small">
                      {[['desktop', 'Desktop'], ['mobile', 'Mobile']].map(([key, label]) => (
                        <button key={key} type="button" className={device === key ? 'active' : ''} onClick={() => setDevice(key)}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="blog-preview-scroll">
                    <BlogPreview form={form} blocks={blocks} faqs={faqs} imageSrc={imageSrc} readMinutes={readMinutes} device={device} />
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <div className="blog-two-col">
            <section className="blog-panel">
              <div className="blog-content-head">
                <div>
                  <h3 className="blog-card-title">FAQ</h3>
                  <p className="blog-muted">Google can show these right in search results. {faqs.length} question{faqs.length === 1 ? '' : 's'}.</p>
                </div>
              </div>
              <textarea className="blog-faq-box" rows={9} value={form.faqText} disabled={!canUpdate} placeholder={FAQ_PLACEHOLDER} onChange={(e) => setField('faqText', e.target.value)} />
            </section>

            <section className="blog-panel">
              <h3 className="blog-card-title">Google preview</h3>
              <div className="blog-google">
                <span className="blog-google-url">{WEBSITE_HOST} › blog › {form.slug || 'url-slug'}</span>
                <span className="blog-google-title">{googleTitle.length > META_TITLE_MAX ? `${googleTitle.slice(0, META_TITLE_MAX)}…` : googleTitle} | Deal360</span>
                <span className="blog-google-desc">{googleDescription.length > META_DESCRIPTION_MAX ? `${googleDescription.slice(0, META_DESCRIPTION_MAX)}…` : googleDescription}</span>
              </div>
              <label className="blog-field">
                <span>SEO title <small className={form.metaTitle.length > META_TITLE_MAX ? 'blog-over' : ''}>{form.metaTitle.length}/{META_TITLE_MAX}</small></span>
                <input value={form.metaTitle} disabled={!canUpdate} placeholder="Defaults to the post title" onChange={(e) => setField('metaTitle', e.target.value)} />
              </label>
              <label className="blog-field">
                <span>SEO description <small className={form.metaDescription.length > META_DESCRIPTION_MAX ? 'blog-over' : ''}>{form.metaDescription.length}/{META_DESCRIPTION_MAX}</small></span>
                <textarea rows={3} value={form.metaDescription} disabled={!canUpdate} placeholder="Defaults to the short intro" onChange={(e) => setField('metaDescription', e.target.value)} />
              </label>
            </section>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        variant="danger"
        onConfirm={() => { const run = confirm?.run; setConfirm(null); run?.(); }}
        onCancel={() => setConfirm(null)}
      />

      <style>{`
        .blog-admin-page { --blog-r: 8px; }
        .blog-admin-page input, .blog-admin-page select, .blog-admin-page textarea { border: 1px solid var(--line); border-radius: var(--blog-r); padding: 7px 10px; width: 100%; outline: none; background: #fff; color: var(--ink); font-size: 13px; line-height: 1.5; box-sizing: border-box; }
        .blog-admin-page input, .blog-admin-page select { height: 34px; }
        .blog-admin-page textarea { resize: vertical; }
        .blog-admin-page input:focus, .blog-admin-page select:focus, .blog-admin-page textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99, 69, 237, 0.1); }
        .blog-admin-page input[type='checkbox'] { width: 14px; height: 14px; box-shadow: none; accent-color: var(--accent); }

        .blog-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 30px; padding: 0 12px; border-radius: var(--blog-r); border: 1px solid var(--line); background: #fff; color: var(--ink); font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; text-decoration: none; transition: background 0.15s, border-color 0.15s; }
        .blog-btn:hover { background: #f8f7ff; border-color: #d8d2fb; }
        .blog-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .blog-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
        .blog-btn.primary:hover { filter: brightness(0.95); }
        .blog-btn.danger { color: #dc2626; }
        .blog-btn.danger:hover { background: #fef2f2; border-color: #fecaca; }
        .blog-btn.ghost { border-color: transparent; background: none; color: var(--muted); padding: 0 8px; }
        .blog-btn.ghost:hover { color: var(--accent); background: #f8f7ff; }
        .blog-btn.sm { height: 28px; padding: 0 10px; font-size: 12px; }

        .blog-filter { display: flex; gap: 4px; flex-wrap: wrap; }
        .blog-filter button { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 4px 11px; font-size: 12px; font-weight: 600; color: var(--ink); cursor: pointer; }
        .blog-filter button span { margin-left: 3px; color: var(--muted); font-weight: 500; }
        .blog-filter button.active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .blog-filter button.active span { color: rgba(255, 255, 255, 0.8); }
        .blog-row-title { display: flex; align-items: center; gap: 10px; min-width: 240px; }
        .blog-row-title img, .blog-row-thumb { width: 56px; height: 30px; border-radius: 5px; object-fit: cover; border: 1px solid var(--line); flex: 0 0 auto; }
        .blog-row-thumb { display: inline-flex; align-items: center; justify-content: center; background: rgba(99, 69, 237, 0.08); color: var(--accent); font-size: 12px; }
        .blog-row-title strong { display: block; font-size: 13px; }
        .blog-row-title small { display: block; color: var(--muted); font-size: 11.5px; }

        .blog-panel { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
        .blog-topbar { display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 6px; margin-bottom: 12px; position: sticky; top: 8px; z-index: 5; }
        .blog-topbar-divider { width: 1px; height: 20px; background: var(--line); }
        .blog-topbar-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
        .blog-topbar-title strong { font-size: 14px; font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .blog-topbar-title > span { display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto; }
        .blog-topbar-title .status-pill { font-size: 11px; padding: 2px 8px; }
        .blog-topbar-title em { font-style: normal; font-size: 11.5px; color: var(--muted); }
        .blog-topbar-actions { display: flex; gap: 6px; align-items: center; }

        .blog-two-col { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 12px; margin-bottom: 12px; align-items: start; }
        .blog-card-title { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--ink); }
        .blog-muted { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
        .blog-field { display: grid; gap: 5px; font-size: 12px; font-weight: 600; color: #475569; margin-top: 12px; }
        .blog-field small { font-weight: 400; color: #94a3b8; margin-left: 4px; font-size: 11px; }
        .blog-field small.blog-over { color: #dc2626; font-weight: 600; }
        .blog-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .blog-admin-page .blog-input-title { font-size: 14px; font-weight: 600; }
        .blog-slug { display: flex; align-items: center; border: 1px solid var(--line); border-radius: var(--blog-r); overflow: hidden; background: #f8fafc; }
        .blog-slug:focus-within { border-color: var(--accent); }
        .blog-slug em { font-style: normal; font-weight: 400; color: #94a3b8; padding: 0 2px 0 10px; white-space: nowrap; font-size: 12.5px; }
        .blog-admin-page .blog-slug input { border: none; border-radius: 0; box-shadow: none; padding-left: 0; background: #fff; }
        .blog-cover-row { display: flex; gap: 10px; align-items: center; }
        .blog-cover-row img, .blog-cover-empty { width: 132px; aspect-ratio: 1200 / 630; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); }
        .blog-cover-empty { display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; font-weight: 400; background: #fbfafc; border-style: dashed; }
        .blog-cover-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .blog-upload { cursor: pointer; }
        .blog-check { display: flex; align-items: center; gap: 7px; margin-top: 12px; font-size: 12.5px; font-weight: 500; color: var(--ink); cursor: pointer; }
        .blog-check.compact { margin: 0; font-size: 12px; color: #475569; }
        .blog-segment { display: flex; gap: 0; border: 1px solid var(--line); border-radius: var(--blog-r); overflow: hidden; background: #fff; }
        .blog-segment button { flex: 1; border: none; border-right: 1px solid var(--line); background: none; padding: 0 10px; height: 32px; cursor: pointer; font-size: 12.5px; font-weight: 600; color: #475569; white-space: nowrap; }
        .blog-segment button:last-child { border-right: none; }
        .blog-segment button.active { background: rgba(99, 69, 237, 0.1); color: var(--accent); }
        .blog-segment.small button { height: 26px; font-size: 11.5px; padding: 0 10px; }

        .blog-content-card { margin-bottom: 12px; }
        .blog-content-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .blog-content-controls { display: flex; align-items: center; gap: 12px; }
        .blog-toolbar-row { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; margin-top: 10px; padding: 3px; border: 1px solid var(--line); border-radius: var(--blog-r); background: #f8fafc; }
        .blog-toolbar-row button, .blog-toolbar-upload { border: 1px solid transparent; background: none; border-radius: 6px; height: 26px; padding: 0 8px; font-size: 12px; font-weight: 500; color: #334155; cursor: pointer; display: inline-flex; align-items: center; }
        .blog-toolbar-row button:hover, .blog-toolbar-upload:hover { background: #fff; border-color: var(--line); }
        .blog-admin-page .blog-toolbar-row select { width: auto; height: 26px; padding: 0 8px; font-size: 12px; font-weight: 600; color: var(--accent); border-color: rgba(99, 69, 237, 0.3); margin-left: auto; }
        .blog-toolbar-sep { width: 1px; height: 16px; background: var(--line); margin: 0 3px; }
        .blog-paste-note { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 6px 8px 6px 10px; border-radius: var(--blog-r); background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 12px; font-weight: 500; }
        .blog-paste-note span { flex: 1; }
        .blog-paste-note button { border: 1px solid #bbf7d0; background: #fff; color: #166534; border-radius: 6px; height: 24px; padding: 0 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .blog-editor { display: grid; gap: 12px; margin-top: 8px; }
        .blog-editor-split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        .blog-admin-page .blog-body { min-height: 600px; font-size: 13px; line-height: 1.75; font-family: ui-monospace, 'Cascadia Code', Consolas, 'Noto Sans Gujarati', monospace; background: #fcfcfe; padding: 12px 14px; }
        .blog-editor-write .blog-body { min-height: 680px; }
        .blog-preview-pane { border: 1px solid var(--line); border-radius: var(--blog-r); background: #f4f5f9; display: flex; flex-direction: column; min-height: 600px; max-height: 780px; }
        .blog-preview-head { display: flex; justify-content: space-between; align-items: center; padding: 5px 8px 5px 12px; border-bottom: 1px solid var(--line); background: #fff; border-radius: var(--blog-r) var(--blog-r) 0 0; }
        .blog-preview-head > span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; }
        .blog-preview-scroll { overflow: auto; padding: 12px; flex: 1; }
        .blog-admin-page .blog-faq-box { margin-top: 10px; }
        .blog-google { display: grid; gap: 2px; padding: 10px 12px; border-radius: var(--blog-r); background: #f8fafc; border: 1px solid var(--line); margin-top: 10px; }
        .blog-google-url { font-size: 11.5px; color: #4d5156; }
        .blog-google-title { font-size: 15px; color: #1a0dab; line-height: 1.3; }
        .blog-google-desc { font-size: 12px; color: #4d5156; line-height: 1.45; }

        .bp-frame { margin: 0 auto; background: #fbfcff; border-radius: 12px; box-shadow: 0 6px 24px rgba(20, 24, 58, 0.08); overflow: hidden; color: #30364b; font-family: 'Plus Jakarta Sans', 'Noto Sans Gujarati', system-ui, sans-serif; }
        .bp-desktop { max-width: 980px; }
        .bp-mobile { max-width: 390px; }
        .bp-url { font-size: 11px; color: #94a3b8; padding: 8px 14px; background: #fff; border-bottom: 1px solid #eef0f5; }
        .bp-article { padding: 20px 22px 28px; }
        .bp-crumb { font-size: 12px; color: #667085; margin-bottom: 8px; }
        .bp-article h1 { margin: 0; font-size: 28px; line-height: 1.25; font-weight: 800; color: #090b1a; }
        .bp-mobile .bp-article h1 { font-size: 22px; }
        .bp-byline { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #667085; margin: 12px 0 18px; }
        .bp-avatar { width: 26px; height: 26px; border-radius: 50%; background: #f2efff; color: #5b3df5; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
        .bp-layout { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 24px; align-items: start; }
        .bp-mobile .bp-layout { grid-template-columns: 1fr; }
        .bp-cover { width: 100%; border-radius: 12px; display: block; margin-bottom: 14px; }
        .bp-lead { font-size: 16px; line-height: 1.7; margin: 0 0 6px; }
        .bp-main { font-size: 15px; line-height: 1.8; }
        .bp-main h2 { font-size: 20px; line-height: 1.3; color: #090b1a; margin: 26px 0 8px; }
        .bp-main h3 { font-size: 17px; color: #090b1a; margin: 20px 0 6px; }
        .bp-main p { margin: 0 0 12px; }
        .bp-main a { color: #5b3df5; font-weight: 600; }
        .bp-main ul, .bp-main ol { margin: 0 0 14px; padding-left: 20px; }
        .bp-main li { margin-bottom: 4px; }
        .bp-main blockquote { margin: 18px 0; padding: 2px 0 2px 14px; border-left: 4px solid #5b3df5; color: #090b1a; font-size: 17px; }
        .bp-main figure { margin: 18px 0; }
        .bp-main figure img { width: 100%; border-radius: 10px; display: block; }
        .bp-main figcaption { font-size: 12px; color: #667085; text-align: center; margin-top: 6px; }
        .bp-tip { display: flex; gap: 8px; background: #ecfdf5; border: 1px solid #bbf7d0; color: #166534; border-radius: 12px; padding: 10px 12px; margin: 0 0 14px; font-size: 14px; line-height: 1.65; }
        .bp-empty { border: 1px dashed #d8dbe6; border-radius: 12px; padding: 30px; text-align: center; color: #94a3b8; font-size: 14px; }
        .bp-cta { display: flex; align-items: center; gap: 12px; border: 1px solid #dcd5ff; background: #f2efff; border-radius: 14px; padding: 12px 14px; margin: 20px 0; }
        .bp-cta > div { flex: 1; min-width: 0; }
        .bp-cta strong { display: block; color: #321f9f; font-size: 14px; line-height: 1.35; }
        .bp-cta p { margin: 2px 0 0 !important; color: #321f9f; font-size: 12px; line-height: 1.5; opacity: 0.85; }
        .bp-cta-btn { background: #5b3df5; color: #fff; border-radius: 8px; padding: 7px 12px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .bp-mobile .bp-cta { flex-wrap: wrap; }
        .bp-mobile .bp-cta-btn { width: 100%; text-align: center; }
        .bp-cta-card { flex-direction: column; align-items: stretch; margin: 0; }
        .bp-cta-card .bp-cta-btn { text-align: center; }
        .bp-side { display: grid; gap: 12px; }
        .bp-toc { border: 1px solid #e5e7ef; background: #fff; border-radius: 12px; padding: 12px 14px; font-size: 12px; }
        .bp-toc strong { display: block; color: #090b1a; margin-bottom: 6px; font-size: 13px; }
        .bp-toc ol { margin: 0; padding-left: 16px; color: #667085; line-height: 1.6; }
        .bp-faq { margin-top: 24px; }
        .bp-faq details { border: 1px solid #e5e7ef; background: #fff; border-radius: 10px; margin-bottom: 8px; }
        .bp-faq summary { cursor: pointer; padding: 10px 12px; font-weight: 700; color: #090b1a; font-size: 14px; }
        .bp-faq details p { margin: 0 !important; padding: 0 12px 10px; font-size: 14px; }

        @media (max-width: 1200px) {
          .blog-editor-split { grid-template-columns: 1fr; }
          .blog-preview-pane { max-height: none; }
        }
        @media (max-width: 1000px) {
          .blog-two-col { grid-template-columns: 1fr; }
          .blog-topbar { flex-wrap: wrap; }
          .blog-topbar-actions { width: 100%; justify-content: flex-end; }
          .blog-field-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

export default BlogPage;
