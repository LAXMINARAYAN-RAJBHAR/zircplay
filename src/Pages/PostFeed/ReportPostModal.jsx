import React, { useState } from "react";
import "./ReportPostModal.css";

const REPORT_REASONS = [
  "Spam",
  "Nudity or sexual content",
  "Hate speech or harassment",
  "Violence or dangerous content",
  "False information",
  "Something else",
];

// Simple reason-picker + optional details modal. Submission is handled
// by the onReport callback (wired to Supabase in PostFeed), so this
// component stays presentation-only, matching how PostCard already
// delegates onReaction/onComment/onShare/onDelete/onEdit upward.
const ReportPostModal = ({ post, onClose, onReport }) => {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onReport(post.id, reason, details.trim());
      setSubmitted(true);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rpm-overlay" onClick={onClose}>
      <div className="rpm-panel" onClick={(e) => e.stopPropagation()}>
        <div className="rpm-header">
          <span>{submitted ? "Report submitted" : "Report post"}</span>
          <button className="rpm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {submitted ? (
          <div className="rpm-body">
            <p className="rpm-thanks">
              ✅ Thanks — your report has been sent to our team. We'll review
              it and take action if it breaks our community guidelines.
            </p>
            <button className="rpm-done-btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <div className="rpm-body">
            <p className="rpm-subtitle">
              Why are you reporting this post by <strong>{post.username}</strong>?
            </p>

            <div className="rpm-reasons">
              {REPORT_REASONS.map((r) => (
                <label key={r} className={`rpm-reason-row ${reason === r ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="rpm-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            <textarea
              className="rpm-details"
              placeholder="Add any extra details (optional)…"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />

            {error && <div className="rpm-error">{error}</div>}

            <button
              className="rpm-submit-btn"
              onClick={handleSubmit}
              disabled={!reason || submitting}
            >
              {submitting ? "Submitting…" : "Submit report"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportPostModal;