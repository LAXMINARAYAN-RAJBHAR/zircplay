// ─────────────────────────────────────────────────────────────
// Zixplon Legal & Info Pages — Bright Colorful Theme
// ─────────────────────────────────────────────────────────────

import React, { useEffect } from "react";
import { Link } from "react-router-dom";

// ── Design tokens ─────────────────────────────────────────────
const T = {
  bg:       "#f0f4ff",
  surface:  "#ffffff",
  surface2: "#f7f0ff",
  border:   "#e0d4ff",
  primary:  "#7c3aed",
  primary2: "#a855f7",
  accent1:  "#f43f5e",
  accent2:  "#f97316",
  accent3:  "#06b6d4",
  accent4:  "#10b981",
  text:     "#1e1b4b",
  text2:    "#4c4589",
  text3:    "#8b84c4",
};

// ── Shared styles ─────────────────────────────────────────────
const pageStyle = {
  minHeight: "100vh",
  background: T.bg,
  color: T.text,
  fontFamily: "'Outfit', 'Nunito', sans-serif",
  padding: "80px 20px 60px",
};

const containerStyle = {
  maxWidth: "860px",
  margin: "0 auto",
};

const headingStyle = {
  fontSize: "32px",
  fontWeight: "900",
  color: T.text,
  marginBottom: "6px",
  letterSpacing: "-0.5px",
  fontFamily: "'Nunito', sans-serif",
};

const accentBar = {
  width: "48px",
  height: "4px",
  background: `linear-gradient(90deg, ${T.primary}, ${T.accent1})`,
  borderRadius: "2px",
  marginBottom: "32px",
};

const sectionTitle = {
  fontSize: "18px",
  fontWeight: "800",
  color: T.text,
  marginTop: "36px",
  marginBottom: "10px",
  fontFamily: "'Nunito', sans-serif",
};

const para = {
  fontSize: "15px",
  lineHeight: "1.8",
  color: T.text2,
  marginBottom: "14px",
  fontFamily: "'Outfit', sans-serif",
};

const card = {
  background: T.surface,
  border: `2px solid ${T.border}`,
  borderRadius: "16px",
  padding: "20px 24px",
  marginBottom: "16px",
  boxShadow: "0 2px 12px rgba(124,58,237,0.06)",
};

const metaLine = {
  fontSize: "13px",
  color: T.text3,
  marginBottom: "28px",
  fontWeight: "600",
};

const linkStyle = { color: T.primary, textDecoration: "none", fontWeight: "700" };

// ── Back button ───────────────────────────────────────────────
const BackBtn = () => (
  <Link
    to="/"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      color: T.primary,
      fontSize: "14px",
      textDecoration: "none",
      marginBottom: "28px",
      fontWeight: "800",
      fontFamily: "'Nunito', sans-serif",
      background: T.surface2,
      border: `2px solid ${T.border}`,
      padding: "7px 16px",
      borderRadius: "20px",
      transition: "all 0.2s",
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.background = T.surface; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surface2; }}
  >
    ← Back to Zixplon
  </Link>
);

// ── Colorful section badge ────────────────────────────────────
const SectionBadge = ({ children, color = T.primary }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: "6px",
    background: color + "18", color, fontWeight: "800",
    fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase",
    padding: "4px 12px", borderRadius: "20px", marginBottom: "12px",
    fontFamily: "'Nunito', sans-serif", border: `1.5px solid ${color}33`,
  }}>
    {children}
  </div>
);

