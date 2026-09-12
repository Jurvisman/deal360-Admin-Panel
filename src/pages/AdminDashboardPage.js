import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { Banner } from '../components';
import { getDashboardOverview } from '../services/adminApi';

const CACHE_KEY = 'traddex_dashboard_overview_cache';

const defaultOverview = {
  accounts: { totalAccounts: 0, businessProfiles: 0, individualUsers: 0, activeAccounts: 0 },
  products: { totalProducts: 0, liveOnApp: 0, pendingReview: 0, drafts: 0, websiteLive: 0 },
  leads: { totalGenerated: 0, totalCirculated: 0, contactsUnlocked: 0, quotationsSent: 0, dealsClosed: 0, conversionRate: 0 },
  revenue: { totalRevenue: 0, thisMonthRevenue: 0, totalPaidCount: 0, activeSubscriptions: 0, paidSubscribers: 0, topPlans: [], monthlyTrend: [] },
};

const getCachedOverview = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return defaultOverview;
};

const toNumber = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    toNumber(val)
  );

/* ── Minimal Custom Tooltip for Recharts ────────────────────────── */
const MinimalTooltip = ({ active, payload, label, formatter, prefix = '' }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const displayVal = formatter ? formatter(item.value) : item.value;
  return (
    <div
      style={{
        background: 'var(--panel, #ffffff)',
        border: '1px solid var(--line, #e2e8f0)',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        fontSize: '12px',
        color: 'var(--text, #0f172a)',
      }}
    >
      {label && <div style={{ fontWeight: 600, marginBottom: '2px', color: 'var(--muted, #64748b)' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color || item.payload?.fill || '#6366F1' }} />
        <span style={{ color: 'var(--muted, #64748b)' }}>{item.name}:</span>
        <strong style={{ fontWeight: 700 }}>{prefix}{displayVal}</strong>
      </div>
      {item.payload?.sub && (
        <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: '2px' }}>{item.payload.sub}</div>
      )}
    </div>
  );
};

function AdminDashboardPage({ token }) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(getCachedOverview);
  const [message, setMessage] = useState({ type: 'info', text: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState(() => {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  });
  const loadingRef = useRef(false);

  const loadStats = async (silent = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!silent) setIsLoading(true);

    try {
      const res = await getDashboardOverview(token);
      if (res?.data) {
        setOverview(res.data);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(res.data));
        } catch (e) {}
        setLastSynced(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      if (!silent) {
        setMessage({ type: 'error', text: err.message || 'Failed to sync latest dashboard data.' });
      }
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats(true);
    const interval = setInterval(() => loadStats(true), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Derived calculations
  const totalProducts = Math.max(overview.products.totalProducts, 1);
  const liveProductPct = overview.products.totalProducts > 0
    ? Math.round((overview.products.liveOnApp / overview.products.totalProducts) * 100)
    : 0;

  // Chart 1: Product Catalog Distribution (Pie / Donut)
  const productChartData = useMemo(() => [
    { name: 'Live on App', value: overview.products.liveOnApp || 0, color: '#10B981', sub: 'Approved & visible on mobile app' },
    { name: 'Pending Review', value: overview.products.pendingReview || 0, color: '#F59E0B', sub: 'Awaiting admin moderation' },
    { name: 'Drafts', value: overview.products.drafts || 0, color: '#94A3B8', sub: 'Unpublished drafts' },
    { name: 'Website Live', value: overview.products.websiteLive || 0, color: '#8B5CF6', sub: 'Active on website storefront' },
  ], [overview.products]);

  // Chart 2: Lead Funnel Conversion (Horizontal Bar Chart)
  const leadFunnelData = useMemo(() => [
    { stage: '1. Inquiries', count: overview.leads.totalGenerated || 0, color: '#6366F1', detail: 'Posted by buyers' },
    { stage: '2. Circulated', count: overview.leads.totalCirculated || 0, color: '#0EA5E9', detail: 'Dispatched to matching sellers' },
    { stage: '3. Unlocked', count: overview.leads.contactsUnlocked || 0, color: '#F59E0B', detail: 'Credit consumed by sellers' },
    { stage: '4. Quotations', count: overview.leads.quotationsSent || 0, color: '#8B5CF6', detail: 'Price proposals submitted' },
    { stage: '5. Closed Deals', count: overview.leads.dealsClosed || 0, color: '#10B981', detail: 'Proposals accepted by buyers' },
  ], [overview.leads]);

  // Chart 3: Monthly Revenue Trend (Area Chart)
  const revenueTrendData = useMemo(() => {
    if (overview.revenue?.monthlyTrend?.length) {
      return overview.revenue.monthlyTrend.map((pt) => ({
        month: pt.month,
        revenue: toNumber(pt.revenue),
        count: pt.count || 0,
      }));
    }
    return [
      { month: 'Apr', revenue: 0, count: 0 },
      { month: 'May', revenue: 0, count: 0 },
      { month: 'Jun', revenue: 0, count: 0 },
      { month: 'Jul', revenue: 0, count: 0 },
      { month: 'Aug', revenue: 0, count: 0 },
      { month: 'Sep', revenue: toNumber(overview.revenue?.thisMonthRevenue || 0), count: overview.revenue?.totalPaidCount || 0 },
    ];
  }, [overview.revenue]);

  // Account Mix Donut Data
  const accountMixData = useMemo(() => {
    const business = overview.accounts.businessProfiles || 0;
    const individual = overview.accounts.individualUsers || 0;
    const other = Math.max(0, overview.accounts.totalAccounts - (business + individual));
    return [
      { name: 'Businesses', value: business, color: '#10B981' },
      { name: 'Individuals', value: individual, color: '#6366F1' },
      { name: 'Others', value: other, color: '#94A3B8' },
    ];
  }, [overview.accounts]);

  const topPlans = overview.revenue?.topPlans || [];
  const maxPlanRev = Math.max(...topPlans.map((p) => toNumber(p.revenue)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text, #0f172a)', letterSpacing: '-0.02em' }}>
            System Dashboard
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--muted, #64748b)' }}>
            Real-time analytics across accounts, product catalog health, lead pipeline & revenue.
          </p>
        </div>

        {/* Sync Status & Minimal Icon-Only Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--panel, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: '20px',
              padding: '4px 10px',
              fontSize: '11px',
              color: 'var(--muted, #64748b)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#10B981',
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
              }}
            />
            <span>Live: {lastSynced}</span>
          </div>

          <button
            type="button"
            onClick={() => loadStats(false)}
            disabled={isLoading}
            title="Refresh data"
            aria-label="Refresh data"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              border: '1px solid var(--line, #e2e8f0)',
              background: 'var(--panel, #ffffff)',
              color: 'var(--text, #0f172a)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition: 'transform 0.4s ease',
                transform: isLoading ? 'rotate(180deg)' : 'none',
              }}
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      <Banner message={message} />

      {/* ── Top Executive Hero KPIs (4 Minimal Cards) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
        {/* Total Accounts */}
        <div
          onClick={() => navigate('/admin/businesses')}
          style={{
            background: 'var(--panel, #ffffff)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: '16px',
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted, #64748b)' }}>
              Total Accounts
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.08)', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 3s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text, #0f172a)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {overview.accounts.totalAccounts}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted, #64748b)', display: 'flex', gap: '8px' }}>
            <span><strong style={{ color: '#10B981', fontWeight: 600 }}>{overview.accounts.businessProfiles}</strong> Businesses</span>
            <span>•</span>
            <span><strong style={{ color: '#6366F1', fontWeight: 600 }}>{overview.accounts.individualUsers}</strong> Users</span>
          </div>
        </div>

        {/* Products Live on App */}
        <div
          onClick={() => navigate('/admin/products')}
          style={{
            background: 'var(--panel, #ffffff)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: '16px',
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted, #64748b)' }}>
              Live on Mobile App
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text, #0f172a)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {overview.products.liveOnApp}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
            {overview.products.pendingReview > 0 ? (
              <span style={{ color: '#F59E0B', fontWeight: 600 }}>{overview.products.pendingReview} Pending Approval</span>
            ) : (
              <span>0 Pending</span>
            )}{' '}
            • {overview.products.totalProducts} Total Catalog
          </div>
        </div>

        {/* Lead Engine Inquiries */}
        <div
          onClick={() => navigate('/admin/inquiry/leads')}
          style={{
            background: 'var(--panel, #ffffff)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: '16px',
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted, #64748b)' }}>
              Inquiries & Leads
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text, #0f172a)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {overview.leads.totalGenerated}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
            <strong style={{ color: '#10B981', fontWeight: 600 }}>{overview.leads.dealsClosed}</strong> Deals Closed ({overview.leads.conversionRate}% Rate)
          </div>
        </div>

        {/* Platform Revenue */}
        <div
          onClick={() => navigate('/admin/revenue/subscription')}
          style={{
            background: 'var(--panel, #ffffff)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: '16px',
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted, #64748b)' }}>
              Platform Revenue
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.08)', color: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-.88-.53-1.84-2.2-1.84-1.6 0-2.18.77-2.18 1.52 0 .76.54 1.33 2.51 1.81 2.69.65 4.34 1.63 4.34 3.73 0 1.6-1.12 2.89-3.36 3.53z" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text, #0f172a)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {formatCurrency(overview.revenue.totalRevenue)}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
            {formatCurrency(overview.revenue.thisMonthRevenue)} this mo • {overview.revenue.activeSubscriptions} Active Subs
          </div>
        </div>
      </div>

      {/* ── CHART 1 & CATALOG SECTION: Product Catalog Health with Interactive Pie/Donut Chart ── */}
      <div
        style={{
          background: 'var(--panel, #ffffff)',
          border: '1px solid var(--line, #e2e8f0)',
          borderRadius: '16px',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text, #0f172a)' }}>
                1. Product Catalog Health & Distribution
              </h3>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.08)', color: '#6366F1' }}>
                {overview.products.totalProducts} Total Items
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
              Interactive breakdown of catalog status across Mobile App, Pending Moderation, Drafts & Website.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin/products')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--line, #e2e8f0)',
              background: 'transparent',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text, #0f172a)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
              e.currentTarget.style.borderColor = 'var(--text, #0f172a)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'var(--line, #e2e8f0)';
            }}
          >
            <span>Manage Products</span>
            <span style={{ fontSize: '14px', lineHeight: 1 }}>→</span>
          </button>
        </div>

        {/* 2-Column: Left = Tiles & Progress, Right = Recharts Donut */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', alignItems: 'center' }}>
          {/* Left Column: 4 Metric Tiles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Live on Mobile App */}
              <div
                onClick={() => navigate('/admin/products')}
                style={{
                  border: '1px solid var(--line, #e2e8f0)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: 'var(--bg, #f8fafc)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted, #64748b)' }}>Live on App</span>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} />
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#10B981' }}>{overview.products.liveOnApp}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: '2px' }}>Approved & visible</div>
              </div>

              {/* Pending Review */}
              <div
                onClick={() => navigate('/admin/products')}
                style={{
                  border: overview.products.pendingReview > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--line, #e2e8f0)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: overview.products.pendingReview > 0 ? 'rgba(245, 158, 11, 0.04)' : 'var(--bg, #f8fafc)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted, #64748b)' }}>Pending Review</span>
                  {overview.products.pendingReview > 0 && (
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#F59E0B', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: '3px' }}>
                      ACTION
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: overview.products.pendingReview > 0 ? '#F59E0B' : 'var(--text, #0f172a)' }}>
                  {overview.products.pendingReview}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: '2px' }}>Needs admin check</div>
              </div>

              {/* Draft Products */}
              <div
                onClick={() => navigate('/admin/products')}
                style={{
                  border: '1px solid var(--line, #e2e8f0)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: 'var(--bg, #f8fafc)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted, #64748b)' }}>Draft Products</span>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94A3B8' }} />
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text, #0f172a)' }}>{overview.products.drafts}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: '2px' }}>Unpublished</div>
              </div>

              {/* Website Storefront Live */}
              <div
                onClick={() => navigate('/admin/products')}
                style={{
                  border: '1px solid var(--line, #e2e8f0)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: 'var(--bg, #f8fafc)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted, #64748b)' }}>Website Live</span>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8B5CF6' }} />
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#8B5CF6' }}>{overview.products.websiteLive}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: '2px' }}>Public storefront</div>
              </div>
            </div>

            {/* Minimal Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted, #64748b)', marginBottom: '5px' }}>
                <span>Live App Ratio: <strong>{liveProductPct}%</strong></span>
                <span>{overview.products.liveOnApp} of {overview.products.totalProducts}</span>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'var(--line, #e2e8f0)', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${liveProductPct}%`, background: '#10B981', transition: 'width 0.4s ease' }} />
                <div style={{ width: `${overview.products.totalProducts > 0 ? (overview.products.pendingReview / overview.products.totalProducts) * 100 : 0}%`, background: '#F59E0B' }} />
                <div style={{ width: `${overview.products.totalProducts > 0 ? (overview.products.drafts / overview.products.totalProducts) * 100 : 0}%`, background: '#94A3B8' }} />
              </div>
            </div>
          </div>

          {/* Right Column: Recharts Donut Chart */}
          <div style={{ height: '190px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {productChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <RechartsTooltip content={<MinimalTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text, #0f172a)', lineHeight: 1 }}>
                {overview.products.totalProducts}
              </div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted, #64748b)', letterSpacing: '0.04em', marginTop: '2px' }}>
                Catalog
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CHART 2 & FUNNEL SECTION: Lead Engine Funnel with Horizontal Bar Chart ── */}
      <div
        style={{
          background: 'var(--panel, #ffffff)',
          border: '1px solid var(--line, #e2e8f0)',
          borderRadius: '16px',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text, #0f172a)' }}>
                2. Lead Engine & Conversion Funnel Chart
              </h3>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.08)', color: '#10B981' }}>
                {overview.leads.conversionRate}% Overall Conversion
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
              Step-by-step conversion pipeline from Inquiry creation to Deal closing.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin/inquiry/leads')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--line, #e2e8f0)',
              background: 'transparent',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text, #0f172a)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
              e.currentTarget.style.borderColor = 'var(--text, #0f172a)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'var(--line, #e2e8f0)';
            }}
          >
            <span>View All Leads</span>
            <span style={{ fontSize: '14px', lineHeight: 1 }}>→</span>
          </button>
        </div>

        {/* 5 Minimal Horizontal Step Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          {leadFunnelData.map((step) => (
            <div
              key={step.stage}
              style={{
                border: '1px solid var(--line, #e2e8f0)',
                borderRadius: '12px',
                padding: '12px 14px',
                background: 'var(--bg, #f8fafc)',
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: step.color, letterSpacing: '0.04em' }}>
                {step.stage}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text, #0f172a)', margin: '4px 0 2px' }}>
                {step.count}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>{step.detail}</div>
            </div>
          ))}
        </div>

        {/* Recharts Horizontal Funnel Bar Chart */}
        <div style={{ width: '100%', height: '180px', marginTop: '10px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={leadFunnelData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line, #e2e8f0)" horizontal={false} opacity={0.5} />
              <XAxis type="number" stroke="var(--muted, #64748b)" fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="stage"
                stroke="var(--muted, #64748b)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <RechartsTooltip content={<MinimalTooltip />} />
              <Bar dataKey="count" name="Volume" radius={[0, 6, 6, 0]} barSize={16}>
                {leadFunnelData.map((entry) => (
                  <Cell key={entry.stage} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Funnel Efficiency Metrics Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--muted, #64748b)', padding: '6px 0 0' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span>
              Circulation Multiplier: <strong style={{ color: 'var(--text, #0f172a)' }}>{overview.leads.totalGenerated > 0 ? (overview.leads.totalCirculated / overview.leads.totalGenerated).toFixed(1) : 0}x</strong> (sellers/inquiry)
            </span>
            <span>
              Quote-to-Close Rate: <strong style={{ color: '#10B981' }}>{overview.leads.quotationsSent > 0 ? ((overview.leads.dealsClosed / overview.leads.quotationsSent) * 100).toFixed(1) : 0}%</strong>
            </span>
          </div>
          <span style={{ fontSize: '11px' }}>Database real-time aggregate</span>
        </div>
      </div>

      {/* ── CHART 3 & FINANCIAL SECTION: Monthly Revenue Growth Area Chart + Account Mix ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
        {/* Chart 3: Monthly Revenue Smooth Area Chart (Takes 1.5x width if space allows) */}
        <div
          style={{
            background: 'var(--panel, #ffffff)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: '16px',
            padding: '20px',
            gridColumn: 'span 2',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text, #0f172a)' }}>
                3. Platform Revenue & Transaction Momentum
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
                6-Month continuous gross revenue and payment transaction volume.
              </p>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0EA5E9' }}>
              {formatCurrency(overview.revenue.totalRevenue)}
            </span>
          </div>

          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line, #e2e8f0)" opacity={0.5} vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted, #64748b)" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="var(--muted, #64748b)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
                />
                <RechartsTooltip
                  content={
                    <MinimalTooltip
                      formatter={(val) => formatCurrency(val)}
                      prefix=""
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#0EA5E9"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Account Mix Donut Chart */}
        <div style={{ background: 'var(--panel, #ffffff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text, #0f172a)' }}>Account Mix</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted, #64748b)' }}>Profile type distribution</p>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>{overview.accounts.totalAccounts} Total</span>
          </div>

          <div style={{ height: '180px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={accountMixData}
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={68}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {accountMixData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <RechartsTooltip content={<MinimalTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text, #0f172a)', lineHeight: 1 }}>
                {overview.accounts.totalAccounts}
              </div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted, #64748b)', letterSpacing: '0.04em', marginTop: '2px' }}>
                Accounts
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '6px' }}>
            {accountMixData.map((item) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: item.color }} />
                <span style={{ color: 'var(--muted, #64748b)' }}>{item.name}:</span>
                <strong style={{ color: 'var(--text, #0f172a)' }}>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Top Subscription Plans Breakdown */}
        <div style={{ background: 'var(--panel, #ffffff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text, #0f172a)' }}>Subscription Plans</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted, #64748b)' }}>Top active plans by subscriber volume</p>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>{overview.revenue.activeSubscriptions} Active</span>
          </div>

          {topPlans.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)', padding: '24px 0', textAlign: 'center' }}>
              No active subscription plans assigned yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topPlans.map((plan) => {
                const pct = maxPlanRev > 0 ? (toNumber(plan.revenue) / maxPlanRev) * 100 : 0;
                return (
                  <div key={plan.planId || plan.planName} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text, #0f172a)' }}>{plan.planName}</span>
                      <span style={{ color: 'var(--muted, #64748b)' }}>
                        <strong>{plan.activeCount}</strong> users ({formatCurrency(plan.revenue)})
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: 'var(--line, #e2e8f0)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(pct, 4)}%`, height: '100%', background: '#6366F1', borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
