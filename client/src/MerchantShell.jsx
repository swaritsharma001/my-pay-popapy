import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Check,
  CircleHelp,
  Clipboard,
  Code2,
  Gauge,
  KeyRound,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  Store,
  WalletCards,
  X,
} from 'lucide-react';
import { clearSession, getMe, hasSession } from './api.js';

const MerchantContext = createContext(null);
const CREDENTIALS_KEY = 'poppay:onboarding-credentials';

export function queueCredentials(credentials) {
  sessionStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  window.dispatchEvent(new Event('poppay:credentials-updated'));
}

function clearCredentials() {
  sessionStorage.removeItem(CREDENTIALS_KEY);
  window.dispatchEvent(new Event('poppay:credentials-updated'));
}

function readCredentials() {
  try {
    const raw = sessionStorage.getItem(CREDENTIALS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    sessionStorage.removeItem(CREDENTIALS_KEY);
    return null;
  }
}

export function useMerchant() {
  const value = useContext(MerchantContext);
  if (!value) throw new Error('useMerchant must be used inside the merchant area');
  return value;
}

const navGroups = [
  {
    label: 'Workspace',
    links: [
      { to: '/dashboard', label: 'Overview', icon: Gauge, end: true },
      { to: '/orders', label: 'Orders', icon: Clipboard },
      { to: '/payments', label: 'Payments', icon: WalletCards },
      { to: '/unmatched', label: 'Needs matching', icon: Activity },
    ],
  },
  {
    label: 'Manage',
    links: [
      { to: '/settings', label: 'Settings', icon: Settings2 },
      { to: '/integration', label: 'Integration', icon: Code2 },
    ],
  },
];

function BrandMark({ light = false }) {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="PopPay home">
      <span className={`grid h-9 w-9 place-items-center rounded-[12px] ${light ? 'bg-[#c7e8a8] text-[#123b32]' : 'bg-[#126b58] text-[#eff9e8]'}`}>
        <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" aria-hidden="true">
          <path d="M5 7.5h14M5 12h14M5 16.5h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="18" cy="17" r="3" fill={light ? '#126b58' : '#c7e8a8'} />
        </svg>
      </span>
      <span className={`font-[var(--font-display)] text-[21px] font-bold tracking-[-1.2px] ${light ? 'text-white' : 'text-[#142e2b]'}`}>poppay</span>
    </Link>
  );
}

function NavItems({ onNavigate }) {
  return (
    <div className="space-y-7">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.17em] text-[#82978e]">{group.label}</p>
          <nav className="space-y-1" aria-label={group.label}>
            {group.links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) => `sidebar-link flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold ${
                  isActive ? 'bg-[#24564a] text-[#eff9e8] shadow-[inset_3px_0_0_#c7e8a8]' : 'text-[#bfd0c8] hover:bg-[#1b493e] hover:text-white'
                }`}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
                {label}
                {label === 'Needs matching' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#c7e8a8]" />}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
    </div>
  );
}

function CredentialDialog({ credentials, onClose }) {
  const [copied, setCopied] = useState('');
  if (!credentials) return null;
  const fields = [
    ['Public key', credentials.publicKey],
    ['Secret key', credentials.secretKey],
    ['Signing secret', credentials.signingSecret],
    ['Webhook secret', credentials.webhookSecret],
  ].filter(([, value]) => value);

  async function copyValue(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setCopied('');
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#102d27]/65 p-0 backdrop-blur-[3px] sm:items-center sm:p-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="credentials-title" className="max-h-[92dvh] w-full max-w-[600px] overflow-y-auto rounded-t-[26px] bg-[#fffefa] p-5 shadow-2xl sm:rounded-[26px] sm:p-7">
        <div className="mb-5 flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fbefdc] text-[#8b672d]"><KeyRound className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9a712d]">Save these now</p>
            <h2 id="credentials-title" className="mt-1 font-[var(--font-display)] text-[23px] font-semibold tracking-[-.8px] text-[#142e2b]">Your credentials appear once</h2>
          </div>
        </div>
        <div className="mb-5 rounded-xl border border-[#f0d7ac] bg-[#fff8e8] px-4 py-3 text-xs leading-5 text-[#7b602e]">
          Keep these values private. PopPay will not show the secret key, signing secret, or webhook secret again. This copy is held only in this browser tab until you dismiss it.
        </div>
        <div className="space-y-2.5">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[#e3eae2] bg-[#f8faf5] p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#87968d]">{label}</span>
                <button type="button" onClick={() => copyValue(label, value)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-[#126b58] hover:bg-[#e9f3e8]">
                  {copied === label ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                  {copied === label ? 'Copied' : 'Copy'}
                </button>
              </div>
              <code className="block break-all font-mono text-xs leading-5 text-[#31564b]">{value}</code>
            </div>
          ))}
        </div>
        <button type="button" onClick={onClose} className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#126b58] px-5 text-sm font-bold text-white transition-colors hover:bg-[#0b4f42]">
          I’ve saved my credentials
        </button>
      </section>
    </div>
  );
}

