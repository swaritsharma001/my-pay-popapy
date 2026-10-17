import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { getCheckoutStatus, getPublicCheckout } from './api.js';

function Icon({ name, className = '' }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (name === 'lock') {
    return <svg {...common}><rect x="4.5" y="10" width="15" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></svg>;
  }
  if (name === 'copy') {
    return <svg {...common}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>;
  }
  if (name === 'arrow') {
    return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  }
  if (name === 'check') {
    return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  }
  if (name === 'clock') {
    return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  }
  if (name === 'refresh') {
    return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.7 9a7 7 0 0 1 11.6-2L20 12M4 12l2.7 5a7 7 0 0 0 11.6-2" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>;
}

function outcomeFromStatus(status) {
  const value = String(status || '').toLowerCase();
  if (/paid|success|complete|captured/.test(value)) return 'success';
  if (/expired|timeout/.test(value)) return 'expired';
  if (/failed|declined|cancelled|canceled/.test(value)) return 'failed';
  return 'waiting';
}

function getParentOrigin() {
  if (window.parent === window) return null;
  try {
    const referrer = new URL(document.referrer);
    if (referrer.protocol !== 'https:' && referrer.protocol !== 'http:') return null;
    if (referrer.origin === 'null') return null;
    return referrer.origin;
  } catch {
    return null;
  }
}

function formatAmount(amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return String(amount ?? '—');
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

function getUpiId(upiLink) {
  try {
    return new URL(upiLink).searchParams.get('pa') || '';
  } catch {
    return '';
  }
}

function PaymentLoader() {
  return (
    <main className="checkout-shell min-h-[100dvh] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-[920px]">
        <div className="mb-7 flex items-center justify-between">
          <div className="h-8 w-28 animate-pulse rounded-lg bg-[#dce5dc]" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-[#e4ebe3]" />
        </div>
        <div className="grid overflow-hidden rounded-[28px] border border-[#e1e8e1] bg-[#fffefa] shadow-[0_24px_70px_rgba(25,61,48,.08)] md:grid-cols-[1fr_360px]">
          <div className="space-y-5 p-6 sm:p-10">
            <div className="h-4 w-32 animate-pulse rounded bg-[#e4ebe3]" />
            <div className="h-10 w-52 animate-pulse rounded bg-[#e4ebe3]" />
            <div className="h-24 w-full animate-pulse rounded-2xl bg-[#f0f3ed]" />
            <div className="h-14 w-full animate-pulse rounded-xl bg-[#e4ebe3]" />
          </div>
          <div className="flex min-h-[360px] items-center justify-center bg-[#f6f8f2] p-8">
            <div className="h-56 w-56 animate-pulse rounded-2xl bg-[#e4ebe3]" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PayCheckout() {
  const { orderId = '' } = useParams();
  const [checkout, setCheckout] = useState(null);
  const [viewState, setViewState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [remainingMs, setRemainingMs] = useState(null);
  const [copied, setCopied] = useState(false);
  const [payment, setPayment] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [redirectIn, setRedirectIn] = useState(3);
  const notifiedRef = useRef(false);
  const copiedTimerRef = useRef(null);
  const upiId = useMemo(() => getUpiId(checkout?.upiLink || ''), [checkout?.upiLink]);

  const notifyParent = useCallback((type, details = {}) => {
    if (notifiedRef.current) return;
    const targetOrigin = getParentOrigin();
    if (!targetOrigin) return;
    const payload = type === 'payment.success'
      ? {
          type,
          order_id: orderId,
          payment_id: details.payment_id ?? null,
          utr: details.utr ?? null,
          signature: details.signature ?? null,
        }
      : { type, order_id: orderId };
    try {
      window.parent.postMessage(payload, targetOrigin);
      notifiedRef.current = true;
    } catch {
      // The checkout remains usable when embedded communication is unavailable.
    }
  }, [orderId]);

  const applyOutcome = useCallback((result) => {
    const outcome = outcomeFromStatus(result?.status);
    if (outcome === 'success') {
      setPayment(result);
      setViewState('success');
      notifyParent('payment.success', result);
    } else if (outcome === 'expired') {
      setViewState('expired');
      notifyParent('payment.failed');
    } else if (outcome === 'failed') {
      setViewState('error');
      setLoadError('This payment could not be completed. Please contact the merchant before trying again.');
      notifyParent('payment.failed');
    }
  }, [notifyParent]);

  useEffect(() => {
    let active = true;
    setViewState('loading');
    setLoadError('');
    setCheckout(null);
    setQrImage('');
    setRemainingMs(null);
    setPayment(null);
    notifiedRef.current = false;

    getPublicCheckout(orderId)
      .then((result) => {
        if (!active) return;
        setCheckout(result);
        setViewState('waiting');
        if (result.expiresAt) {
          const endTime = new Date(result.expiresAt).getTime();
          if (Number.isFinite(endTime)) setRemainingMs(Math.max(0, endTime - Date.now()));
        }
        const outcome = outcomeFromStatus(result.status);
        if (outcome !== 'waiting') applyOutcome(result);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error?.message || 'We could not load this payment request.');
        setViewState('error');
      });

    return () => {
      active = false;
    };
  }, [orderId, retryCount, applyOutcome]);

  useEffect(() => {
    if (!checkout?.upiLink) return undefined;
    let active = true;
    QRCode.toDataURL(checkout.upiLink, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
      color: { dark: '#123d32', light: '#fffefa' },
    })
      .then((image) => {
        if (active) setQrImage(image);
      })
      .catch(() => {
        if (active) setQrImage('');
      });
    return () => {
      active = false;
    };
  }, [checkout?.upiLink]);

  useEffect(() => {
    if (!checkout?.expiresAt || viewState !== 'waiting') return undefined;
    const endTime = new Date(checkout.expiresAt).getTime();
    if (!Number.isFinite(endTime)) return undefined;
    const updateRemaining = () => setRemainingMs(Math.max(0, endTime - Date.now()));
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [checkout?.expiresAt, viewState]);

  useEffect(() => {
    if (viewState === 'waiting' && remainingMs !== null && remainingMs <= 0) {
      setViewState('expired');
      notifyParent('payment.failed');
    }
  }, [remainingMs, viewState, notifyParent]);

  useEffect(() => {
    if (!checkout || viewState !== 'waiting') return undefined;
    let active = true;
    const poll = async () => {
      try {
        const result = await getCheckoutStatus(orderId);
        if (!active) return;
        if (result?.expiresAt && !checkout.expiresAt) {
          setCheckout((current) => ({ ...current, expiresAt: result.expiresAt }));
        }
        if (outcomeFromStatus(result?.status) !== 'waiting') applyOutcome(result);
      } catch {
        // Keep the waiting state while transient network errors retry on the next interval.
      }
    };
    const timer = window.setInterval(poll, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [checkout, orderId, viewState, applyOutcome]);

  useEffect(() => {
    if (viewState !== 'success' || !payment?.redirectUrl) return undefined;
    let destination;
    try {
      destination = new URL(payment.redirectUrl, window.location.origin);
      if (!['https:', 'http:'].includes(destination.protocol)) return undefined;
    } catch {
      return undefined;
    }

    setRedirectIn(3);
    const countdown = window.setInterval(() => {
      setRedirectIn((value) => Math.max(0, value - 1));
    }, 1000);
    const redirectTimer = window.setTimeout(() => {
      window.location.assign(destination.href);
    }, 3000);
    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(redirectTimer);
    };
  }, [viewState, payment?.redirectUrl]);

  useEffect(() => () => {
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
  }, []);

  async function copyUpiId() {
    if (!upiId) return;
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (viewState === 'loading') return <PaymentLoader />;

  const minutes = remainingMs === null ? null : Math.floor(remainingMs / 60000);
  const seconds = remainingMs === null ? null : Math.floor((remainingMs % 60000) / 1000);
  const formattedCountdown = minutes === null
    ? '—'
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <main className="checkout-shell min-h-[100dvh] px-4 py-5 sm:px-6 sm:py-9">
      <div className="mx-auto max-w-[920px]">
        <header className="entrance mb-5 flex items-center justify-between px-1 sm:mb-7">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#126b58] text-[#eff9e8]">
              <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" aria-hidden="true">
                <path d="M5 7.5h14M5 12h14M5 16.5h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="18" cy="17" r="3" fill="#c7e8a8" />
              </svg>
            </span>
            <span className="font-[var(--font-display)] text-[21px] font-bold tracking-[-1.2px] text-[#142e2b]">poppay</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-[#dce7dd] bg-[#f9fbf6] px-3 py-1.5 text-[11px] font-semibold tracking-[.02em] text-[#527169]">
            <Icon name="lock" className="h-[13px] w-[13px]" />
            SECURE CHECKOUT
          </div>
        </header>

        {viewState === 'error' ? (
          <section className="entrance rounded-[28px] border border-[#e1e8e1] bg-[#fffefa] px-6 py-12 text-center shadow-[0_24px_70px_rgba(25,61,48,.08)] sm:px-12">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#faeee9] text-[#b64c3c]">
              <Icon name="alert" className="h-7 w-7" />
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-[#a35a47]">Checkout unavailable</p>
            <h1 className="font-[var(--font-display)] text-[28px] font-semibold tracking-[-1.2px] text-[#142e2b]">We couldn’t open this payment</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#71817b]">{loadError || 'Please try again in a moment.'}</p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#126b58] px-5 text-sm font-bold text-white transition-colors hover:bg-[#0b4f42]"
            >
              <Icon name="refresh" className="h-4 w-4" />
              Try again
            </button>
          </section>
        ) : viewState === 'expired' ? (
          <section className="entrance rounded-[28px] border border-[#e1e8e1] bg-[#fffefa] px-6 py-12 text-center shadow-[0_24px_70px_rgba(25,61,48,.08)] sm:px-12">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#f8f0df] text-[#9a712d]">
              <Icon name="clock" className="h-7 w-7" />
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-[#9a712d]">Payment window closed</p>
            <h1 className="font-[var(--font-display)] text-[28px] font-semibold tracking-[-1.2px] text-[#142e2b]">This request has expired</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#71817b]">No payment was confirmed. Return to {checkout?.merchantName || 'the merchant'} to request a fresh payment link.</p>
            <div className="mx-auto mt-7 max-w-sm rounded-2xl bg-[#f6f8f2] px-5 py-4 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[#84928a]">Order reference</p>
              <p className="mt-1 break-all font-mono text-sm text-[#33554c]">{orderId}</p>
            </div>
          </section>
        ) : viewState === 'success' ? (
          <section className="entrance rounded-[28px] border border-[#dce9dd] bg-[#fffefa] px-6 py-12 text-center shadow-[0_24px_70px_rgba(25,61,48,.08)] sm:px-12">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-[22px] bg-[#dff3e9] text-[#126b58]">
              <Icon name="check" className="h-8 w-8" />
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-[#126b58]">Payment confirmed</p>
            <h1 className="font-[var(--font-display)] text-[30px] font-semibold tracking-[-1.3px] text-[#142e2b]">You’re all set.</h1>
            <p className="mt-2 text-sm text-[#71817b]">Your payment was sent directly to {checkout?.merchantName || 'the merchant'}.</p>
            <p className="mt-6 font-[var(--font-display)] text-[36px] font-bold tracking-[-1.8px] text-[#142e2b]">₹{formatAmount(checkout?.payableAmount)}</p>
            {payment?.utr && (
              <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-[#f6f8f2] px-5 py-4 text-left">
                <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[#84928a]">UPI reference number</p>
                <p className="mt-1 break-all font-mono text-sm text-[#33554c]">{payment.utr}</p>
              </div>
            )}
            {payment?.redirectUrl && <p className="mt-6 text-xs text-[#71817b]">Taking you back in {redirectIn} seconds…</p>}
          </section>
        ) : (
          <div className="entrance grid overflow-hidden rounded-[28px] border border-[#e1e8e1] bg-[#fffefa] shadow-[0_24px_70px_rgba(25,61,48,.08)] md:grid-cols-[1fr_360px]">
            <section className="p-5 sm:p-9 md:p-10">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#87968d]">You’re paying</p>
                  <h1 className="mt-1.5 max-w-[390px] break-words font-[var(--font-display)] text-[25px] font-semibold leading-tight tracking-[-1.1px] text-[#142e2b] sm:text-[30px]">
                    {checkout?.merchantName || 'Merchant'}
                  </h1>
                </div>
                <div className="mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-[#e8f4e9] font-[var(--font-display)] text-lg font-bold text-[#126b58]">
                  {(checkout?.merchantName || 'M').trim().charAt(0).toUpperCase()}
                </div>
              </div>

              <div className="rounded-[20px] border border-[#e6ebe3] bg-[#f8faf5] px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#71817b]">Amount to pay</span>
                  {remainingMs !== null && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${remainingMs < 60000 ? 'bg-[#fbefdc] text-[#8c672a]' : 'bg-[#edf3eb] text-[#56756a]'}`}>
                      <Icon name="clock" className="h-3.5 w-3.5" />
                      {formattedCountdown}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-[var(--font-display)] text-[38px] font-bold leading-none tracking-[-2px] text-[#142e2b] sm:text-[44px]">
                  <span className="mr-1 text-[27px] font-semibold text-[#527169]">₹</span>{formatAmount(checkout?.payableAmount)}
                </p>
                <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#126b58]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#126b58]" />
                  Pay exactly this amount, including paise
                </p>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[.14em] text-[#87968d]">Choose how to pay</p>
                <a
                  href={checkout?.upiLink || undefined}
                  onClick={(event) => {
                    if (!checkout?.upiLink) event.preventDefault();
                  }}
                  className={`flex min-h-[54px] items-center justify-between rounded-xl px-4 text-sm font-bold transition-colors ${checkout?.upiLink ? 'bg-[#126b58] text-white hover:bg-[#0b4f42]' : 'cursor-not-allowed bg-[#a8b8af] text-white'}`}
                  aria-disabled={!checkout?.upiLink}
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                      <Icon name="arrow" className="h-[17px] w-[17px]" />
                    </span>
                    Pay with UPI app
                  </span>
                  <span className="text-[11px] font-semibold text-white/75">Opens app</span>
                </a>
              </div>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#e7ece5]" />
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9ba69f]">or use UPI ID</span>
                <span className="h-px flex-1 bg-[#e7ece5]" />
              </div>

              <div className="flex min-h-[58px] items-center gap-3 rounded-xl border border-[#e4eae2] bg-white px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#93a097]">Merchant UPI ID</p>
                  <p className="mt-0.5 truncate font-mono text-[13px] font-semibold text-[#294d43]">{upiId || 'UPI ID unavailable'}</p>
                </div>
                <button
                  type="button"
                  onClick={copyUpiId}
                  disabled={!upiId}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-[#126b58] transition-colors hover:bg-[#edf5eb] disabled:cursor-not-allowed disabled:text-[#a7b1aa]"
                  aria-label={copied ? 'UPI ID copied' : 'Copy UPI ID'}
                >
                  <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-xl bg-[#f4f7f1] px-4 py-3.5">
                <div className="mt-0.5 text-[#678477]">
                  <Icon name="lock" className="h-4 w-4" />
                </div>
                <p className="text-[11px] leading-[1.55] text-[#73857b]">
                  Your money goes directly to <span className="font-semibold text-[#426457]">{checkout?.merchantName || 'the merchant'}</span>. PopPay never holds your funds.
                </p>
              </div>
            </section>

            <aside className="entrance-delay flex flex-col items-center bg-[#f5f8f1] px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7">
              <div className="mb-4 flex w-full items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#6d8478]">Scan to pay</p>
                <span className="rounded-full border border-[#dfe9dd] bg-[#fbfcf8] px-2.5 py-1 text-[10px] font-bold text-[#678477]">UPI</span>
              </div>
              <div className="qr-frame grid aspect-square w-full max-w-[272px] place-items-center rounded-[22px] border border-[#e9eee7] bg-[#fffefa] p-3.5">
                {qrImage ? (
                  <img src={qrImage} alt="UPI payment QR code" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center px-5 text-center">
                    <div className="mb-3 h-8 w-8 rounded-lg border-2 border-[#c5d7c7] border-t-[#126b58] animate-spin" />
                    <p className="text-xs font-medium text-[#72857a]">Preparing secure QR code…</p>
                  </div>
                )}
              </div>
              <div className="mt-5 flex items-center gap-2.5">
                <span className="flex h-7 w-[42px] items-center justify-center gap-1 rounded-md border border-[#dde7dc] bg-[#fffefa]">
                  <span className="h-2 w-2 rounded-full bg-[#126b58]" />
                  <span className="h-2 w-2 rounded-full bg-[#eeb65a]" />
                  <span className="h-2 w-2 rounded-full bg-[#a6c9a3]" />
                </span>
                <span className="text-xs font-semibold text-[#587368]">Scan with any UPI app</span>
              </div>
              <div className="mt-auto w-full border-t border-[#e2eade] pt-5">
                {viewState === 'waiting' ? (
                  <div className="flex items-center justify-center gap-2.5 text-center">
                    <span className="flex items-center gap-1">
                      <i className="waiting-dot h-1.5 w-1.5 rounded-full bg-[#126b58]" />
                      <i className="waiting-dot h-1.5 w-1.5 rounded-full bg-[#126b58]" />
                      <i className="waiting-dot h-1.5 w-1.5 rounded-full bg-[#126b58]" />
                    </span>
                    <span className="text-xs font-semibold text-[#527169]">Waiting for payment</span>
                  </div>
                ) : null}
                <p className="mt-2 text-center text-[10px] leading-4 text-[#8a9990]">
                  Keep this page open while you complete the payment.
                </p>
              </div>
            </aside>
          </div>
        )}

        <footer className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 text-center text-[10px] font-medium text-[#8b9990]">
          <span>Powered by PopPay</span>
          <span aria-hidden="true">·</span>
          <span>UPI payments go directly to the merchant</span>
          <span aria-hidden="true">·</span>
          <span>Order {orderId.slice(0, 8)}</span>
        </footer>
      </div>
    </main>
  );
}
