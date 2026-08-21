import React, { useState, useEffect } from "react";
import "./AdminPanel.css";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";

// ── Change this to your actual username (can be an email address) ────────────
const ADMIN_USERNAMES = ["laxminarayan.rajbhar@gmail.com"];

const STATUS_COLORS = {
  pending:   { bg: "#fff7ed", color: "#f97316", border: "#fed7aa" },
  reviewed:  { bg: "#eff6ff", color: "#3b82f6", border: "#bfdbfe" },
  removed:   { bg: "#fef2f2", color: "#ef4444", border: "#fecaca" },
  dismissed: { bg: "#f0fdf4", color: "#22c55e", border: "#bbf7d0" },
};

const REASON_LABELS = {
  inappropriate:  "🔞 Inappropriate",
  spam:           "📢 Spam",
  hate_speech:    "🚫 Hate Speech",
  violence:       "⚠️ Violence",
  misinformation: "❌ Misinformation",
  copyright:      "©️ Copyright",
  harassment:     "😡 Harassment",
  child_safety:   "🛡️ Child Safety",
  other:          "📝 Other",
};

const AdminPanel = () => {
  const currentUser      = localStorage.getItem("username") || "";
  const currentUserEmail = (localStorage.getItem("email") || "").trim();
  const isAdmin           = ADMIN_USERNAMES.includes(currentUserEmail.toLowerCase());

  const [reports,       setReports]       = useState([]);
  const [bannedWords,   setBannedWords]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState("reports");
  const [filterStatus,  setFilterStatus]  = useState("pending");
  const [newWord,       setNewWord]       = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [toast,         setToast]         = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const fetchReports = async () => {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setReports(data);
  };

  const fetchBannedWords = async () => {
    const { data } = await supabase
      .from("banned_words")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setBannedWords(data);
  };

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([fetchReports(), fetchBannedWords()]).finally(() => setLoading(false));

    // Realtime for new reports
    const channel = supabase
      .channel("admin-reports")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, () => {
        fetchReports();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [isAdmin]);

  // ── Report actions ──────────────────────────────────────────────────────────
  const updateReportStatus = async (reportId, status, adminNote = "") => {
    setActionLoading(reportId + status);
    const { error } = await supabase
      .from("reports")
      .update({ status, admin_note: adminNote || null, reviewed_at: new Date().toISOString() })
      .eq("id", reportId);
    if (!error) {
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status, admin_note: adminNote } : r));
      showToast(`Report marked as ${status}`);
    }
    setActionLoading(null);
  };

  const deleteContent = async (report) => {
  setActionLoading(report.id + "delete");
  try {
    if (report.content_type === "message") {
      const { error } = await supabase
        .from("direct_messages")
        .update({
          deleted_at: new Date().toISOString(),
          text: null,
          attachment_url: null,
          attachment_type: null,
          attachment_name: null,
          attachment_size: null,
          reactions: {},
        })
        .eq("id", report.content_id);
      if (error) throw error;
      await updateReportStatus(report.id, "removed", "Message deleted by admin");
      showToast(`✅ Message deleted and report closed`);
      return;
    }

    const table = report.content_type === "reel" ? "reels"
      : report.content_type === "video" ? "videos"
      : "posts";

    // Strip db_ prefix for reels
    const rawId = String(report.content_id).replace("db_", "");
    await supabase.from(table).delete().eq("id", rawId);
    await updateReportStatus(report.id, "removed", "Content deleted by admin");
    showToast(`✅ Content deleted and report closed`);
  } catch (e) {
    showToast("❌ Failed to delete content");
  }
  setActionLoading(null);
};

  // ── Banned words actions ────────────────────────────────────────────────────
  const addBannedWord = async () => {
    const word = newWord.trim().toLowerCase();
    if (!word) return;
    const { error } = await supabase.from("banned_words").insert({ word, added_by: currentUser });
    if (!error) {
      setBannedWords((prev) => [{ id: Date.now(), word, added_by: currentUser, created_at: new Date().toISOString() }, ...prev]);
      setNewWord("");
      showToast(`"${word}" added to banned list`);
    } else {
      showToast("Word already exists or error occurred");
    }
  };

  const removeBannedWord = async (id, word) => {
    await supabase.from("banned_words").delete().eq("id", id);
    setBannedWords((prev) => prev.filter((w) => w.id !== id));
    showToast(`"${word}" removed`);
  };

  if (!isAdmin) {
    return (
      <div className="admin_blocked">
        <div className="admin_blocked_icon">🔒</div>
        <h2>Access Denied</h2>
        <p>You don't have permission to view this page.</p>
        {/* ── TEMPORARY DEBUG — remove once confirmed working ── */}
        <p style={{ fontSize: "12px", color: "#999", wordBreak: "break-all", maxWidth: "320px" }}>
          Debug: localStorage "email" = "{localStorage.getItem("email")}"<br />
          Expected: "laxminarayan.rajbhar@gmail.com"
        </p>
        <Link to="/" className="admin_back_btn">← Go Home</Link>
      </div>
    );
  }

  const filteredReports = reports.filter((r) => filterStatus === "all" ? true : r.status === filterStatus);
  const pendingCount    = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="admin_panel">
      {/* Toast */}
      {toast && <div className="admin_toast">{toast}</div>}

      {/* Header */}
      <div className="admin_header">
        <div>
          <h1 className="admin_title">🛡️ Admin Panel</h1>
          <p className="admin_subtitle">ZIXPLON Content Moderation</p>
        </div>
        <Link to="/" className="admin_back_btn">← Back to ZIXPLON</Link>
      </div>

      {/* Stats bar */}
      <div className="admin_stats">
        {[
          { label: "Pending",   value: reports.filter((r) => r.status === "pending").length,   color: "#f97316" },
          { label: "Reviewed",  value: reports.filter((r) => r.status === "reviewed").length,  color: "#3b82f6" },
          { label: "Removed",   value: reports.filter((r) => r.status === "removed").length,   color: "#ef4444" },
          { label: "Dismissed", value: reports.filter((r) => r.status === "dismissed").length, color: "#22c55e" },
          { label: "Total",     value: reports.length,                                          color: "#7c3aed" },
        ].map((s) => (
          <div key={s.label} className="admin_stat_card">
            <div className="admin_stat_value" style={{ color: s.color }}>{s.value}</div>
            <div className="admin_stat_label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="admin_tabs">
        <button className={`admin_tab ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
          🚩 Reports {pendingCount > 0 && <span className="admin_badge">{pendingCount}</span>}
        </button>
        <button className={`admin_tab ${activeTab === "words" ? "active" : ""}`} onClick={() => setActiveTab("words")}>
          🔤 Banned Words ({bannedWords.length})
        </button>
      </div>

      {loading ? (
        <div className="admin_loading">
          <div className="admin_spinner" />
          <p>Loading...</p>
        </div>
      ) : activeTab === "reports" ? (
        <>
          {/* Status filter */}
          <div className="admin_filter_row">
            {["all", "pending", "reviewed", "removed", "dismissed"].map((s) => (
              <button
                key={s}
                className={`admin_filter_btn ${filterStatus === s ? "active" : ""}`}
                onClick={() => setFilterStatus(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== "all" && <span className="admin_filter_count">{reports.filter((r) => r.status === s).length}</span>}
              </button>
            ))}
          </div>

          {/* Reports list */}
          {filteredReports.length === 0 ? (
            <div className="admin_empty">
              <div style={{ fontSize: "48px" }}>✅</div>
              <p>No {filterStatus === "all" ? "" : filterStatus} reports</p>
            </div>
          ) : (
            <div className="admin_reports_list">
              {filteredReports.map((report) => {
                const sc = STATUS_COLORS[report.status] || STATUS_COLORS.pending;
                return (
                  <div key={report.id} className="admin_report_card">
                    {/* Card header */}
                    <div className="admin_report_header">
                      <div className="admin_report_meta">
                        <span className="admin_report_type">{report.content_type.toUpperCase()}</span>
                        <span className="admin_report_reason">{REASON_LABELS[report.reason] || report.reason}</span>
                        <span className="admin_report_status" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                          {report.status}
                        </span>
                      </div>
                      <span className="admin_report_time">
                        {new Date(report.created_at).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                      </span>
                    </div>

                    {/* Content info */}
                    <div className="admin_report_content">
                      <div className="admin_report_field">
                        <span className="admin_report_field_label">Content</span>
                        <span className="admin_report_field_value">"{report.content_title}"</span>
                      </div>
                      <div className="admin_report_field">
                        <span className="admin_report_field_label">Uploader</span>
                        <span className="admin_report_field_value">@{report.content_owner}</span>
                      </div>
                      <div className="admin_report_field">
                        <span className="admin_report_field_label">Reported by</span>
                        <span className="admin_report_field_value">@{report.reporter_username}</span>
                      </div>
                      {report.details && (
                        <div className="admin_report_field">
                          <span className="admin_report_field_label">Details</span>
                          <span className="admin_report_field_value admin_report_details">{report.details}</span>
                        </div>
                      )}
                      {report.admin_note && (
                        <div className="admin_report_field">
                          <span className="admin_report_field_label">Admin note</span>
                          <span className="admin_report_field_value" style={{ color: "#7c3aed", fontWeight: 700 }}>{report.admin_note}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions — only show if pending or reviewed */}
                    {(report.status === "pending" || report.status === "reviewed") && (
                      <div className="admin_report_actions">
                        <button
                          className="admin_action_btn admin_action_btn--delete"
                          onClick={() => deleteContent(report)}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === report.id + "delete" ? "Deleting..." : "🗑️ Delete Content"}
                        </button>
                        <button
                          className="admin_action_btn admin_action_btn--dismiss"
                          onClick={() => updateReportStatus(report.id, "dismissed")}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === report.id + "dismissed" ? "..." : "✓ Dismiss"}
                        </button>
                        {report.status === "pending" && (
                          <button
                            className="admin_action_btn admin_action_btn--review"
                            onClick={() => updateReportStatus(report.id, "reviewed")}
                            disabled={!!actionLoading}
                          >
                            {actionLoading === report.id + "reviewed" ? "..." : "👁 Mark Reviewed"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ── Banned Words Tab ── */
        <div className="admin_words_section">
          {/* Add word */}
          <div className="admin_add_word_row">
            <input
              type="text"
              className="admin_word_input"
              placeholder="Add a new banned word or phrase..."
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBannedWord()}
            />
            <button className="admin_add_word_btn" onClick={addBannedWord}>+ Add</button>
          </div>
          <p className="admin_words_hint">These words are automatically blocked at upload time. Case-insensitive.</p>

          {/* Words grid */}
          <div className="admin_words_grid">
            {bannedWords.map((w) => (
              <div key={w.id} className="admin_word_chip">
                <span className="admin_word_text">{w.word}</span>
                <button className="admin_word_remove" onClick={() => removeBannedWord(w.id, w.word)} title="Remove">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;