export function PrivateArea() {
  const location = useLocation();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [credentials, setCredentials] = useState(readCredentials);

  async function refreshMerchant() {
    setLoadError('');
    try {
      const result = await getMe();
      setMerchant(result.merchant || result);
      return result.merchant || result;
    } catch (error) {
      setLoadError(error.message || 'Could not load your merchant profile.');
      throw error;
    }
  }

  useEffect(() => {
    let active = true;
    if (!hasSession()) {
      setLoading(false);
      return () => { active = false; };
    }
    getMe()
      .then((result) => {
        if (active) setMerchant(result.merchant || result);
      })
      .catch((error) => {
        if (!active) return;
        clearSession();
        setLoadError(error.message || 'Your session has ended. Please sign in again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const sync = () => setCredentials(readCredentials());
    window.addEventListener('poppay:credentials-updated', sync);
    return () => window.removeEventListener('poppay:credentials-updated', sync);
  }, []);

  const contextValue = useMemo(() => ({ merchant, setMerchant, refreshMerchant }), [merchant]);

  function signOut() {
    clearSession();
    clearCredentials();
    navigate('/login', { replace: true });
  }

  if (!hasSession()) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (loading) {
    return (
      <div className="merchant-shell min-h-[100dvh] p-5 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between"><div className="skeleton h-9 w-32 rounded-xl" /><div className="skeleton h-9 w-36 rounded-xl" /></div>
          <div className="skeleton mb-6 h-36 rounded-[24px]" />
          <div className="grid gap-4 md:grid-cols-3"><div className="skeleton h-36 rounded-[22px]" /><div className="skeleton h-36 rounded-[22px]" /><div className="skeleton h-36 rounded-[22px]" /></div>
        </div>
      </div>
    );
  }
  if (loadError && !merchant) {
    return (
      <div className="merchant-shell grid min-h-[100dvh] place-items-center p-6">
        <div className="max-w-md rounded-[24px] border border-[#e1e8e1] bg-[#fffefa] p-7 text-center panel-shadow">
          <CircleHelp className="mx-auto mb-4 h-8 w-8 text-[#b64c3c]" />
          <h1 className="font-[var(--font-display)] text-xl font-semibold text-[#142e2b]">We couldn’t load your workspace</h1>
          <p className="mt-2 text-sm leading-6 text-[#71817b]">{loadError}</p>
          <button type="button" onClick={() => { clearSession(); navigate('/login', { replace: true }); }} className="mt-5 rounded-xl bg-[#126b58] px-5 py-3 text-sm font-bold text-white">Back to sign in</button>
        </div>
      </div>
    );
  }
  if (!merchant) return <Navigate to="/login" replace />;

  return (
    <MerchantContext.Provider value={contextValue}>
      <div className="merchant-shell min-h-[100dvh]">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[246px] flex-col bg-[#123b32] px-4 pb-5 pt-6 lg:flex">
          <div className="px-2"><BrandMark light /></div>
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.055] px-3.5 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#9bb7a9]">Merchant space</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{merchant.name}</p>
          </div>
          <div className="mt-8 flex-1"><NavItems /></div>
          <Link to="/privacy" className="sidebar-link mb-3 flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-semibold text-[#bfd0c8] hover:bg-[#1b493e] hover:text-white">
            <ShieldCheck className="h-4 w-4" />Privacy & data
          </Link>
          <button type="button" onClick={signOut} className="flex min-h-11 items-center gap-3 rounded-xl border-t border-white/10 px-3 pt-3 text-xs font-semibold text-[#bfd0c8] transition-colors hover:text-white">
            <LogOut className="h-4 w-4" />Sign out
          </button>
        </aside>

        <header className="sticky top-0 z-30 flex h-[62px] items-center justify-between border-b border-[#e1e8e1] bg-[#f7f8f3]/95 px-4 backdrop-blur lg:hidden">
          <BrandMark />
          <button type="button" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} className="grid h-10 w-10 place-items-center rounded-xl text-[#244b40] hover:bg-[#e8eee5]">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-[#102d27]/50 lg:hidden" onClick={() => setMobileOpen(false)}>
            <div className="h-full w-[min(320px,86vw)] bg-[#123b32] px-4 pb-5 pt-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-7 flex items-center justify-between px-2"><BrandMark light /><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="grid h-9 w-9 place-items-center rounded-lg text-white"><X className="h-5 w-5" /></button></div>
              <div className="mb-6 rounded-2xl border border-white/10 bg-white/[.055] px-3.5 py-3"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#9bb7a9]">Merchant space</p><p className="mt-1 truncate text-sm font-semibold text-white">{merchant.name}</p></div>
              <NavItems onNavigate={() => setMobileOpen(false)} />
              <Link to="/privacy" onClick={() => setMobileOpen(false)} className="mt-6 flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-semibold text-[#bfd0c8]"><ShieldCheck className="h-4 w-4" />Privacy & data</Link>
              <button type="button" onClick={signOut} className="mt-4 flex min-h-11 w-full items-center gap-3 border-t border-white/10 px-3 pt-3 text-xs font-semibold text-[#bfd0c8]"><LogOut className="h-4 w-4" />Sign out</button>
            </div>
          </div>
        )}

        <main className="min-h-[calc(100dvh-62px)] lg:pl-[246px] lg:min-h-[100dvh]">
          <div className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-7 sm:pt-8 lg:px-10 lg:pt-9">
            <Outlet />
          </div>
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[66px] grid-cols-5 border-t border-[#dfe7de] bg-[#fffefa]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Primary navigation">
          {[
            ['/dashboard', 'Home', Gauge],
            ['/orders', 'Orders', Clipboard],
            ['/payments', 'Paid', WalletCards],
            ['/unmatched', 'Match', Activity],
            ['/settings', 'Settings', Settings2],
          ].map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/dashboard'} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[9px] font-bold ${isActive ? 'text-[#126b58]' : 'text-[#87968d]'}`}>
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <CredentialDialog credentials={credentials} onClose={clearCredentials} />
      </div>
    </MerchantContext.Provider>
  );
}

export function PageHeading({ eyebrow, title, detail, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#68867a]">{eyebrow}</p>}
        <h1 className="font-[var(--font-display)] text-[29px] font-semibold leading-[1.1] tracking-[-1.3px] text-[#142e2b] sm:text-[34px]">{title}</h1>
        {detail && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71817b]">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = '' }) {
  return <section className={`rounded-[20px] border border-[#e1e8e1] bg-[#fffefa] panel-shadow ${className}`}>{children}</section>;
}

export function PanelTitle({ title, detail, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0eb] px-5 py-4 sm:px-6">
      <div><h2 className="text-sm font-bold text-[#203d36]">{title}</h2>{detail && <p className="mt-1 text-xs text-[#84928a]">{detail}</p>}</div>
      {action}
    </div>
  );
}

export function Notice({ tone = 'success', children, onClose }) {
  const tones = {
    success: 'border-[#cfe2d1] bg-[#edf6eb] text-[#315f4e]',
    error: 'border-[#efd6ce] bg-[#fff2ed] text-[#984d3c]',
    warning: 'border-[#f0dfb7] bg-[#fff8e8] text-[#80612d]',
    info: 'border-[#d7e3dc] bg-[#f2f7f2] text-[#47675a]',
  };
  return <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs leading-5 ${tones[tone]}`}>
    <span className="min-w-0 flex-1">{children}</span>
    {onClose && <button type="button" onClick={onClose} aria-label="Dismiss message" className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>}
  </div>;
}

export function EmptyState({ icon: Icon = Store, title, detail, action }) {
  return (
    <div className="px-5 py-12 text-center sm:py-16">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-[16px] bg-[#edf4eb] text-[#52796a]"><Icon className="h-5 w-5" strokeWidth={1.8} /></div>
      <h3 className="font-[var(--font-display)] text-lg font-semibold tracking-[-.4px] text-[#24443b]">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#819087]">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-[#efd6ce] bg-[#fff6f2] p-5">
      <p className="text-sm font-semibold text-[#984d3c]">We couldn’t load this data</p>
      <p className="mt-1 text-xs leading-5 text-[#956d61]">{message || 'Please try again.'}</p>
      <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#9a503d] hover:underline"><Activity className="h-3.5 w-3.5" />Try again</button>
    </div>
  );
}

export function StatusBadge({ status }) {
  const value = String(status || 'unknown').toUpperCase();
  const tone = value === 'PAID' || value === 'SUCCESS' ? 'bg-[#e5f3e5] text-[#25644f]'
    : value === 'PENDING' || value === 'CREATED' ? 'bg-[#fff4dd] text-[#916c2f]'
      : value === 'EXPIRED' || value === 'FAILED' ? 'bg-[#f8e9e5] text-[#a25040]'
        : 'bg-[#eef1ed] text-[#697970]';
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-bold tracking-[.08em] ${tone}`}>{value}</span>;
}

export function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
}

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: options.dateStyle || 'medium', ...(options.time ? { timeStyle: 'short' } : {}) }).format(date);
}

export function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages < 2) return <div className="border-t border-[#edf0eb] px-5 py-3 text-[11px] text-[#84928a]">{total ?? 0} records</div>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0eb] px-5 py-3">
      <p className="text-[11px] text-[#84928a]">{total} records · Page {page} of {pages}</p>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border border-[#e1e8e1] px-3 py-2 text-xs font-semibold text-[#426357] disabled:opacity-40">Previous</button>
        <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-lg border border-[#e1e8e1] px-3 py-2 text-xs font-semibold text-[#426357] disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

export function ScreenReaderNavText({ children }) {
  return <span className="sr-only">{children}</span>;
}
