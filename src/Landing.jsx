import '@fontsource-variable/bricolage-grotesque'
import './landing.css'

// Simple outline icons drawn from basic shapes, so no icon library is needed
const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const icons = {
  brand: <><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4" /><path d="M10 12h6M10 16h6" /></>,
  send: <path d="M22 3 2 11l7 3 3 7z" />,
  split: <><circle cx="8" cy="8" r="3" /><circle cx="16" cy="16" r="3" /><path d="M19 5 5 19" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></>,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17.5" cy="9" r="2.5" /><path d="M17 14.2c2.7.2 4.5 2.1 4.5 5.8" /></>,
  shield: <><path d="M12 3 4.5 6v6c0 4.6 3.1 7.7 7.5 9 4.4-1.3 7.5-4.4 7.5-9V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><path d="M11 18.5h2" /></>,
}

const WHO = [
  ['Individuals and freelancers', 'Landed a contract or a new client? Send a clean invoice under your own name and keep a numbered receipt for every payment.'],
  ['Small businesses', 'Shops, salons, workshops and service providers can bill customers, see who still owes them, and hand out receipts straight away.'],
  ['Growing companies and institutions', 'Give your team their own logins with the right level of access, and keep every invoice and receipt in one place.'],
  ['Investors and property owners', 'Keep rent, farm income and business ventures billed properly, with every invoice, payment and receipt on record.'],
]

const STEPS = [
  ['Create the invoice', 'Pick a client, add the items, and VAT is worked out for you. Save it, or send it straight away.'],
  ['Send it and record the payment', 'Email the PDF or share it on WhatsApp. When the money arrives, record it. M-Pesa codes are checked before they are saved.'],
  ['The receipt follows', 'A numbered receipt is issued automatically, showing what was paid and what is still owed. Deposits and instalments work too.'],
]

const FEATURES = [
  ['brand', 'Your brand on every document', 'Add your logo, business name, KRA PIN and payment details once. They appear on every invoice and receipt.'],
  ['send', 'Email and WhatsApp', 'Send a PDF in one tap. The same document is never sent twice by accident.'],
  ['split', 'Deposits and instalments', 'Record part-payments and the remaining balance is tracked for you.'],
  ['chart', 'Money at a glance', 'See what is outstanding, what is overdue, and what you collected this month.'],
  ['team', 'Your team, with limits', 'Add staff and admins. Each person sees only what their role allows.'],
  ['shield', 'Private to your business', 'Your clients and records are kept apart from every other business using the system.'],
  ['undo', 'Mistakes handled properly', 'Void an invoice instead of deleting it, so your records stay complete.'],
  ['phone', 'Works on any screen', 'Built for phones as much as laptops, so you can invoice from the field.'],
]

