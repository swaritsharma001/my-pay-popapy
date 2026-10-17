import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileCode2,
  KeyRound,
  Link2,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  Webhook,
  WalletCards,
  X,
} from 'lucide-react';
import {
  claimUnmatched,
  disconnectGmail,
  getDashboardOrders,
  getDashboardStats,
  getGmailConnectUrl,
  getPayments,
  getUnmatched,
  getWebhookLogs,
  regenerateKeys,
  retryWebhook,
  updateAllowedSenders,
  updateUpi,
  updateWebhook,
} from './api.js';
import {
  EmptyState,
  ErrorState,
  formatDate,
  formatMoney,
  Notice,
  PageHeading,
  Pagination,
  Panel,
  PanelTitle,
  queueCredentials,
  StatusBadge,
  useMerchant,
} from './MerchantShell.jsx';

function Spinner({ small = false }) {
  return <span className={`${small ? 'h-4 w-4 border-2' : 'h-5 w-5 border-[2.5px]'} inline-block animate-spin rounded-full border-[#c9d7cd] border-t-[#126b58]`} aria-label="Loading" />;
}

function TableLoading({ columns = 4 }) {
  return (
    <div className="space-y-3 p-5 sm:p-6" aria-label="Loading records">
      {Array.from({ length: 5 }, (_, row) => <div key={row} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }, (_, col) => <div key={col} className="skeleton h-9 rounded-lg" />)}
      </div>)}
    </div>
  );
}

