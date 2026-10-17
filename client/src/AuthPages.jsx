import { useState } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getMe, hasSession, login, saveSession, signup } from './api.js';
import { queueCredentials } from './MerchantShell.jsx';

function AuthLayout({ mode, children }) {
  const isSignup = mode === 'signup';
  return (
    <main className="grid min-h-[100dvh] bg-[#f3f5ef] lg:grid-cols-[minmax(380px,.88fr)_1.12fr]">
      <aside className="relative hidden overflow-hidden bg-[#123b32] px-9 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-12">
        <div className="absolute -right-28 -top-24 h-[450px] w-[450px] rounded-full border border-white/10" />
        <div className="absolute -right-12 top-14 h-[320px] w-[320px] rounded-full border border-[#c7e8a8]/15" />
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#c7e8a8] text-[#123b32]">
            <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" aria-hidden="true"><path d="M5 7.5h14M5 12h14M5 16.5h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><circle cx="18" cy="17" r="3" fill="#126b58" /></svg>
          </span>
          <span className="font-[var(--font-display)] text-[21px] font-bold tracking-[-1.2px]">poppay</span>
        </div>
        <div className="relative z-10 my-14 max-w-[520px]">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#c7e8a8]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c7e8a8]" />Payments, direct
          </span>
          <h1 className="font-[var(--font-display)] text-[clamp(38px,4.4vw,62px)] font-medium leading-[1.02] tracking-[-2.8px]">
            Every rupee,<br />where it belongs.
          </h1>
          <p className="mt-6 max-w-[390px] text-[15px] leading-7 text-[#b7ccc1]">
            A clearer way for independent businesses to collect UPI payments straight into their own account.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3 text-xs text-[#a9c0b4]">
          <ShieldCheck className="h-4 w-4 text-[#c7e8a8]" />
          Your UPI account receives payments directly
        </div>
        <div className="absolute bottom-[-60px] right-[-20px] select-none font-[var(--font-display)] text-[250px] font-bold leading-none tracking-[-25px] text-white/[.025]">₹</div>
      </aside>
      <section className="flex min-h-[100dvh] flex-col justify-center px-5 py-8 sm:px-10 lg:px-[7vw] xl:px-[9vw]">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="mb-9 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#126b58] text-[#eff9e8]">
              <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" aria-hidden="true"><path d="M5 7.5h14M5 12h14M5 16.5h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><circle cx="18" cy="17" r="3" fill="#c7e8a8" /></svg>
            </span>
            <span className="font-[var(--font-display)] text-[21px] font-bold tracking-[-1.2px] text-[#142e2b]">poppay</span>
          </div>
          <div className="mb-7">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#68867a]">{isSignup ? 'Get started' : 'Welcome back'}</p>
            <h2 className="font-[var(--font-display)] text-[32px] font-semibold tracking-[-1.5px] text-[#142e2b]">{isSignup ? 'Set up your account' : 'Sign in to PopPay'}</h2>
            <p className="mt-2 text-sm leading-6 text-[#71817b]">{isSignup ? 'A few details, then connect the account that receives your UPI payments.' : 'Your payment activity and merchant settings are waiting.'}</p>
          </div>
          {children}
          <p className="mt-8 text-center text-[11px] leading-5 text-[#8a9890]">
            By continuing, you agree to our <Link to="/privacy" className="font-semibold text-[#426d5c] underline decoration-[#b8cabb] underline-offset-2">privacy policy</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({ label, type = 'text', name, autoComplete, required = true, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#466358]">{label}</span>
      <input
        required={required}
        type={type}
        name={name}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-[48px] w-full rounded-xl border border-[#dce5dc] bg-[#fffefa] px-3.5 text-sm text-[#203d36] outline-none transition focus:border-[#5b9b7b] focus:ring-4 focus:ring-[#126b58]/10"
      />
    </label>
  );
}

export function AuthPage({ mode }) {
  const isSignup = mode === 'signup';
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (hasSession()) return <Navigate to="/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      sessionStorage.removeItem('poppay:onboarding-credentials');
      const result = isSignup ? await signup(form) : await login({ email: form.email, password: form.password });
      saveSession(result.token);
      if (isSignup && result.credentials) queueCredentials(result.credentials);
      await getMe();
      navigate(isSignup ? '/dashboard' : (location.state?.from || '/dashboard'), { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'We could not complete sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout mode={mode}>
      {error && <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-[#efd6ce] bg-[#fff2ed] px-3.5 py-3 text-xs leading-5 text-[#984d3c]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        {isSignup && <Field label="Business name" name="name" autoComplete="organization" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your shop or business" />}
        <Field label="Email address" name="email" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@business.in" />
        <Field label="Password" name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={isSignup ? 'At least 8 characters' : 'Your password'} />
        {isSignup && <p className="-mt-1 flex items-center gap-2 text-[11px] text-[#829087]"><CheckCircle2 className="h-3.5 w-3.5 text-[#678b71]" />Use at least 8 characters.</p>}
        <button disabled={busy} type="submit" className="mt-2 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#126b58] text-sm font-bold text-white transition hover:bg-[#0b4f42] disabled:cursor-wait disabled:opacity-65">
          {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#7f8d85]">
        {isSignup ? 'Already using PopPay?' : 'New to PopPay?'}
        <Link to={isSignup ? '/login' : '/signup'} className="font-bold text-[#126b58] hover:underline">{isSignup ? 'Sign in' : 'Create account'}</Link>
      </div>
    </AuthLayout>
  );
}