export default function Landing({ onLogin, onSignup }) {
  return (
    <div className="lp">
      <header className="lp-nav">
        <a className="lp-brand" href="#top" aria-label="Cancelo Invoicing System">
          <span className="lp-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3h8l4 4v14H7z" /><path d="m10 14 2 2 4-4" />
            </svg>
          </span>
          Cancelo Invoicing System
        </a>
        <nav className="lp-nav-actions" aria-label="Account">
          <button className="lp-link" onClick={onLogin}>Log in</button>
          <button className="lp-btn lp-sm" onClick={onSignup}>Get started</button>
        </nav>
      </header>

      <main id="top">
        <section className="lp-hero">
          <div className="lp-hero-text">
            <h1 className="lp-h1">Invoice, get paid, and the receipt writes itself.</h1>
            <p className="lp-lead">
              Cancelo Invoicing is an invoice and receipt system for businesses of every size, for investors
              running ventures, and for individuals taking on contracts.
            </p>
            <div className="lp-cta">
              <button className="lp-btn" onClick={onSignup}>Get started</button>
              <button className="lp-btn lp-outline" onClick={onLogin}>Log in</button>
            </div>
            <p className="lp-note">Works on your phone and your laptop. Send every document by email or WhatsApp.</p>
          </div>

          <div className="lp-mock" role="img" aria-label="An example invoice stamped paid, with its matching receipt">
            <div className="lp-doc lp-receipt" aria-hidden="true">
              <p className="lp-doc-title">Receipt</p>
              <p className="lp-mono">RCT-2026-0007</p>
              <dl className="lp-mono lp-lines">
                <div><dt>From</dt><dd>Kenya laptop dealers</dd></div>
                <div><dt>Invoice</dt><dd>INV-2026-0012</dd></div>
                <div><dt>M-Pesa</dt><dd>QJ82K4L9TA</dd></div>
                <div><dt>Received</dt><dd>53,360.00</dd></div>
                <div><dt>Balance</dt><dd>0.00</dd></div>
              </dl>
              <p className="lp-mono lp-thanks">Thank you for your payment.</p>
            </div>

            <div className="lp-doc lp-invoice" aria-hidden="true">
              <div className="lp-doc-head">
                <span className="lp-mark lp-mark-sm">BW</span>
                <div>
                  <p className="lp-doc-biz">Alfred Web Studio</p>
                  <p className="lp-doc-small">Mombasa, Kenya</p>
                </div>
                <div className="lp-doc-id">
                  <p className="lp-doc-title">Invoice</p>
                  <p className="lp-doc-small">INV-2026-0012</p>
                </div>
              </div>
              <p className="lp-doc-small lp-bill">Bill to <strong>Kenya laptop dealers</strong></p>
              <table className="lp-items">
                <tbody>
                  <tr><td>Website design</td><td>40,000.00</td></tr>
                  <tr><td>Hosting, one year</td><td>6,000.00</td></tr>
                </tbody>
              </table>
              <dl className="lp-totals">
                <div><dt>Subtotal</dt><dd>46,000.00</dd></div>
                <div><dt>VAT 16%</dt><dd>7,360.00</dd></div>
                <div className="lp-grand"><dt>Total</dt><dd>KES 53,360.00</dd></div>
              </dl>
              <div className="lp-stamp"><span>Paid</span></div>
            </div>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="who">
          <h2 id="who" className="lp-h2">Made for anyone who gets paid for their work</h2>
          <ul className="lp-who">
            {WHO.map(([name, text]) => (
              <li key={name}><h3>{name}</h3><p>{text}</p></li>
            ))}
          </ul>
        </section>

        <section className="lp-section lp-tint" aria-labelledby="how">
          <h2 id="how" className="lp-h2">From invoice to receipt in three steps</h2>
          <ol className="lp-steps">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="lp-step-n" aria-hidden="true">{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-section" aria-labelledby="what">
          <h2 id="what" className="lp-h2">Everything you need to bill properly</h2>
          <ul className="lp-features">
            {FEATURES.map(([icon, title, text]) => (
              <li key={title}>
                <span className="lp-ico"><Icon>{icons[icon]}</Icon></span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-local" aria-labelledby="local">
          <h2 id="local" className="lp-h2">Built for the way business works in Kenya</h2>
          <p>Shilling amounts, 16% VAT, M-Pesa payments and WhatsApp are part of the system from the start, not added on afterwards.</p>
        </section>

        <section className="lp-final" aria-labelledby="final">
          <h2 id="final" className="lp-h2">Send your first invoice today</h2>
          <p>Create your account, add your company details, and your first invoice can be on its way in minutes.</p>
          <div className="lp-cta lp-cta-center">
            <button className="lp-btn" onClick={onSignup}>Get started</button>
            <button className="lp-btn lp-outline" onClick={onLogin}>Log in</button>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <p>Cancelo Invoicing is a product of Cancelo IT Software Engineering Company, Kenya. &copy; {new Date().getFullYear()}</p>
        <button className="lp-link" onClick={onLogin}>Log in</button>
      </footer>
    </div>
  )
}