function StatTile({ label, value, caption, icon: Icon, accent = false }) {
  return (
    <div className={`relative overflow-hidden rounded-[20px] border p-5 sm:p-6 ${accent ? 'border-[#174e41] bg-[#174e41] text-white' : 'border-[#e1e8e1] bg-[#fffefa] text-[#142e2b]'} panel-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold ${accent ? 'text-[#bdd2c5]' : 'text-[#7b8b82]'}`}>{label}</p>
          <p className={`mt-3 font-[var(--font-display)] text-[30px] font-semibold leading-none tracking-[-1.4px] tabular-nums sm:text-[34px] ${accent ? 'text-white' : 'text-[#173a31]'}`}>{value}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] ${accent ? 'bg-[#c7e8a8] text-[#174e41]' : 'bg-[#edf4eb] text-[#4b8068]'}`}><Icon className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
      </div>
      <p className={`mt-4 text-[11px] ${accent ? 'text-[#bdd2c5]' : 'text-[#8a9890]'}`}>{caption}</p>
      {accent && <div className="absolute -bottom-10 -right-4 h-32 w-32 rounded-full border border-white/10" />}
    </div>
  );
}

function OnboardingCard({ merchant }) {
  const tasks = [
    { label: 'Add your receiving UPI ID', done: Boolean(merchant.upiId), to: '/settings', icon: Store },
    { label: 'Connect a FamApp payment inbox', done: Boolean(merchant.gmail?.connected), to: '/settings', icon: Mail },
    { label: 'Add an allowed sender', done: Boolean(merchant.allowedSenders?.length), to: '/settings', icon: ShieldCheck },
  ];
  const complete = tasks.filter((task) => task.done).length;
  if (complete === tasks.length) return null;
  return (
    <Panel className="overflow-hidden">
      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#eaf3e5] text-[#568265]"><CheckCircle2 className="h-4 w-4" /></span>
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#668275]">First steps · {complete} of {tasks.length}</p>
          </div>
          <h2 className="mt-3 font-[var(--font-display)] text-[20px] font-semibold tracking-[-.7px] text-[#183a31]">Let’s get your collection flow ready.</h2>
          <p className="mt-1 text-xs text-[#809087]">Complete these essentials before sending your first payment request.</p>
        </div>
        <div className="flex flex-col gap-1.5 sm:min-w-[280px]">
          {tasks.map(({ label, done, to, icon: Icon }) => (
            <Link key={label} to={to} className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs hover:bg-[#f4f7f1]">
              <span className={`grid h-6 w-6 place-items-center rounded-lg ${done ? 'bg-[#e4f1e2] text-[#397458]' : 'bg-[#f0f2ed] text-[#8c9991]'}`}>{done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}</span>
              <span className={`flex-1 font-semibold ${done ? 'text-[#87958c] line-through decoration-[#bac7bd]' : 'text-[#38594d]'}`}>{label}</span>
              {!done && <ArrowRight className="h-3.5 w-3.5 text-[#9aa89f] transition group-hover:translate-x-0.5 group-hover:text-[#126b58]" />}
            </Link>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export function DashboardPage() {
  const { merchant } = useMerchant();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const connected = searchParams.get('gmail') === 'connected';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getDashboardStats()
      .then((result) => { if (active) setStats(result); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Dashboard statistics could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retryKey]);

  useEffect(() => {
    if (!connected) return;
    const next = new URLSearchParams(searchParams);
    next.delete('gmail');
    setSearchParams(next, { replace: true });
  }, [connected, searchParams, setSearchParams]);

  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), []);
  const recent = stats?.recentPayments || [];

  return (
    <div className="page-enter">
      {connected && <Notice>Gmail is connected. You can edit the allowed sender list in settings.</Notice>}
      <PageHeading eyebrow={dateLabel} title={`Good day, ${merchant.name.split(' ')[0]}.`} detail="Your collection desk, clear at a glance." action={<Link to="/integration" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#126b58] px-4 text-xs font-bold text-white transition hover:bg-[#0b4f42]"><FileCode2 className="h-4 w-4" />Integration guide</Link>} />
      <div className="space-y-5">
        <OnboardingCard merchant={merchant} />
        {error ? <ErrorState message={error} onRetry={() => setRetryKey((key) => key + 1)} /> : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><div className="skeleton h-[145px] rounded-[20px]" /><div className="skeleton h-[145px] rounded-[20px]" /><div className="skeleton h-[145px] rounded-[20px]" /></div>
        ) : stats ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile accent label="Collected today" value={formatMoney(stats.todayCollection)} caption={`${Number(stats.todayPaymentCount || 0)} confirmed ${Number(stats.todayPaymentCount || 0) === 1 ? 'payment' : 'payments'} today`} icon={ArrowDownRight} />
            <StatTile label="Success rate today" value={`${Number(stats.successRate || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`} caption="Paid orders compared with orders created today" icon={Activity} />
            <StatTile label="Payments received" value={String(Number(stats.todayPaymentCount || 0))} caption="Based on confirmed UPI notifications today" icon={CheckCircle2} />
          </div>
        ) : null}

        <Panel className="overflow-hidden">
          <PanelTitle title="Recent payments" detail="Latest confirmed transfers to your UPI account" action={<Link to="/payments" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#126b58] hover:underline">All payments <ArrowUpRight className="h-3.5 w-3.5" /></Link>} />
          {loading ? <TableLoading columns={4} /> : error ? <div className="p-5"><p className="text-xs text-[#8b7770]">Recent payments are unavailable until the dashboard refresh succeeds.</p></div> : recent.length ? (
            <div className="divide-y divide-[#edf0eb]">
              {recent.map((payment) => (
                <div key={payment.payment_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f3e6] text-[#3f795e]"><CheckCircle2 className="h-4 w-4" /></span>
                  <div className="min-w-[130px] flex-1"><p className="font-mono text-xs font-semibold text-[#294b40]">{payment.order_id}</p><p className="mt-1 text-[10px] text-[#8a9890]">UTR {payment.utr || '—'} · {formatDate(payment.receivedAt, { time: true })}</p></div>
                  <p className="font-[var(--font-display)] text-sm font-bold tabular-nums text-[#1e493a]">{formatMoney(payment.amount)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={WalletCards} title="No payments received yet" detail="Once a UPI transfer matches an order, it will appear here. Your confirmed collection total is available above." action={<Link to="/integration" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#126b58]">Set up an integration <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          )}
        </Panel>
      </div>
    </div>
  );
}

const ORDER_FILTERS = [
  ['ALL', 'All orders'],
  ['CREATED', 'Created'],
  ['PENDING', 'Pending'],
  ['PAID', 'Paid'],
  ['EXPIRED', 'Expired'],
];

export function OrdersPage() {
  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getDashboardOrders({ page, limit: 25, status: filter === 'ALL' ? '' : filter })
      .then((value) => { if (active) setResult(value); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Orders could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, page, retryKey]);

  function changeFilter(value) { setFilter(value); setPage(1); }
  const orders = result?.orders || [];

  return (
    <div className="page-enter">
      <PageHeading eyebrow="Collection activity" title="Orders" detail="A live ledger of the payment requests created for your business." />
      <Panel className="overflow-hidden">
        <PanelTitle title="Order ledger" detail={result ? `${result.total} ${result.total === 1 ? 'order' : 'orders'} in this view` : 'Most recent payment requests'} />
        <div className="flex gap-2 overflow-x-auto border-b border-[#edf0eb] px-4 py-3 sm:px-5">
          {ORDER_FILTERS.map(([value, label]) => <button key={value} type="button" onClick={() => changeFilter(value)} className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold transition ${filter === value ? 'bg-[#174e41] text-white' : 'bg-[#f1f4ef] text-[#71827a] hover:bg-[#e8eee6]'}`}>{label}</button>)}
        </div>
        {loading ? <TableLoading columns={5} /> : error ? <div className="p-5"><ErrorState message={error} onRetry={() => setRetryKey((key) => key + 1)} /></div> : !orders.length ? (
          <EmptyState icon={Clipboard} title={filter === 'ALL' ? 'No orders yet' : `No ${filter.toLowerCase()} orders`} detail={filter === 'ALL' ? 'Orders created with your PopPay secret key will show up here.' : 'Try another status filter to see a different set of orders.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead><tr className="bg-[#f8faf6] text-[9px] font-bold uppercase tracking-[.13em] text-[#84928a]"><th className="px-5 py-3.5">Order / receipt</th><th className="px-4 py-3.5">Base amount</th><th className="px-4 py-3.5">Payable</th><th className="px-4 py-3.5">Expires</th><th className="px-5 py-3.5">Status</th></tr></thead>
              <tbody className="divide-y divide-[#edf0eb]">
                {orders.map((order) => <tr key={order.order_id} className="hover:bg-[#fbfcf9]">
                  <td className="px-5 py-4"><p className="font-mono text-xs font-semibold text-[#294b40]">{order.order_id}</p><p className="mt-1 max-w-[210px] truncate text-[10px] text-[#84928a]">{order.receipt || 'No receipt reference'}</p></td>
                  <td className="px-4 py-4 text-xs tabular-nums text-[#6e8076]">{formatMoney(order.baseAmount)}</td>
                  <td className="px-4 py-4 text-xs font-bold tabular-nums text-[#24483a]">{formatMoney(order.payableAmount)}</td>
                  <td className="px-4 py-4 text-[11px] text-[#7f8c84]">{formatDate(order.expiresAt, { time: true })}</td>
                  <td className="px-5 py-4"><StatusBadge status={order.status} /></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && result && <Pagination page={result.page || page} pages={result.pages} total={result.total} onChange={setPage} />}
      </Panel>
    </div>
  );
}

export function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getPayments({ page, limit: 25 })
      .then((value) => { if (active) setResult(value); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Payments could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, retryKey]);

  const payments = result?.payments || [];
  return (
    <div className="page-enter">
      <PageHeading eyebrow="Confirmed transfers" title="Payments" detail="Payments are recorded when an incoming UPI transfer matches an order." />
      <Panel className="overflow-hidden">
        <PanelTitle title="Payment history" detail={result ? `${result.total} confirmed ${result.total === 1 ? 'payment' : 'payments'}` : 'Most recent first'} />
        {loading ? <TableLoading columns={4} /> : error ? <div className="p-5"><ErrorState message={error} onRetry={() => setRetryKey((key) => key + 1)} /></div> : !payments.length ? (
          <EmptyState icon={WalletCards} title="No confirmed payments" detail="A payment will appear here after a matching UPI transfer is confirmed." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead><tr className="bg-[#f8faf6] text-[9px] font-bold uppercase tracking-[.13em] text-[#84928a]"><th className="px-5 py-3.5">Payment</th><th className="px-4 py-3.5">Order</th><th className="px-4 py-3.5">UTR</th><th className="px-4 py-3.5">Received</th><th className="px-5 py-3.5 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-[#edf0eb]">
                {payments.map((payment) => <tr key={payment.payment_id} className="hover:bg-[#fbfcf9]">
                  <td className="px-5 py-4 font-mono text-[11px] text-[#59756a]">{payment.payment_id}</td>
                  <td className="px-4 py-4 font-mono text-xs font-semibold text-[#294b40]">{payment.order_id}</td>
                  <td className="px-4 py-4 font-mono text-xs text-[#71817b]">{payment.utr || '—'}</td>
                  <td className="px-4 py-4 text-[11px] text-[#71817b]">{formatDate(payment.receivedAt, { time: true })}</td>
                  <td className="px-5 py-4 text-right text-xs font-bold tabular-nums text-[#24483a]">{formatMoney(payment.amount)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && result && <Pagination page={result.page || page} pages={result.pages} total={result.total} onChange={setPage} />}
      </Panel>
    </div>
  );
}

function orderFitsPayment(order, payment) {
  const sameAmount = Number(order.payableAmount) === Number(payment.amount);
  const receivedAt = new Date(payment.receivedAt).getTime();
  const createdAt = new Date(order.createdAt).getTime();
  const expiresAt = new Date(order.expiresAt).getTime();
  return sameAmount && Number.isFinite(receivedAt) && Number.isFinite(createdAt) && Number.isFinite(expiresAt) && receivedAt >= createdAt && receivedAt <= expiresAt;
}

export function UnmatchedPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [selections, setSelections] = useState({});
  const [claiming, setClaiming] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getUnmatched({ page: 1, limit: 100 })
      .then((result) => { if (active) setData(result); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Unmatched payments could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retryKey]);

  async function claim(payment) {
    const orderId = selections[payment.id];
    if (!orderId) return;
    setClaiming(payment.id);
    setClaimError('');
    setClaimSuccess('');
    try {
      await claimUnmatched(payment.id, orderId);
      setClaimSuccess(`Payment ${payment.utr || payment.id} has been matched to ${orderId}.`);
      setData((current) => current ? {
        ...current,
        payments: current.payments.filter((item) => item.id !== payment.id),
        pendingOrders: current.pendingOrders.filter((item) => item.order_id !== orderId),
        total: Math.max(0, Number(current.total || 0) - 1),
      } : current);
      setSelections((current) => { const next = { ...current }; delete next[payment.id]; return next; });
      try {
        const latest = await getUnmatched({ page: 1, limit: 100 });
        setData(latest);
      } catch {
        // The successful claim remains reflected locally if refreshing the list fails.
      }
    } catch (requestError) {
      setClaimError(requestError.message || 'This payment could not be matched to that order.');
    } finally {
      setClaiming('');
    }
  }

  const payments = data?.payments || [];
  const pendingOrders = data?.pendingOrders || [];

  return (
    <div className="page-enter">
      <PageHeading eyebrow="Payment reconciliation" title="Needs matching" detail="Match an incoming transfer to the order with the same amount and payment window." />
      {claimSuccess && <div className="mb-4"><Notice onClose={() => setClaimSuccess('')}>{claimSuccess}</Notice></div>}
      {claimError && <div className="mb-4"><Notice tone="error" onClose={() => setClaimError('')}>{claimError}</Notice></div>}
      <Panel className="overflow-hidden">
        <PanelTitle title="Unmatched transfers" detail={data ? `${data.total} waiting for a matching order` : 'Review each transfer before matching'} />
        {loading ? <TableLoading columns={4} /> : error ? <div className="p-5"><ErrorState message={error} onRetry={() => setRetryKey((key) => key + 1)} /></div> : !payments.length ? (
          <EmptyState icon={CheckCircle2} title="Nothing needs matching" detail="When an allowed FamApp sender reports a transfer that does not match an order, it will be listed here." />
        ) : (
          <div className="divide-y divide-[#edf0eb]">
            {payments.map((payment) => {
              const candidates = pendingOrders.filter((order) => orderFitsPayment(order, payment));
              const selected = selections[payment.id] || '';
              return (
                <article key={payment.id} className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(170px,1fr)_minmax(270px,1.1fr)_auto] sm:items-center sm:px-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-[#fbefdc] text-[#9b7133]"><ArrowDownRight className="h-4 w-4" /></span><span className="font-[var(--font-display)] text-[18px] font-semibold tracking-[-.4px] text-[#23483c]">{formatMoney(payment.amount)}</span></div>
                    <p className="mt-2 font-mono text-[11px] text-[#5a766b]">UTR {payment.utr || '—'}</p>
                    <p className="mt-1 text-[10px] text-[#8a9890]">Received {formatDate(payment.receivedAt, { time: true })}</p>
                  </div>
                  <div>
                    <label htmlFor={`match-${payment.id}`} className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.12em] text-[#74867b]">Choose matching order</label>
                    <select id={`match-${payment.id}`} value={selected} onChange={(event) => setSelections((current) => ({ ...current, [payment.id]: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dce5dc] bg-[#fffefa] px-3 text-xs text-[#294b40] outline-none focus:border-[#5b9b7b] focus:ring-4 focus:ring-[#126b58]/10">
                      <option value="">{candidates.length ? 'Select an order' : 'No amount and time match found'}</option>
                      {candidates.map((order) => <option key={order.order_id} value={order.order_id}>{order.receipt || order.order_id} · {formatMoney(order.payableAmount)} · {order.order_id}</option>)}
                    </select>
                    {candidates.length === 0 && <p className="mt-1.5 text-[10px] leading-4 text-[#9a6b43]">Only orders with the same amount and valid payment window can be claimed.</p>}
                  </div>
                  <button type="button" disabled={!selected || claiming === payment.id} onClick={() => claim(payment)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#174e41] px-4 text-xs font-bold text-white transition hover:bg-[#0b4f42] disabled:cursor-not-allowed disabled:opacity-45">
                    {claiming === payment.id ? <Spinner small /> : <Link2 className="h-4 w-4" />}Match payment
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
      {data && data.payments?.length > 0 && <p className="mt-3 flex items-center gap-2 px-1 text-[10px] leading-5 text-[#89968e]"><Clock3 className="h-3.5 w-3.5 shrink-0" />A successful match confirms the order and can queue your configured webhook.</p>}
    </div>
  );
}

function SettingsCard({ title, detail, icon: Icon, children }) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-[#edf0eb] px-5 py-4 sm:px-6">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#edf4eb] text-[#52796a]"><Icon className="h-4 w-4" /></span>
        <div><h2 className="text-sm font-bold text-[#203d36]">{title}</h2><p className="mt-1 text-xs leading-5 text-[#84928a]">{detail}</p></div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </Panel>
  );
}

function WebhookLogList({ logs, loading, error, retryLog, retrying }) {
  if (loading) return <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="skeleton h-20 rounded-xl" />)}</div>;
  if (error) return <p className="text-xs text-[#9a503d]">{error}</p>;
  if (!logs.length) return <div className="rounded-xl bg-[#f8faf6] px-4 py-5 text-center text-xs text-[#84928a]">No webhook deliveries have been recorded.</div>;

  return (
    <div className="space-y-2.5">
      {logs.map((log) => {
        const logId = log._id || log.id;
        const succeeded = Number(log.responseStatus) >= 200 && Number(log.responseStatus) < 300;
        return (
          <details key={logId} className="group rounded-xl border border-[#e3eae2] bg-[#fbfcf9]">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-3.5">
              <span className={`h-2 w-2 rounded-full ${succeeded ? 'bg-[#4c9b72]' : 'bg-[#d39a50]'}`} />
              <span className="min-w-[120px] flex-1 font-mono text-[11px] font-semibold text-[#355a4d]">{log.orderId}</span>
              <span className="text-[10px] text-[#839087]">{formatDate(log.updatedAt || log.createdAt, { time: true })}</span>
              <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${succeeded ? 'bg-[#e5f3e5] text-[#25644f]' : 'bg-[#fff1dc] text-[#966a2b]'}`}>{log.responseStatus || 'QUEUED'}</span>
              <span className="text-[10px] text-[#71817b]">{log.attempts ?? 0} attempts</span>
              <span className="text-[10px] text-[#819087] group-open:hidden">Details</span>
            </summary>
            <div className="border-t border-[#e8eee7] px-3.5 py-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#87968d]">Next retry</p><p className="mt-1 text-[11px] text-[#4d6d5e]">{formatDate(log.nextRetryAt, { time: true })}</p></div>
                <div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#87968d]">Attempts recorded</p><p className="mt-1 text-[11px] text-[#4d6d5e]">{log.attemptHistory?.length || 0}</p></div>
              </div>
              {log.attemptHistory?.length > 0 && <div className="mt-3 space-y-1.5">
                {log.attemptHistory.map((attempt, index) => <p key={`${attempt.attemptedAt}-${index}`} className="text-[10px] text-[#7c8b82]">{formatDate(attempt.attemptedAt, { time: true })} · response {attempt.responseStatus || 'no response'}</p>)}
              </div>}
              <pre className="mt-3 max-h-44 overflow-auto rounded-lg bg-[#f0f4ee] p-3 font-mono text-[10px] leading-4 text-[#557265]">{JSON.stringify(log.payload, null, 2)}</pre>
              <button type="button" disabled={retrying === logId} onClick={() => retryLog(logId)} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dbe6da] bg-white px-3 text-[10px] font-bold text-[#39725a] hover:bg-[#f0f6ed] disabled:opacity-50">
                {retrying === logId ? <Spinner small /> : <RefreshCw className="h-3.5 w-3.5" />}Retry delivery
              </button>
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function SettingsPage() {
  const { merchant, setMerchant, refreshMerchant } = useMerchant();
  const [upiId, setUpiId] = useState(merchant.upiId || '');
  const [senders, setSenders] = useState(merchant.allowedSenders || []);
  const [senderInput, setSenderInput] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(merchant.webhookUrl || '');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState('');
  const [retrying, setRetrying] = useState('');
  const [rotateOpen, setRotateOpen] = useState(false);

  useEffect(() => {
    setUpiId(merchant.upiId || '');
    setSenders(merchant.allowedSenders || []);
    setWebhookUrl(merchant.webhookUrl || '');
  }, [merchant]);

  async function loadLogs() {
    setLogsLoading(true);
    setLogsError('');
    try {
      const result = await getWebhookLogs();
      setLogs(result.logs || []);
    } catch (error) {
      setLogsError(error.message || 'Webhook history could not be loaded.');
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => { loadLogs(); }, []);

  async function saveUpi(event) {
    event.preventDefault();
    setBusy('upi'); setMessage(null);
    try {
      const result = await updateUpi(upiId.trim());
      setMerchant((current) => ({ ...current, upiId: result.upiId }));
      setMessage({ tone: 'success', text: 'Receiving UPI ID updated.' });
    } catch (error) { setMessage({ tone: 'error', text: error.message || 'Could not update your UPI ID.' }); }
    finally { setBusy(''); }
  }

  async function connectGmail() {
    setBusy('gmail'); setMessage(null);
    try {
      const result = await getGmailConnectUrl();
      const destination = new URL(result.url, window.location.origin);
      if (destination.protocol !== 'https:' && destination.origin !== window.location.origin) throw new Error('The Gmail connection URL was not secure.');
      window.location.assign(destination.href);
    } catch (error) { setMessage({ tone: 'error', text: error.message || 'Could not start Gmail connection.' }); setBusy(''); }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Gmail? PopPay will stop checking payment notifications from this inbox.')) return;
    setBusy('gmail'); setMessage(null);
    try {
      await disconnectGmail();
      await refreshMerchant();
      setMessage({ tone: 'success', text: 'Gmail disconnected. The stored authorization token has been removed.' });
    } catch (error) { setMessage({ tone: 'error', text: error.message || 'Could not disconnect Gmail.' }); }
    finally { setBusy(''); }
  }

  function addSender(event) {
    event.preventDefault();
    const value = senderInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setMessage({ tone: 'error', text: 'Enter a valid sender email address.' });
      return;
    }
    if (senders.includes(value)) {
      setMessage({ tone: 'warning', text: 'That sender is already on the list.' });
      return;
    }
    if (senders.length >= 10) {
      setMessage({ tone: 'warning', text: 'You can allow up to 10 sender addresses.' });
      return;
    }
    setSenders((current) => [...current, value]);
    setSenderInput('');
    setMessage(null);
  }

  async function saveSenders() {
    if (!senders.length) {
      setMessage({ tone: 'error', text: 'Keep at least one allowed sender.' });
      return;
    }
    setBusy('senders'); setMessage(null);
    try {
      const result = await updateAllowedSenders(senders);
      setSenders(result.allowedSenders);
      setMerchant((current) => ({ ...current, allowedSenders: result.allowedSenders }));
      setMessage({ tone: 'success', text: 'Allowed sender list saved.' });
    } catch (error) { setMessage({ tone: 'error', text: error.message || 'Could not save allowed senders.' }); }
    finally { setBusy(''); }
  }

  async function saveWebhook(event) {
    event.preventDefault();
    setBusy('webhook'); setMessage(null);
    try {
      const result = await updateWebhook(webhookUrl.trim());
      setWebhookUrl(result.webhookUrl || '');
      setMerchant((current) => ({ ...current, webhookUrl: result.webhookUrl }));
      setMessage({ tone: 'success', text: 'Webhook destination saved.' });
    } catch (error) { setMessage({ tone: 'error', text: error.message || 'Could not save webhook destination.' }); }
    finally { setBusy(''); }
  }

  async function rotateKeys() {
    setBusy('rotate'); setMessage(null);
    try {
      const result = await regenerateKeys();
      queueCredentials(result.credentials);
      await refreshMerchant();
      setMessage({ tone: 'success', text: 'New credentials are ready. Save them from the one-time credentials window.' });
      setRotateOpen(false);
    } catch (error) { setMessage({ tone: 'error', text: error.message || 'Could not rotate credentials.' }); }
    finally { setBusy(''); }
  }

  async function retryLog(id) {
    setRetrying(id);
    setMessage(null);
    try {
      await retryWebhook(id);
      await loadLogs();
      setMessage({ tone: 'success', text: 'Webhook delivery queued for retry.' });
    } catch (error) { setMessage({ tone: 'error', text: error.message || 'Could not queue webhook retry.' }); }
    finally { setRetrying(''); }
  }

  return (
    <div className="page-enter">
      <PageHeading eyebrow="Merchant controls" title="Settings" detail="Manage where payments land, how notifications are read, and how your system is notified." />
      {message && <div className="mb-5"><Notice tone={message.tone} onClose={() => setMessage(null)}>{message.text}</Notice></div>}
      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsCard title="Receiving account" detail="UPI transfers settle directly to this account." icon={Store}>
          <form onSubmit={saveUpi} className="space-y-3">
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#466358]">Merchant UPI ID</span><input required minLength="4" maxLength="320" value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="business@bank" className="h-11 w-full rounded-xl border border-[#dce5dc] bg-white px-3.5 font-mono text-sm text-[#294b40] outline-none focus:border-[#5b9b7b] focus:ring-4 focus:ring-[#126b58]/10" /></label>
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] leading-4 text-[#8a9890]">New checkouts will direct payment to this UPI address.</p><button disabled={busy === 'upi'} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#174e41] px-4 text-xs font-bold text-white hover:bg-[#0b4f42] disabled:opacity-50">{busy === 'upi' ? <Spinner small /> : <Check className="h-3.5 w-3.5" />}Save UPI ID</button></div>
          </form>
        </SettingsCard>

        <SettingsCard title="Gmail payment inbox" detail="Read eligible FamApp notifications to confirm incoming transfers." icon={Mail}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[15px] ${merchant.gmail?.connected ? 'bg-[#e5f3e5] text-[#367556]' : 'bg-[#f1f3ee] text-[#829087]'}`}><Mail className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#294b40]">{merchant.gmail?.connected ? 'Connected' : 'Not connected'}</p><p className="mt-1 break-all text-xs text-[#84928a]">{merchant.gmail?.email || 'Connect the inbox that receives FamApp transfer emails.'}</p></div>
            {merchant.gmail?.connected ? <button type="button" disabled={busy === 'gmail'} onClick={disconnect} className="min-h-10 rounded-lg border border-[#e4d6d1] px-3.5 text-xs font-bold text-[#985746] hover:bg-[#fff3ef] disabled:opacity-50">{busy === 'gmail' ? 'Disconnecting…' : 'Disconnect'}</button> : <button type="button" disabled={busy === 'gmail'} onClick={connectGmail} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#174e41] px-4 text-xs font-bold text-white hover:bg-[#0b4f42] disabled:opacity-50">{busy === 'gmail' ? <Spinner small /> : <ExternalLink className="h-3.5 w-3.5" />}Connect Gmail</button>}
          </div>
          <p className="mt-4 rounded-lg bg-[#f5f7f2] px-3 py-2.5 text-[10px] leading-4 text-[#829087]">PopPay checks sender and Authentication-Results first. Message bodies are retrieved only for allowed senders with FamApp DKIM pass.</p>
        </SettingsCard>

        <SettingsCard title="Allowed senders" detail="Only these sender addresses can be considered for payment matching. Up to 10." icon={ShieldCheck}>
          <div className="mb-4 flex flex-wrap gap-2">
            {senders.map((sender) => <span key={sender} className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#dce8dc] bg-[#f5f8f2] py-1 pl-3 pr-1.5 text-[11px] font-medium text-[#436557]"><span className="max-w-[220px] truncate">{sender}</span><button type="button" onClick={() => setSenders((current) => current.filter((value) => value !== sender))} aria-label={`Remove ${sender}`} className="grid h-6 w-6 place-items-center rounded-full text-[#789087] hover:bg-[#e7eee4] hover:text-[#984d3c]"><X className="h-3.5 w-3.5" /></button></span>)}
            {!senders.length && <p className="text-xs text-[#9a6b43]">No senders are listed. Add at least one before saving.</p>}
          </div>
          <form onSubmit={addSender} className="flex flex-col gap-2 sm:flex-row">
            <input type="email" value={senderInput} onChange={(event) => setSenderInput(event.target.value)} maxLength="254" placeholder="alerts@famapp.in" className="h-10 min-w-0 flex-1 rounded-lg border border-[#dce5dc] bg-white px-3 text-xs outline-none focus:border-[#5b9b7b] focus:ring-4 focus:ring-[#126b58]/10" />
            <button type="submit" disabled={!senderInput.trim() || senders.length >= 10} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#dce5dc] px-3.5 text-xs font-bold text-[#476b5b] hover:bg-[#f2f6ef] disabled:opacity-45"><Plus className="h-3.5 w-3.5" />Add sender</button>
          </form>
          <div className="mt-4 flex justify-end"><button type="button" onClick={saveSenders} disabled={busy === 'senders'} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#174e41] px-4 text-xs font-bold text-white hover:bg-[#0b4f42] disabled:opacity-50">{busy === 'senders' ? <Spinner small /> : <Check className="h-3.5 w-3.5" />}Save senders</button></div>
        </SettingsCard>

        <SettingsCard title="Webhook destination" detail="Get a signed payment.success event after an order is confirmed." icon={Webhook}>
          <form onSubmit={saveWebhook} className="space-y-3">
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#466358]">HTTPS endpoint</span><input type="url" required pattern="https://.*" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://yourdomain.com/payments/poppay" className="h-11 w-full rounded-xl border border-[#dce5dc] bg-white px-3.5 text-sm text-[#294b40] outline-none focus:border-[#5b9b7b] focus:ring-4 focus:ring-[#126b58]/10" /></label>
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] leading-4 text-[#8a9890]">Use HTTPS. Requests include a signature; never expose your webhook secret.</p><button disabled={busy === 'webhook'} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#174e41] px-4 text-xs font-bold text-white hover:bg-[#0b4f42] disabled:opacity-50">{busy === 'webhook' ? <Spinner small /> : <Check className="h-3.5 w-3.5" />}Save URL</button></div>
          </form>
        </SettingsCard>

        <SettingsCard title="API credentials" detail="Your public key identifies the merchant. Secret values are never retrievable." icon={KeyRound}>
          <div className="rounded-xl border border-[#e3eae2] bg-[#f7f9f5] p-3.5">
            <p className="text-[9px] font-bold uppercase tracking-[.13em] text-[#87968d]">Public key</p>
            <code className="mt-1.5 block break-all font-mono text-xs text-[#355a4d]">{merchant.publicKey || 'Not available'}</code>
          </div>
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#f0dfb7] bg-[#fff8e8] p-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#775e32]">Rotate all credentials</p><p className="mt-1 text-[10px] leading-4 text-[#8d7549]">This immediately invalidates the previous API and signing keys.</p></div>
            <button type="button" onClick={() => setRotateOpen(true)} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#e4d19d] bg-white/70 px-3 text-[10px] font-bold text-[#805e23] hover:bg-white"><RefreshCw className="h-3.5 w-3.5" />Rotate keys</button>
          </div>
        </SettingsCard>

        <SettingsCard title="Webhook attempts" detail="Recent deliveries, responses, and scheduled retries." icon={Activity}>
          <WebhookLogList logs={logs} loading={logsLoading} error={logsError} retryLog={retryLog} retrying={retrying} />
          {!logsLoading && !logsError && <button type="button" onClick={loadLogs} className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-[#47715e] hover:underline"><RefreshCw className="h-3 w-3" />Refresh attempts</button>}
        </SettingsCard>
      </div>

      {rotateOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#102d27]/65 p-0 backdrop-blur-[3px] sm:items-center sm:p-5" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="rotate-title" className="w-full max-w-[460px] rounded-t-[24px] bg-[#fffefa] p-5 sm:rounded-[24px] sm:p-6">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[#fff2dd] text-[#9a712d]"><KeyRound className="h-5 w-5" /></div>
          <h2 id="rotate-title" className="font-[var(--font-display)] text-xl font-semibold tracking-[-.7px] text-[#142e2b]">Replace all credentials?</h2>
          <p className="mt-2 text-xs leading-5 text-[#71817b]">Your current secret key, signing secret, and webhook secret will stop working immediately. You’ll need to update your integration and save the replacement values shown once.</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setRotateOpen(false)} className="min-h-10 rounded-lg border border-[#dce5dc] px-4 text-xs font-bold text-[#557367]">Keep current keys</button>
            <button type="button" disabled={busy === 'rotate'} onClick={rotateKeys} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#a35b43] px-4 text-xs font-bold text-white hover:bg-[#8e4d39] disabled:opacity-60">{busy === 'rotate' ? <Spinner small /> : <RefreshCw className="h-3.5 w-3.5" />}Replace credentials</button>
          </div>
        </section>
      </div>}
    </div>
  );
}

const NODE_SNIPPET = `const response = await fetch(
  \`\${process.env.POPPAY_API_BASE_URL}/api/v1/orders\`,
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.POPPAY_SECRET_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: "248.00",
      receipt: "counter-order-1042",
      redirectUrl: "https://shop.example/thanks",
    }),
  }
);

if (!response.ok) throw new Error(await response.text());
const order = await response.json();
const checkoutUrl = new URL(
  order.checkoutUrl,
  process.env.POPPAY_API_BASE_URL
).href;

// Send checkoutUrl to your customer.`;

const CURL_SNIPPET = `curl -X POST "$POPPAY_API_BASE_URL/api/v1/orders" \\
  -H "Authorization: Bearer $POPPAY_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "248.00",
    "receipt": "counter-order-1042",
    "redirectUrl": "https://shop.example/thanks"
  }'`;

export function IntegrationPage() {
  const { merchant } = useMerchant();
  const [language, setLanguage] = useState('node');
  const [copied, setCopied] = useState(false);
  const code = language === 'node' ? NODE_SNIPPET : CURL_SNIPPET;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="page-enter">
      <PageHeading eyebrow="Developer setup" title="Integration" detail="Create a payment request from your server, then send the returned hosted checkout link to your customer." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,.75fr)]">
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0eb] px-5 py-4 sm:px-6">
            <div><h2 className="text-sm font-bold text-[#203d36]">Create an order</h2><p className="mt-1 text-xs text-[#84928a]">Use your secret key on your server only.</p></div>
            <div className="flex rounded-lg bg-[#f0f3ed] p-1">
              <button type="button" onClick={() => setLanguage('node')} className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${language === 'node' ? 'bg-white text-[#275a46] shadow-sm' : 'text-[#84928a]'}`}>Node.js</button>
              <button type="button" onClick={() => setLanguage('curl')} className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${language === 'curl' ? 'bg-white text-[#275a46] shadow-sm' : 'text-[#84928a]'}`}>cURL</button>
            </div>
          </div>
          <div className="relative bg-[#163a32] p-4 sm:p-6">
            <button type="button" onClick={copy} className="absolute right-3 top-3 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[.07] px-2.5 text-[10px] font-bold text-[#d6e5d9] hover:bg-white/[.13]">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy code'}</button>
            <pre className="overflow-x-auto pt-9 font-mono text-[11px] leading-[1.8] text-[#d5e6d9] sm:text-xs"><code>{code}</code></pre>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
            {[['01', 'Create server-side', 'Keep the secret key in an environment variable.'], ['02', 'Send the checkout URL', 'Use the returned checkoutUrl as your customer’s payment link.'], ['03', 'Confirm the webhook', 'Verify the signature before changing your order state.']].map(([number, title, detail]) => <div key={number} className="rounded-xl bg-[#f6f8f3] p-3.5"><p className="font-mono text-[10px] font-bold text-[#84a08e]">{number}</p><p className="mt-2 text-xs font-bold text-[#355a4d]">{title}</p><p className="mt-1 text-[10px] leading-4 text-[#84928a]">{detail}</p></div>)}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <PanelTitle title="Account identifiers" detail="Safe to use when identifying this account." />
            <div className="space-y-4 p-5">
              <div><p className="text-[9px] font-bold uppercase tracking-[.13em] text-[#87968d]">Merchant ID</p><code className="mt-1.5 block break-all font-mono text-xs text-[#355a4d]">{merchant.id}</code></div>
              <div><p className="text-[9px] font-bold uppercase tracking-[.13em] text-[#87968d]">Public key</p><code className="mt-1.5 block break-all font-mono text-xs text-[#355a4d]">{merchant.publicKey || 'Not available'}</code></div>
              <Link to="/settings" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#126b58] hover:underline">Manage API credentials <ArrowRight className="h-3 w-3" /></Link>
            </div>
          </Panel>
          <div className="rounded-[20px] border border-[#e8dfc6] bg-[#fff8e8] p-5">
            <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-[#9a712d]"><KeyRound className="h-4 w-4" /></span><div><h2 className="text-xs font-bold text-[#735c33]">Never expose a secret in the browser</h2><p className="mt-1.5 text-[11px] leading-5 text-[#8b754d]">The secret key authorizes order creation. Keep it on a trusted server and never include it in client-side JavaScript or a mobile app bundle.</p></div></div>
          </div>
          <div className="rounded-[20px] border border-[#dce8dc] bg-[#edf5eb] p-5">
            <p className="flex items-center gap-2 text-xs font-bold text-[#426b57]"><Webhook className="h-4 w-4" />Webhook handling</p>
            <p className="mt-2 text-[11px] leading-5 text-[#668271]">PopPay sends <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[10px]">payment.success</code> with order and payment references. Set your HTTPS destination in settings and verify the signature before fulfilling.</p>
            <Link to="/settings" className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-[#126b58] hover:underline">Configure webhook <ArrowRight className="h-3 w-3" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
