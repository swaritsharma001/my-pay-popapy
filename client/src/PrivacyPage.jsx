import { ArrowLeft, CheckCircle2, FileText, MailCheck, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const sections = [
  {
    number: '01',
    title: 'What PopPay does',
    body: 'PopPay helps a merchant reconcile UPI transfers with payment requests. Funds move from the customer directly to the merchant’s UPI account. PopPay does not receive or hold the payment funds.',
  },
  {
    number: '02',
    title: 'How Gmail is checked',
    body: 'When a merchant connects Gmail, PopPay checks the sender and the message’s Authentication-Results. PopPay retrieves message bodies only for senders on that merchant’s allowed-sender list when FamApp DKIM passes. The payment amount, UTR, and transaction time are extracted for matching. Email bodies are not stored.',
  },
  {
    number: '03',
    title: 'Payment records and deduplication',
    body: 'PopPay stores the extracted payment details needed to reconcile a transfer, along with Gmail message IDs used to prevent processing the same message more than once. Matched payment and order references, unmatched transfers, and webhook delivery attempts are also retained in the merchant workspace.',
  },
  {
    number: '04',
    title: 'Merchant account information',
    body: 'The service uses merchant account details such as business name and email, receiving UPI ID, allowed sender addresses, integration keys, and an optional webhook URL to provide the collection service. API secrets are shown only when issued or rotated; merchants should keep them on a trusted server.',
  },
  {
    number: '05',
    title: 'Your controls',
    body: 'A merchant controls which sender addresses are allowed and can disconnect Gmail from Settings. When disconnected, PopPay deletes the stored Gmail authorization token. A merchant can also update its UPI ID and webhook destination, or rotate integration credentials.',
  },
  {
    number: '06',
    title: 'Security and careful handling',
    body: 'Access to merchant records is protected by account authentication. Keep passwords and secret integration credentials private, review webhook delivery history, and rotate credentials promptly if they may have been exposed.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="merchant-shell min-h-[100dvh] px-4 py-7 sm:px-7 sm:py-11">
      <div className="mx-auto max-w-[940px]">
        <header className="mb-9 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2.5" aria-label="PopPay home">
            <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#126b58] text-[#eff9e8]"><svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" aria-hidden="true"><path d="M5 7.5h14M5 12h14M5 16.5h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><circle cx="18" cy="17" r="3" fill="#c7e8a8" /></svg></span>
            <span className="font-[var(--font-display)] text-[21px] font-bold tracking-[-1.2px] text-[#142e2b]">poppay</span>
          </Link>
          <Link to="/login" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dce5dc] bg-[#fffefa] px-3.5 text-xs font-bold text-[#436557] hover:bg-[#f5f8f2]"><ArrowLeft className="h-3.5 w-3.5" />Back to sign in</Link>
        </header>

        <section className="overflow-hidden rounded-[26px] border border-[#e1e8e1] bg-[#fffefa] panel-shadow">
          <div className="relative overflow-hidden bg-[#174e41] px-6 py-8 text-white sm:px-10 sm:py-11">
            <div className="absolute -right-10 -top-28 h-72 w-72 rounded-full border border-white/10" />
            <div className="relative z-10 max-w-[680px]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#d4e9c5]"><ShieldCheck className="h-3.5 w-3.5" />Clear by design</div>
              <h1 className="font-[var(--font-display)] text-[34px] font-semibold leading-[1.05] tracking-[-1.5px] sm:text-[46px]">Privacy, without fine-print fog.</h1>
              <p className="mt-4 max-w-[620px] text-sm leading-6 text-[#c0d5c8]">PopPay reads eligible payment notifications to reconcile transfers. Here is exactly what that means for your inbox and payment data.</p>
            </div>
          </div>

          <div className="grid gap-8 p-5 sm:p-8 md:grid-cols-[220px_1fr] md:p-10">
            <aside className="h-fit rounded-2xl bg-[#f3f6f0] p-4 md:sticky md:top-6">
              <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#698173]"><FileText className="h-3.5 w-3.5" />At a glance</p>
              <ul className="space-y-3 text-[11px] leading-5 text-[#6f8277]">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4c8965]" />Bodies are read only for allowed senders with FamApp DKIM pass.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4c8965]" />Email bodies are not stored.</li>
                <li className="flex gap-2"><MailCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4c8965]" />Gmail message IDs are kept for deduplication.</li>
              </ul>
              <Link to="/settings" className="mt-5 inline-flex items-center gap-1.5 text-[10px] font-bold text-[#126b58] hover:underline">Review inbox controls <ArrowLeft className="h-3 w-3 rotate-180" /></Link>
            </aside>

            <div>
              <p className="mb-5 text-xs text-[#87948c]">Last updated: PopPay collection service</p>
              <div className="space-y-7">
                {sections.map((section) => <section key={section.number} className="grid gap-2 sm:grid-cols-[42px_1fr] sm:gap-4">
                  <p className="font-mono text-[11px] font-bold text-[#8ea493]">{section.number}</p>
                  <div><h2 className="font-[var(--font-display)] text-[17px] font-semibold tracking-[-.35px] text-[#24443b]">{section.title}</h2><p className="mt-2 text-xs leading-[1.8] text-[#6f8077]">{section.body}</p></div>
                </section>)}
              </div>
              <div className="mt-8 rounded-xl border border-[#dce8dc] bg-[#f4f8f2] p-4">
                <p className="text-xs font-bold text-[#3d6653]">A payment goes straight to you.</p>
                <p className="mt-1 text-[11px] leading-5 text-[#72877a]">PopPay helps confirm and reconcile a UPI transfer; the money itself is transferred directly to the merchant’s UPI account.</p>
              </div>
            </div>
          </div>
        </section>
        <footer className="mt-5 text-center text-[10px] text-[#89968e]">PopPay · Direct-to-merchant UPI collection</footer>
      </div>
    </main>
  );
}
