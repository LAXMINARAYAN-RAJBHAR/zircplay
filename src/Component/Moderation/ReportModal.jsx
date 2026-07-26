import React, { useState, useEffect, useRef } from "react";
import "./ReportModal.css";
import { supabase } from "../../config/supabase";

const REPORT_REASONS = [
  { value: "inappropriate",   label: "🔞 Inappropriate / Adult Content" },
  { value: "spam",            label: "📢 Spam or Misleading" },
  { value: "hate_speech",     label: "🚫 Hate Speech or Discrimination" },
  { value: "violence",        label: "⚠️ Violent or Dangerous Content" },
  { value: "misinformation",  label: "❌ Misinformation / Fake News" },
  { value: "copyright",       label: "©️ Copyright Violation" },
  { value: "harassment",      label: "😡 Harassment or Bullying" },
  { value: "child_safety",    label: "🛡️ Child Safety Concern" },
  { value: "other",           label: "📝 Other" },
];

const ReportModal = ({ contentType, contentId, contentTitle, contentOwner, onClose }) => {
  const [reason,    setReason]    = useState("");
  const [details,   setDetails]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]  = useState(false);
  const [error,     setError]      = useState("");
  const overlayRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  const handleSubmit = async () => {
    if (!reason) { setError("Please select a reason."); return; }
    const reporterUsername = localStorage.getItem("username");
    if (!reporterUsername) { setError("Please log in to report content."); return; }

    setSubmitting(true); setError("");
    try {
      const { error: dbErr } = await supabase.from("reports").insert({
        reporter_username: reporterUsername,
        content_type:      contentType,
        content_id:        String(contentId),
        content_title:     contentTitle || "Untitled",
        content_owner:     contentOwner || "Unknown",
        reason,
        details:           details.trim() || null,
        status:            "pending",
      });
      if (dbErr) throw dbErr;
      setSubmitted(true);
    } catch (e) {
      setError("Failed to submit report. Please try again.");
      console.error("Report error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="report_overlay"
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="report_modal">
        {/* Top accent bar */}
        <div className="report_modal_bar" />

        {submitted ? (
          /* ── Success state ── */
          <div className="report_success">
            <div className="report_success_icon">✅</div>
            <h3>Report Submitted</h3>
            <p>Thank you for helping keep ZIXPLON safe. Our team will review this content shortly.</p>
            <button className="report_btn report_btn--primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="report_header">
              <div>
                <h3 className="report_title">🚩 Report Content</h3>
                {contentTitle && (
                  <p className="report_subtitle">"{contentTitle}"</p>
                )}
              </div>
              <button className="report_close" onClick={onClose}>✕</button>
            </div>

            {/* Reason list */}
            <div className="report_reasons">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`report_reason_item ${reason === r.value ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => { setReason(r.value); setError(""); }}
                  />
                  <span>{r.label}</span>
                  {reason === r.value && <span className="report_check">✓</span>}
                </label>
              ))}
            </div>

            {/* Optional details */}
            <div className="report_details_wrap">
              <label className="report_details_label">Additional details (optional)</label>
              <textarea
                className="report_details_input"
                rows={3}
                placeholder="Describe the issue in more detail..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
              />
              <span className="report_char_count">{details.length}/500</span>
            </div>

            {error && <div className="report_error">⚠️ {error}</div>}

            {/* Actions */}
            <div className="report_actions">
              <button
                className="report_btn report_btn--primary"
                onClick={handleSubmit}
                disabled={submitting || !reason}
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
              <button className="report_btn report_btn--secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportModal;