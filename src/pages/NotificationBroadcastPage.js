import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner, DataTable } from '../components';
import {
  cancelNotificationBroadcast,
  createNotificationBroadcastDraft,
  estimateNotificationBroadcastAudience,
  listIndustries,
  listNotificationBroadcasts,
  searchBusinessesForLink,
  searchProductsForLink,
  searchServicesForLink,
  sendNotificationBroadcast,
  updateNotificationBroadcastDraft,
  uploadBroadcastBanner,
} from '../services/adminApi';
import { usePermissions } from '../shared/permissions';

const STATUS_COLORS = {
  DRAFT: '#6B7280',
  SCHEDULED: '#F59E0B',
  SENDING: '#3B82F6',
  SENT: '#10B981',
  FAILED: '#EF4444',
  CANCELLED: '#9CA3AF',
};

function StatusChip({ status }) {
  const color = STATUS_COLORS[status] || '#111827';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: '12px',
        backgroundColor: `${color}15`,
        border: `1px solid ${color}30`,
      }}
    >
      <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 6 }} />
      <span style={{ color, fontSize: 11, fontWeight: 700 }}>{status}</span>
    </div>
  );
}

function PlusIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function RefreshIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
    </svg>
  );
}

function CloseIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

const EMPTY_FORM = {
  id: null,
  title: '',
  message: '',
  bannerUrl: '',
  audienceType: 'ALL',
  statesText: '',
  citiesText: '',
  ctaTargetType: 'NONE',
  ctaTargetId: null,
  ctaTargetLabel: '',
  ctaTargetValue: '',
};

const ID_BASED_CTA_TYPES = new Set(['BUSINESS', 'PRODUCT', 'SERVICE', 'INDUSTRY']);

const LINK_SEARCHERS = {
  BUSINESS: { fn: searchBusinessesForLink, idKey: 'id', labelKey: 'businessName', placeholder: 'Search business by name…' },
  PRODUCT: { fn: searchProductsForLink, idKey: 'id', labelKey: 'productName', placeholder: 'Search product by name…' },
  SERVICE: { fn: searchServicesForLink, idKey: 'serviceId', labelKey: 'serviceName', placeholder: 'Search service by name…' },
};

const extractLinkResults = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.businesses)) return data.businesses;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.services)) return data.services;
  return [];
};