// ══════════════════════════════════════════════════════════════
// 1. ABOUT US — /about
// ══════════════════════════════════════════════════════════════
export const AboutPage = () => {
  useEffect(() => { document.title = "About Us — Zixplon"; }, []);

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <BackBtn />
        <h1 style={headingStyle}>About Zixplon</h1>
        <div style={accentBar} />
        <p style={para}>
          Zixplon is an Indian video-sharing platform built for creators and
          viewers who want a free, open, and community-driven space to share
          stories, skills, entertainment, and ideas — without barriers.
        </p>

        {[
          { emoji: "🎯", title: "Our Mission", color: T.primary,
            body: "To give every creator — big or small — a powerful platform to upload, share, and grow their audience, while giving viewers a rich library of content from across India and the world." },
          { emoji: "🚀", title: "What We Offer", color: T.accent2, list: [
            "Upload and stream videos & reels (Shorts)",
            "Subscribe to your favourite creators",
            "Like, comment, and share content",
            "Voice search and smart suggestions",
            "Notifications for new uploads and interactions",
            "Local video player for offline files",
          ]},
          { emoji: "🇮🇳", title: "Made in India", color: T.accent4,
            body: "Zixplon is proudly built and operated in India. We are committed to supporting Indian creators, regional languages, and local content that reflects the diversity of our country." },
          { emoji: "📬", title: "Get in Touch", color: T.accent3,
            body: null },
        ].map((item, i) => (
          <div key={i} style={{ ...card, borderLeft: `4px solid ${item.color}` }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>{item.emoji}</div>
            <div style={{ ...sectionTitle, marginTop: 0, color: item.color }}>{item.title}</div>
            {item.list
              ? <ul style={{ ...para, paddingLeft: "20px", marginBottom: 0 }}>{item.list.map(l => <li key={l}>{l}</li>)}</ul>
              : item.body
                ? <p style={{ ...para, marginBottom: 0 }}>{item.body}</p>
                : <p style={{ ...para, marginBottom: 0 }}>
                    Have questions or want to partner with us?{" "}
                    <Link to="/contact" style={linkStyle}>Contact our support team</Link>{" "}
                    or visit our{" "}
                    <Link to="/help" style={linkStyle}>Help & FAQ</Link> page.
                  </p>
            }
          </div>
        ))}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 2. PRIVACY POLICY — /privacy-policy
// ══════════════════════════════════════════════════════════════
export const PrivacyPolicyPage = () => {
  useEffect(() => { document.title = "Privacy Policy — Zixplon"; }, []);

  const sections = [
    { title: "1. Information We Collect", body: "We collect the following types of information:", list: [
      ["Account information:", "Username, email address, and profile picture when you register."],
      ["Content you upload:", "Videos, thumbnails, titles, descriptions, and comments."],
      ["Usage data:", "Pages visited, videos watched, search queries, likes, and subscriptions."],
      ["Device information:", "Browser type, operating system, IP address, and approximate location (country)."],
    ]},
    { title: "2. How We Use Your Information", list: [
      ["", "To provide and improve our platform services"],
      ["", "To personalise your content recommendations"],
      ["", "To send notifications about your account and activity"],
      ["", "To detect and prevent abuse, spam, and illegal content"],
      ["", "To comply with legal obligations under Indian law"],
    ]},
    { title: "3. Data Storage", body: "Your data is stored securely using Supabase (PostgreSQL). We do not sell your personal data to third parties. Data may be stored on servers outside India but is protected under equivalent data protection standards." },
    { title: "4. Cookies", body: "We use browser localStorage to keep you logged in and remember your preferences. We may use analytics cookies in the future, which will be disclosed in an updated policy." },
    { title: "5. Third-Party Services", body: "We use the following third-party services that may access your data:", list: [
      ["", "Supabase — database and authentication"],
      ["", "Vercel — hosting and deployment"],
      ["", "DiceBear / UI Avatars — profile picture generation"],
      ["", "ipapi.co / ipwho.is — country detection (no data stored)"],
    ]},
    { title: "6. Your Rights", list: [
      ["", "Request access to the data we hold about you"],
      ["", "Request correction or deletion of your account data"],
      ["", "Withdraw consent at any time by deleting your account"],
      ["", "Lodge a complaint with India's data protection authority if needed"],
    ]},
    { title: "7. Children's Privacy", body: "Zixplon is not intended for users under the age of 13. We do not knowingly collect data from children. If you believe a child has registered, please contact us immediately." },
    { title: "8. Changes to This Policy", body: "We may update this Privacy Policy from time to time. We will notify registered users of significant changes via the notifications system. Continued use of Zixplon after changes means you accept the updated policy." },
    { title: "9. Contact", jsx: <p style={para}>For privacy-related concerns, please use our <Link to="/contact" style={linkStyle}>Contact Support</Link> page.</p> },
  ];

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <BackBtn />
        <h1 style={headingStyle}>Privacy Policy</h1>
        <div style={accentBar} />
        <p style={metaLine}>Last updated: June 2025 · Effective immediately</p>
        <p style={para}>At Zixplon, we take your privacy seriously. This Privacy Policy explains what data we collect, how we use it, and your rights regarding your personal information.</p>
        {sections.map((s, i) => (
          <div key={i}>
            <div style={sectionTitle}>{s.title}</div>
            {s.body && <p style={para}>{s.body}</p>}
            {s.list && (
              <ul style={{ ...para, paddingLeft: "20px" }}>
                {s.list.map(([label, text], j) => (
                  <li key={j}>
                    {label && <strong style={{ color: T.primary, fontWeight: "800" }}>{label}</strong>}
                    {label ? " " : ""}{text}
                  </li>
                ))}
              </ul>
            )}
            {s.jsx && s.jsx}
          </div>
        ))}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 3. DMCA — /dmca
// ══════════════════════════════════════════════════════════════
export const DmcaPage = () => {
  useEffect(() => { document.title = "DMCA & Copyright Policy — Zixplon"; }, []);

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <BackBtn />
        <h1 style={headingStyle}>DMCA & Copyright Policy</h1>
        <div style={accentBar} />
        <p style={metaLine}>Last updated: June 2025</p>
        <p style={para}>Zixplon respects the intellectual property rights of others and expects users of our platform to do the same. We comply with the Digital Millennium Copyright Act (DMCA) and Indian copyright law under the Copyright Act, 1957.</p>

        <div style={sectionTitle}>1. Prohibited Content</div>
        <p style={para}>You may not upload content that you do not own or have explicit permission to share, including:</p>
        <ul style={{ ...para, paddingLeft: "20px" }}>
          <li>Movies, TV shows, or web series clips without authorisation</li>
          <li>Copyrighted music used without a licence</li>
          <li>Content belonging to other YouTube/Zixplon creators without credit or permission</li>
          <li>News broadcast clips, sports footage, or live event recordings</li>
        </ul>

        <div style={sectionTitle}>2. How to File a Copyright Complaint</div>
        <p style={para}>If you believe your copyrighted work has been uploaded to Zixplon without your permission, please submit a takedown request with the following information:</p>
        <div style={{ ...card, borderLeft: `4px solid ${T.accent1}` }}>
          <SectionBadge color={T.accent1}>Required Information</SectionBadge>
          <ul style={{ ...para, marginBottom: 0, paddingLeft: "20px" }}>
            <li>Your full legal name and contact details</li>
            <li>A description of the copyrighted work you claim has been infringed</li>
            <li>The URL of the infringing content on Zixplon</li>
            <li>A statement that you have a good faith belief the use is not authorised</li>
            <li>A statement that the information in your notice is accurate and that you are the copyright owner or authorised to act on their behalf</li>
            <li>Your physical or electronic signature</li>
          </ul>
        </div>
        <p style={para}>Send takedown requests via our <Link to="/contact" style={linkStyle}>Contact Support</Link> page with the subject line <strong style={{ color: T.text, fontWeight: "800" }}>"DMCA Takedown Request"</strong>.</p>

        <div style={sectionTitle}>3. Counter-Notification</div>
        <p style={para}>If you believe your content was removed in error, you may file a counter-notification. We will restore the content within 10–14 business days unless the complainant files a court action.</p>

        <div style={sectionTitle}>4. Repeat Infringers</div>
        <p style={para}>Zixplon has a strict repeat-infringer policy. Accounts that repeatedly upload infringing content will be permanently suspended without warning.</p>

        <div style={sectionTitle}>5. Fair Use</div>
        <p style={para}>Commentary, criticism, education, and parody may qualify as fair use under applicable law. We evaluate such claims on a case-by-case basis and do not automatically remove content flagged by rights holders without review.</p>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 4. COMMUNITY GUIDELINES — /community-guidelines
// ══════════════════════════════════════════════════════════════
export const CommunityGuidelinesPage = () => {
  useEffect(() => { document.title = "Community Guidelines — Zixplon"; }, []);

  const rule = (emoji, title, desc, color = T.primary) => (
    <div style={{ ...card, borderLeft: `4px solid ${color}` }} key={title}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        <span style={{ fontSize: "26px", flexShrink: 0 }}>{emoji}</span>
        <div>
          <div style={{ fontWeight: "800", color, marginBottom: "6px", fontSize: "15px", fontFamily: "'Nunito', sans-serif" }}>{title}</div>
          <p style={{ ...para, marginBottom: 0 }}>{desc}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <BackBtn />
        <h1 style={headingStyle}>Community Guidelines</h1>
        <div style={accentBar} />
        <p style={para}>Zixplon is a place for everyone. To keep it safe, respectful, and enjoyable, all users and creators must follow these guidelines. Violations may result in content removal, account suspension, or a permanent ban.</p>

        <SectionBadge color={T.accent4}>✅ What's Allowed</SectionBadge>
        {rule("🎬", "Original Content", "Upload videos, reels, and shorts that you created or have full rights to share.", T.accent4)}
        {rule("💬", "Constructive Discussion", "Comment, debate, and engage — as long as it's respectful and on-topic.", T.accent3)}
        {rule("🎵", "Creative Expression", "Music, comedy, education, gaming, travel, cooking — all genres are welcome.", T.primary2)}

        <div style={{ marginTop: "24px" }}>
          <SectionBadge color={T.accent1}>❌ What's Not Allowed</SectionBadge>
        </div>
        {rule("🚫", "Hate Speech & Harassment", "Content that attacks people based on religion, caste, gender, race, or sexual orientation is strictly prohibited.", T.accent1)}
        {rule("🔞", "Adult or Explicit Content", "No pornographic, sexually explicit, or nudity-based content. This is a platform for all ages.", T.accent1)}
        {rule("💀", "Violence & Dangerous Acts", "Do not upload graphic violence, self-harm, terrorism, or content that encourages dangerous behaviour.", T.accent1)}
        {rule("📋", "Misinformation & Fake News", "Do not spread false medical, political, or factual information that could cause harm to individuals or communities.", T.accent2)}
        {rule("©️", "Copyright Infringement", "Do not upload content you do not own. See our DMCA Policy for details.", T.accent2)}
        {rule("🤖", "Spam & Fake Engagement", "No bots, fake views, fake subscribers, or comment spam. We actively detect and remove artificial engagement.", T.text3)}
        {rule("👶", "Child Safety", "Any content that exploits, endangers, or is inappropriate for minors will result in an immediate permanent ban and may be reported to authorities.", T.accent1)}

        <div style={sectionTitle}>Enforcement</div>
        <p style={para}>Our team reviews reported content manually. Strikes work as follows:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          {[
            { label: "1st strike", desc: "Content removed, warning issued", color: T.accent2 },
            { label: "2nd strike", desc: "Upload privileges suspended for 7 days", color: T.accent1 },
            { label: "3rd strike", desc: "Permanent account ban", color: "#dc2626" },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "12px", background: T.surface, border: `2px solid ${T.border}`, borderRadius: "12px", padding: "12px 16px" }}>
              <span style={{ background: s.color, color: "#fff", fontFamily: "'Nunito', sans-serif", fontWeight: "800", fontSize: "11px", padding: "3px 10px", borderRadius: "10px", whiteSpace: "nowrap" }}>{s.label}</span>
              <span style={{ color: T.text2, fontSize: "14px" }}>{s.desc}</span>
            </div>
          ))}
        </div>
        <p style={para}>Use the <Link to="/report" style={linkStyle}>Report a Problem</Link> feature to flag content that violates these guidelines.</p>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 5. ADVERTISE — /advertise
// ══════════════════════════════════════════════════════════════
export const AdvertisePage = () => {
  useEffect(() => { document.title = "Advertise With Us — Zixplon"; }, []);

  const adOptions = [
    { icon: "🎬", title: "Pre-Roll Video Ads", desc: "5–15 second ads that play before videos start. High visibility, high recall.", color: T.primary },
    { icon: "🖼️", title: "Banner Display Ads", desc: "Static or animated banners shown across the homepage, video pages, and reels.", color: T.accent3 },
    { icon: "📌", title: "Sponsored Content", desc: "Your brand's video promoted at the top of search results and the homepage feed.", color: T.accent2 },
    { icon: "🎙️", title: "Creator Partnerships", desc: "We connect you directly with Zixplon creators for product integrations and shoutouts.", color: T.accent4 },
  ];

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <BackBtn />
        <h1 style={headingStyle}>Advertise With Us</h1>
        <div style={accentBar} />
        <p style={para}>Reach a growing audience of engaged Indian viewers and content creators on Zixplon. We offer flexible advertising options for brands of all sizes — from local businesses to national campaigns.</p>

        <div style={{ ...card, background: `linear-gradient(135deg, ${T.surface2}, #fff0f8)`, border: `2px solid ${T.accent1}44`, marginBottom: "32px" }}>
          <p style={{ ...para, marginBottom: 0, color: T.accent1 }}>
            🚀 <strong style={{ fontWeight: "900" }}>Early Partner Advantage:</strong>{" "}
            <span style={{ color: T.text2 }}>Brands that partner with Zixplon now get premium placement at introductory rates before we launch our full ad platform.</span>
          </p>
        </div>

        <div style={sectionTitle}>Advertising Options</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
          {adOptions.map(o => (
            <div key={o.title} style={{ ...card, borderLeft: `4px solid ${o.color}` }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>{o.icon}</div>
              <div style={{ fontWeight: "800", color: o.color, fontSize: "15px", marginBottom: "6px", fontFamily: "'Nunito', sans-serif" }}>{o.title}</div>
              <p style={{ ...para, marginBottom: "10px" }}>{o.desc}</p>
              <span style={{ fontSize: "12px", color: o.color, fontWeight: "700", background: o.color + "18", padding: "3px 10px", borderRadius: "10px", border: `1px solid ${o.color}33` }}>
                Contact for pricing
              </span>
            </div>
          ))}
        </div>

        <div style={sectionTitle}>Why Advertise on Zixplon?</div>
        <ul style={{ ...para, paddingLeft: "20px" }}>
          <li>Growing Indian audience with high engagement</li>
          <li>Targeted by category: Music, Gaming, Sports, Tech, News & more</li>
          <li>Real viewers — no bot traffic</li>
          <li>Affordable rates compared to established platforms</li>
          <li>Direct communication with our team — no middlemen</li>
        </ul>

        <div style={sectionTitle}>Get Started</div>
        <p style={para}>To discuss advertising opportunities, please reach out via our <Link to="/contact" style={linkStyle}>Contact Support</Link> page with the subject line <strong style={{ color: T.text, fontWeight: "800" }}>"Advertising Enquiry"</strong> and include your brand name, budget range, and target audience.</p>
        <p style={{ ...para, color: T.text3 }}>We typically respond within 48 hours on business days.</p>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 6. REPORT A PROBLEM — /report
// ══════════════════════════════════════════════════════════════
export const ReportPage = () => {
  useEffect(() => { document.title = "Report a Problem — Zixplon"; }, []);

  const [type, setType] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const inputStyle = {
    width: "100%",
    background: "#f0f4ff",
    border: "2px solid #e0d4ff",
    borderRadius: "12px",
    color: "#1e1b4b",
    fontSize: "14px",
    fontFamily: "'Outfit', sans-serif",
    padding: "12px 14px",
    marginBottom: "16px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const labelStyle = {
    color: T.text3,
    fontSize: "13px",
    fontWeight: "700",
    fontFamily: "'Nunito', sans-serif",
    display: "block",
    marginBottom: "6px",
  };

  const canSubmit = !!(type && desc.trim());

  const handleSubmit = () => { if (canSubmit) setSubmitted(true); };

  if (submitted) {
    return (
      <div style={pageStyle}>
        <div style={{ ...containerStyle, textAlign: "center", paddingTop: "60px" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>✅</div>
          <h2 style={{ color: T.primary, fontSize: "24px", marginBottom: "10px", fontFamily: "'Nunito', sans-serif", fontWeight: "900" }}>
            Report Submitted!
          </h2>
          <p style={{ ...para, maxWidth: "400px", margin: "0 auto 28px" }}>
            Thank you for helping keep Zixplon safe. Our team will review your report within 24–48 hours.
          </p>
          <Link
            to="/"
            style={{
              background: `linear-gradient(135deg, ${T.primary}, ${T.primary2})`,
              color: "#fff",
              padding: "12px 32px",
              borderRadius: "20px",
              textDecoration: "none",
              fontWeight: "800",
              fontSize: "14px",
              fontFamily: "'Nunito', sans-serif",
              boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <BackBtn />
        <h1 style={headingStyle}>Report a Problem</h1>
        <div style={accentBar} />
        <p style={para}>
          See something that violates our{" "}
          <Link to="/community-guidelines" style={linkStyle}>Community Guidelines</Link>?
          {" "}Report it here and our team will review it promptly.
        </p>

        <div style={card}>
          <label style={labelStyle}>Report Type *</label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
            onFocus={e => (e.target.style.borderColor = T.primary)}
            onBlur={e => (e.target.style.borderColor = T.border)}
          >
            <option value="">Select a category...</option>
            <option value="spam">Spam or misleading content</option>
            <option value="hate">Hate speech or harassment</option>
            <option value="violence">Violence or dangerous acts</option>
            <option value="adult">Adult or explicit content</option>
            <option value="copyright">Copyright infringement</option>
            <option value="misinformation">Misinformation / Fake news</option>
            <option value="child">Child safety concern</option>
            <option value="bug">Technical bug or error</option>
            <option value="other">Other</option>
          </select>

          <label style={labelStyle}>URL of the content (optional)</label>
          <input
            type="text"
            placeholder="https://zixplon-tawny.vercel.app/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = T.primary)}
            onBlur={e => (e.target.style.borderColor = T.border)}
          />

          <label style={labelStyle}>Describe the problem *</label>
          <textarea
            placeholder="Please describe the issue in detail..."
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={5}
            style={{ ...inputStyle, resize: "vertical", marginBottom: "20px" }}
            onFocus={e => (e.target.style.borderColor = T.primary)}
            onBlur={e => (e.target.style.borderColor = T.border)}
          />

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? `linear-gradient(135deg, ${T.primary}, ${T.primary2})` : T.border,
              color: canSubmit ? "#fff" : T.text3,
              border: "none",
              borderRadius: "20px",
              padding: "12px 32px",
              fontSize: "14px",
              fontWeight: "800",
              fontFamily: "'Nunito', sans-serif",
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              boxShadow: canSubmit ? "0 4px 16px rgba(124,58,237,0.3)" : "none",
            }}
          >
            Submit Report
          </button>
        </div>

        <p style={{ ...para, color: T.text3, fontSize: "13px", marginTop: "16px" }}>
          For urgent copyright issues, please visit our{" "}
          <Link to="/dmca" style={linkStyle}>DMCA page</Link>.
        </p>
      </div>
    </div>
  );
};