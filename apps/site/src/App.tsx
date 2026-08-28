import './css/design.css';

/* ------------------------------------------------------------------ */
/* Icons (inline, no dependency)                                       */
/* ------------------------------------------------------------------ */
const Icon = ({ d }: { d: string }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const icons = {
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  lock: 'M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0-4V7m0 0a4 4 0 1 0-4-4',
  pulse: 'M22 12h-4l-3 9L9 3l-3 9H2',
  moments: 'M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z',
  history: 'M12 8v4l3 3m6-3a9 9 0 1 1-3-6.7',
  mic: 'M12 1a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V4a3 3 0 0 1 3-3zm-1 12v6m-5-12a6 6 0 0 0 12 0',
  gift: 'M20 12v10H4V12M12 2a3 3 0 0 0-3 3c0 .6.2 1.2.5 1.7H9a3 3 0 1 0 6 0h-.5c.3-.5.5-1.1.5-1.7a3 3 0 0 0-3-3zM2 7h20v5H2z',
};

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */
function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="center" style={{ maxWidth: 640, margin: '0 auto var(--space-6)' }}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="h2">{title}</h2>
      {sub ? <p className="lead" style={{ marginTop: 12 }}>{sub}</p> : null}
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="card">
      <div className="card-icon"><Icon d={icon} /></div>
      <h3 className="h3">{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navbar                                                              */
/* ------------------------------------------------------------------ */
function Navbar() {
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <a className="brand" href="#top">
          <span className="brand-mark">♥</span> Bond
        </a>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#privacy">Privacy</a>
          <a href="#faq">FAQ</a>
          <a href="#support">Support</a>
          <a className="btn btn-primary nav-cta" href="#download">Get Bond</a>
        </div>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
function Hero() {
  return (
    <header className="hero" id="top">
      <div className="hero-glow" />
      <div className="container hero-content">
        <span className="pill pill-primary" style={{ marginBottom: 24 }}>Private · Trusted · You</span>
        <h1 className="h1">
          Stay close to the<br />
          <span className="highlight">people who matter</span>
        </h1>
        <p className="lead">
          Bond is a private space for the people you trust most — close friends, family
          and partners. Communicate, share moments and feel connected, your way.
        </p>
        <div className="hero-cta">
          <a className="btn btn-primary" href="#download">Get the app</a>
          <a className="btn btn-secondary" href="#features">Explore features</a>
        </div>
        <p className="muted" style={{ marginTop: 20, fontSize: '0.85rem' }}>
          Not a WhatsApp clone. A different kind of messaging experience.
        </p>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */
const coreFeatures = [
  { icon: icons.chat, title: 'Private messaging', desc: 'Beautiful conversations with the people you trust — text, photos and voice.' },
  { icon: icons.lock, title: 'Bond Lock', desc: 'Protect sensitive media. Recipients can see it exists, but only get access when you approve — one-time or for a limited window.' },
  { icon: icons.pulse, title: 'I Need You', desc: 'A permission-based alert that tells a trusted connection you need them now. Opt-in, quiet hours, full control.' },
  { icon: icons.moments, title: 'Moments', desc: 'Temporary updates that disappear — from a few hours to permanent. You choose who sees each one.' },
  { icon: icons.chat, title: 'Notifications', desc: 'In-app and push notifications for messages, alerts, surprise boxes and connection requests — without leaking content.' },
  { icon: icons.history, title: 'Shared space', desc: 'Timelines, memories and bucket lists you curate together with the people who matter.' },
  { icon: icons.mic, title: 'Voice diary', desc: 'Private or shared voice entries. Leave thoughts for yourself or trusted connections.' },
  { icon: icons.gift, title: 'Surprise box', desc: 'Prepare a message, photo or memory that opens on a chosen date — a surprise for someone special.' },
];

function Features() {
  return (
    <section className="section" id="features">
      <div className="container">
        <SectionHead
          eyebrow="Everything you need"
          title="Meaningful connection, beautifully designed"
          sub="Bond brings communication, privacy and shared memories together in one calm, modern space."
        />
        <div className="grid grid-3">
          {coreFeatures.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Signature feature deep-dive                                         */
/* ------------------------------------------------------------------ */
function Signature({ icon, eyebrow, title, desc, points, pill }: {
  icon: string; eyebrow: string; title: string; desc: string;
  points: string[]; pill: string;
}) {
  return (
    <div className="feature">
      <div className="feature-media" style={{ height: 280 }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 44, color: 'var(--primary)' }}><Icon d={icon} /></div>
          <span className="pill pill-warning" style={{ marginTop: 16 }}>{pill}</span>
          <p className="muted" style={{ marginTop: 12 }}>Illustration placeholder — app UI preview</p>
        </div>
      </div>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h3 className="h2">{title}</h3>
        <p className="lead" style={{ marginTop: 16 }}>{desc}</p>
        <ul className="checks">
          {points.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </div>
    </div>
  );
}

function SignatureFeatures() {
  return (
    <section className="section section-alt">
      <div className="container">
        <Signature
          icon={icons.pulse}
          eyebrow="Signature · I Need You"
          title="When it matters, one tap away"
          pill="Mutually agreed — opt-in only"
          desc="Tap 'I Need You' for a trusted connection and they get a distinctive, high-attention alert. Quick replies like 'I'm here' keep it human."
          points={[
            'Both people must explicitly opt in',
            'Quiet hours, per-connection rules and sound control',
            'Queued and delivered when the recipient reconnects',
          ]}
        />
        <div className="divider" />
        <Signature
          icon={icons.lock}
          eyebrow="Signature · Bond Lock"
          title="Sensitive media, under your control"
          pill="Prototype · see security notes"
          desc="Send protected photos, videos or voice. The recipient sees it exists, but can't open it until you approve — once, for a limited time, or every time."
          points={[
            'One-time, time-limited and require-approval modes',
            'Deny future access anytime',
            'Access sessions expire and re-lock automatically',
          ]}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Privacy                                                             */
/* ------------------------------------------------------------------ */
function Privacy() {
  return (
    <section className="section" id="privacy">
      <div className="container">
        <SectionHead
          eyebrow="Privacy first"
          title="Built around privacy, not just marketing it"
          sub="Bond collects as little as possible and never exposes your conversations publicly."
        />
        <div className="grid grid-2">
          <div className="card">
            <div className="card-icon"><Icon d={icons.shield} /></div>
            <h3 className="h3">Your data stays yours</h3>
            <ul className="checks">
              <li>Row-level permissions so you only ever see what you're meant to</li>
              <li>Secure HTTPS transport and encrypted-at-rest storage</li>
              <li>Full control over who can find, message and share with you</li>
            </ul>
          </div>
          <div className="card">
            <div className="card-icon"><Icon d={icons.lock} /></div>
            <h3 className="h3">Honest about security</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              End-to-end encryption is a long-term goal — a real one built on audited
              protocols, not a marketing claim. Until it's implemented and audited, we
              say exactly what we do and don't provide.
            </p>
            <p className="muted" style={{ marginTop: 12, fontSize: '0.9rem' }}>
              No fake security, ever. See the <a href="https://github.com/bongoGh233/bond/blob/main/apps/backend/docs/security.md" style={{ color: 'var(--primary)' }}>security notes</a>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Download / CTA                                                      */
/* ------------------------------------------------------------------ */
function Download() {
  return (
    <section className="section section-alt" id="download">
      <div className="container center" style={{ maxWidth: 640 }}>
        <span className="eyebrow">Get Bond</span>
        <h2 className="h2">Try the prototype, see the code</h2>
        <p className="lead" style={{ margin: '16px 0 32px' }}>
          Bond is an early prototype. The web companion runs in your browser and the
          native apps are in active development — watch the repo for builds.
        </p>
        <div className="hero-cta" style={{ justifyContent: 'center' }}>
          <a className="btn btn-primary" href="https://github.com/bongoGh233/bond">View the project on GitHub</a>
          <a className="btn btn-secondary" href="#features">Explore the features</a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */
const faqs = [
  { q: 'Is Bond a WhatsApp clone?', a: "No. Bond is built around trusted, mutually-chosen connections rather than broadcast-style messaging. Its identity is its own — from Moments, Bond Lock and I Need You, to a privacy-first design." },
  { q: 'Who can see my conversations?', a: "Only you and the people you're connected with. Row-level permissions in our database make it structurally impossible for anyone else to read them." },
  { q: 'Is my data end-to-end encrypted?', a: "Not yet — and we won't pretend it is. Today we secure transport with HTTPS, protect data at rest, and keep access strictly permissioned. True E2EE is a documented long-term goal built on audited protocols." },
  { q: 'What is Bond Lock?', a: "A way to protect sensitive media. The recipient can tell it exists but can't open it until you approve access — one-time, for limited time, or every time." },
  { q: 'Can people always send me "I Need You" alerts?', a: "Only if you opt in, and only from connections you allow. You can set quiet hours and remove permission at any time." },
  { q: 'Is it really free?', a: "Bond is built to operate on free tiers so it can remain accessible. Some features may need paid infrastructure as the number of users grows — we will always tell you before that happens." },
];

function Faq() {
  return (
    <section className="section" id="faq">
      <div className="container" style={{ maxWidth: 760 }}>
        <SectionHead eyebrow="FAQ" title="Questions, answered" />
        {faqs.map((f) => (
          <div className="faq-item" key={f.q}>
            <div className="faq-q">{f.q}</div>
            <div className="faq-a">{f.a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Support                                                             */
/* ------------------------------------------------------------------ */
function Support() {
  return (
    <section className="section section-alt" id="support">
      <div className="container">
        <SectionHead eyebrow="Support" title="We're here to help" sub="Get guidance, report an issue, or say hello." />
        <div className="center">
          <a className="btn btn-primary" href="mailto:support@bond.app">Contact support</a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */
function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <a className="brand" href="#top"><span className="brand-mark">♥</span> Bond</a>
            <p className="muted" style={{ marginTop: 12, maxWidth: 260 }}>
              Stay close to the people who matter. A private space for trusted connections.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#privacy">Privacy</a>
            <a href="#download">Download</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="#faq">FAQ</a>
            <a href="#support">Support</a>
            <a href="mailto:hello@bond.app">Contact</a>
          </div>
          <div>
            <h4>Legal</h4>
            <a href="#privacy">Privacy</a>
            <a href="#download">Terms</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Bond. Early prototype.</span>
          <span>Made for the people who matter.</span>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */
export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <SignatureFeatures />
        <Privacy />
        <Download />
        <Faq />
        <Support />
      </main>
      <Footer />
    </>
  );
}