function NotificationBroadcastPage({ token }) {
  const { hasPermission } = usePermissions();
  const canSend = hasPermission('ADMIN_NOTIFICATION_BROADCAST_SEND');

  const [form, setForm] = useState(EMPTY_FORM);
  const [scheduleAt, setScheduleAt] = useState('');
  const [estimatedReach, setEstimatedReach] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState({ type: 'info', text: '' });

  const [broadcasts, setBroadcasts] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);

  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState([]);
  const [isSearchingLink, setIsSearchingLink] = useState(false);
  const [showLinkResults, setShowLinkResults] = useState(false);
  const linkSearchDebounceRef = useRef(null);

  const [industries, setIndustries] = useState([]);
  const [isLoadingIndustries, setIsLoadingIndustries] = useState(false);

  const parseList = (text) =>
    text.split(',').map((v) => v.trim()).filter(Boolean);

  const handleLinkTypeChange = (type) => {
    setForm((prev) => ({ ...prev, ctaTargetType: type, ctaTargetId: null, ctaTargetLabel: '', ctaTargetValue: '' }));
    setLinkQuery('');
    setLinkResults([]);
    setShowLinkResults(false);
    if (type === 'INDUSTRY' && industries.length === 0 && !isLoadingIndustries) {
      setIsLoadingIndustries(true);
      listIndustries(token)
        .then((list) => setIndustries(Array.isArray(list) ? list : list?.data || []))
        .catch((error) => setMessage({ type: 'error', text: error.message || 'Failed to load industries.' }))
        .finally(() => setIsLoadingIndustries(false));
    }
  };

  // Live, debounced search-as-you-type — no separate "Search" button.
  useEffect(() => {
    const searcher = LINK_SEARCHERS[form.ctaTargetType];
    if (!searcher || !linkQuery.trim() || linkQuery.trim().length < 2) {
      setLinkResults([]);
      return;
    }
    setIsSearchingLink(true);
    if (linkSearchDebounceRef.current) clearTimeout(linkSearchDebounceRef.current);
    linkSearchDebounceRef.current = setTimeout(async () => {
      try {
        const response = await searcher.fn(token, linkQuery.trim());
        setLinkResults(extractLinkResults(response));
        setShowLinkResults(true);
      } catch (error) {
        setMessage({ type: 'error', text: error.message || 'Search failed.' });
      } finally {
        setIsSearchingLink(false);
      }
    }, 350);
    return () => clearTimeout(linkSearchDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkQuery, form.ctaTargetType]);

  const handlePickLinkResult = (item) => {
    const searcher = LINK_SEARCHERS[form.ctaTargetType];
    if (!searcher) return;
    const id = item[searcher.idKey];
    const label = item[searcher.labelKey] || `#${id}`;
    setForm((prev) => ({ ...prev, ctaTargetId: id, ctaTargetLabel: label }));
    setShowLinkResults(false);
    setLinkQuery(label);
  };

  const handleClearLinkSelection = () => {
    setForm((prev) => ({ ...prev, ctaTargetId: null, ctaTargetLabel: '' }));
    setLinkQuery('');
    setLinkResults([]);
  };

  const loadBroadcasts = async () => {
    setIsLoadingList(true);
    try {
      const response = await listNotificationBroadcasts(token);
      const raw = Array.isArray(response?.data) ? response.data : [];
      raw.sort((a, b) => new Date(b?.createdOn || 0) - new Date(a?.createdOn || 0));
      setBroadcasts(raw);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to load notifications.' });
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadBroadcasts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setScheduleAt('');
    setEstimatedReach(null);
    setLinkQuery('');
    setLinkResults([]);
    setShowLinkResults(false);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setMessage({ type: 'info', text: '' });
    try {
      const response = await uploadBroadcastBanner(token, file);
      const url = response?.data;
      setForm((prev) => ({ ...prev, bannerUrl: url || prev.bannerUrl }));
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to upload banner.' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const saveDraftAndEstimate = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setMessage({ type: 'error', text: 'Title and message are required.' });
      return null;
    }
    if (form.audienceType === 'LOCATION' && !parseList(form.statesText).length && !parseList(form.citiesText).length) {
      setMessage({ type: 'error', text: 'Enter at least one state or city for location targeting.' });
      return null;
    }
    if (ID_BASED_CTA_TYPES.has(form.ctaTargetType) && !form.ctaTargetId) {
      setMessage({ type: 'error', text: 'Search and pick something to link to, or set "Link to" back to None.' });
      return null;
    }
    if (form.ctaTargetType === 'WEBSITE' && !form.ctaTargetValue.trim()) {
      setMessage({ type: 'error', text: 'Enter a website URL to link to.' });
      return null;
    }
    setIsSaving(true);
    setMessage({ type: 'info', text: '' });
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        bannerUrl: form.bannerUrl || null,
        audienceType: form.audienceType,
        states: form.audienceType === 'LOCATION' ? parseList(form.statesText) : [],
        cities: form.audienceType === 'LOCATION' ? parseList(form.citiesText) : [],
        ctaTargetType: form.ctaTargetType,
        ctaTargetId: ID_BASED_CTA_TYPES.has(form.ctaTargetType) ? form.ctaTargetId : null,
        ctaTargetValue: form.ctaTargetType === 'WEBSITE' ? form.ctaTargetValue.trim() : null,
      };
      const response = form.id
        ? await updateNotificationBroadcastDraft(token, form.id, payload)
        : await createNotificationBroadcastDraft(token, payload);
      const saved = response?.data;
      setForm((prev) => ({ ...prev, id: saved?.id ?? prev.id }));

      const estimateResponse = await estimateNotificationBroadcastAudience(token, saved.id);
      const reach = estimateResponse?.data?.estimatedReach ?? 0;
      setEstimatedReach(reach);
      return saved;
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to save notification.' });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async (now) => {
    const saved = await saveDraftAndEstimate();
    if (!saved) return;

    if (now && (estimatedReach === 0)) {
      if (!window.confirm('Estimated reach is 0 for the selected audience. Send anyway?')) return;
    }
    if (!now && !scheduleAt) {
      setMessage({ type: 'error', text: 'Pick a date & time to schedule this notification.' });
      return;
    }

    setIsSending(true);
    try {
      await sendNotificationBroadcast(token, saved.id, now ? null : new Date(scheduleAt).toISOString());
      setMessage({
        type: 'success',
        text: now ? 'Notification sent to all matching users.' : 'Notification scheduled successfully.',
      });
      resetForm();
      setShowCreateForm(false);
      await loadBroadcasts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to send notification.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = async (broadcast) => {
    if (!window.confirm(`Cancel notification "${broadcast.title}"?`)) return;
    try {
      await cancelNotificationBroadcast(token, broadcast.id);
      await loadBroadcasts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to cancel notification.' });
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'banner',
        header: 'Banner',
        width: '90px',
        render: (_, row) => (
          <div style={{ width: 64, height: 40, backgroundColor: '#F3F4F6', borderRadius: 6, overflow: 'hidden' }}>
            {row.bannerUrl ? (
              <img src={row.bannerUrl} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 9 }}>
                No Image
              </div>
            )}
          </div>
        ),
      },
      { key: 'title', header: 'Title' },
      {
        key: 'audienceType',
        header: 'Audience',
        render: (_, row) =>
          row.audienceType === 'LOCATION'
            ? `Location: ${[...(row.states || []), ...(row.cities || [])].join(', ') || '—'}`
            : 'All Users',
      },
      {
        key: 'ctaTargetType',
        header: 'Links to',
        render: (_, row) => {
          if (!row.ctaTargetType || row.ctaTargetType === 'NONE') return '—';
          if (row.ctaTargetType === 'HOME') return 'Home Screen';
          if (row.ctaTargetType === 'WEBSITE') return row.ctaTargetValue || 'Website';
          return `${row.ctaTargetType} #${row.ctaTargetId}`;
        },
      },
      { key: 'estimatedReach', header: 'Reach', render: (v) => (v ?? '—') },
      { key: 'sentCount', header: 'Sent', render: (v) => (v ?? '—') },
      { key: 'status', header: 'Status', render: (_, row) => <StatusChip status={row.status} /> },
      {
        key: 'createdOn',
        header: 'Created',
        render: (v) => (v ? new Date(v).toLocaleString() : '—'),
      },
      {
        key: 'actions',
        header: '',
        render: (_, row) =>
          canSend && (row.status === 'DRAFT' || row.status === 'SCHEDULED') ? (
            <button type="button" className="ghost-btn small" onClick={() => handleCancel(row)}>
              Cancel
            </button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canSend]
  );

  return (
    <div className="users-page notification-broadcast-page">
      <div className="users-head">
        <div>
          <h2 className="panel-title">Notification Broadcast</h2>
          <p className="panel-subtitle">
            Send a custom push notification to every user with the app installed — or a specific state/city.
          </p>
        </div>
      </div>

      <Banner message={message} onDismiss={() => setMessage({ type: 'info', text: '' })} />

      {canSend && showCreateForm && (
        <div className="panel card" style={{ padding: 20, marginBottom: 24 }}>
          <div className="notif-form-panel-head">
            <h3 className="panel-title" style={{ fontSize: 15, margin: 0 }}>New Notification</h3>
            <button
              type="button"
              className="notif-form-close-btn"
              onClick={() => setShowCreateForm(false)}
              title="Close"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="field-grid">
            <label className="field field-span">
              <span>Title *</span>
              <input
                type="text"
                maxLength={100}
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. New business just joined Deal360!"
              />
            </label>

            <label className="field field-span">
              <span>Message *</span>
              <textarea
                maxLength={300}
                rows={3}
                value={form.message}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                placeholder="e.g. Check out ABC Traders, now live on Deal360 near you."
              />
            </label>

            <label className="field field-span">
              <span>Banner / Business Logo</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="file" accept="image/*" onChange={handleUpload} disabled={isUploading} />
                {isUploading && <span className="bc-hint">Uploading…</span>}
                {form.bannerUrl && !isUploading && (
                  <img src={form.bannerUrl} alt="Banner preview" style={{ height: 40, borderRadius: 6 }} />
                )}
              </div>
            </label>

            <label className="field">
              <span>Audience *</span>
              <select
                value={form.audienceType}
                onChange={(e) => setForm((prev) => ({ ...prev, audienceType: e.target.value }))}
              >
                <option value="ALL">All Users (app installed)</option>
                <option value="LOCATION">Specific State / City</option>
              </select>
            </label>

            {form.audienceType === 'LOCATION' && (
              <>
                <label className="field">
                  <span>States (comma separated)</span>
                  <input
                    type="text"
                    value={form.statesText}
                    onChange={(e) => setForm((prev) => ({ ...prev, statesText: e.target.value }))}
                    placeholder="e.g. Gujarat, Maharashtra"
                  />
                </label>
                <label className="field">
                  <span>Cities (comma separated)</span>
                  <input
                    type="text"
                    value={form.citiesText}
                    onChange={(e) => setForm((prev) => ({ ...prev, citiesText: e.target.value }))}
                    placeholder="e.g. Surat, Ahmedabad"
                  />
                </label>
              </>
            )}

            <label className="field">
              <span>Link to (optional)</span>
              <select value={form.ctaTargetType} onChange={(e) => handleLinkTypeChange(e.target.value)}>
                <option value="NONE">Nothing — open Notifications tab</option>
                <option value="BUSINESS">A Business</option>
                <option value="PRODUCT">A Product</option>
                <option value="SERVICE">A Service</option>
                <option value="INDUSTRY">An Industry</option>
                <option value="WEBSITE">A Website</option>
                <option value="HOME">Home Screen</option>
              </select>
            </label>

            {form.ctaTargetType === 'WEBSITE' && (
              <label className="field field-span">
                <span>Website URL</span>
                <input
                  type="url"
                  value={form.ctaTargetValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, ctaTargetValue: e.target.value }))}
                  placeholder="https://example.com"
                />
              </label>
            )}

            {form.ctaTargetType === 'INDUSTRY' && (
              <label className="field field-span">
                <span>Industry</span>
                <select
                  value={form.ctaTargetId || ''}
                  onChange={(e) => {
                    const industry = industries.find((i) => String(i.id) === e.target.value);
                    setForm((prev) => ({
                      ...prev,
                      ctaTargetId: e.target.value ? Number(e.target.value) : null,
                      ctaTargetLabel: industry?.name || '',
                    }));
                  }}
                  disabled={isLoadingIndustries}
                >
                  <option value="">{isLoadingIndustries ? 'Loading…' : 'Select an industry'}</option>
                  {industries.map((industry) => (
                    <option key={industry.id} value={industry.id}>{industry.name}</option>
                  ))}
                </select>
              </label>
            )}

            {LINK_SEARCHERS[form.ctaTargetType] && (
              <label className="field field-span">
                <span>Search {form.ctaTargetType.toLowerCase()} to link</span>
                <div className="notif-link-combobox">
                  <input
                    type="text"
                    value={linkQuery}
                    onChange={(e) => {
                      setLinkQuery(e.target.value);
                      setForm((prev) => ({ ...prev, ctaTargetId: null, ctaTargetLabel: '' }));
                      setShowLinkResults(true);
                    }}
                    onFocus={() => linkResults.length > 0 && setShowLinkResults(true)}
                    onBlur={() => setTimeout(() => setShowLinkResults(false), 150)}
                    placeholder={LINK_SEARCHERS[form.ctaTargetType]?.placeholder}
                  />
                  {showLinkResults && linkQuery.trim().length >= 2 && (
                    <div className="notif-link-results">
                      {isSearchingLink ? (
                        <div className="notif-link-empty">Searching…</div>
                      ) : linkResults.length === 0 ? (
                        <div className="notif-link-empty">No matches found.</div>
                      ) : (
                        linkResults.map((item) => {
                          const searcher = LINK_SEARCHERS[form.ctaTargetType];
                          const id = item[searcher.idKey];
                          const label = item[searcher.labelKey] || `#${id}`;
                          return (
                            <div
                              key={id}
                              className="notif-link-result-item"
                              onMouseDown={() => handlePickLinkResult(item)}
                            >
                              {label}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                {form.ctaTargetId && (
                  <span className="notif-link-selected">
                    Linked: {form.ctaTargetLabel} (#{form.ctaTargetId})
                    <button type="button" onClick={handleClearLinkSelection} title="Remove link" aria-label="Remove link">
                      <CloseIcon />
                    </button>
                  </span>
                )}
              </label>
            )}

            <label className="field">
              <span>Schedule for later (optional)</span>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            </label>
          </div>

          {estimatedReach !== null && (
            <p className="bc-hint" style={{ marginTop: 12 }}>
              Estimated reach: <strong>{estimatedReach}</strong> user(s)
            </p>
          )}

          <div className="form-actions" style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={saveDraftAndEstimate} disabled={isSaving}>
              {isSaving ? 'Checking…' : 'Preview Reach'}
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => handleSend(false)}
              disabled={isSaving || isSending || !scheduleAt}
            >
              Schedule
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={() => handleSend(true)}
              disabled={isSaving || isSending}
            >
              {isSending ? 'Sending…' : 'Send Now'}
            </button>
          </div>
        </div>
      )}

      <div className="panel card users-table-card">
        <DataTable
          columns={columns}
          data={broadcasts}
          isLoading={isLoadingList}
          searchPlaceholder="Search by title…"
          emptyTitle="No notifications sent yet."
          emptyDescription="Broadcasts you send will show up here."
          toolbarLeft={<h3 className="panel-title" style={{ fontSize: 15, margin: 0 }}>History</h3>}
          toolbarRight={
            <>
              <button
                type="button"
                className={`gsc-icon-btn${isLoadingList ? ' spinning' : ''}`}
                onClick={loadBroadcasts}
                disabled={isLoadingList}
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshIcon />
              </button>
              {canSend && (
                <button
                  type="button"
                  className="gsc-create-btn"
                  onClick={() => {
                    resetForm();
                    setShowCreateForm(true);
                  }}
                  title="New notification"
                  aria-label="New notification"
                >
                  <PlusIcon />
                </button>
              )}
            </>
          }
        />
      </div>
    </div>
  );
}

export default NotificationBroadcastPage;
