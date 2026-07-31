import React, { useState, useEffect } from "react";
import { supabase } from "../../config/supabase";
import { createGroup } from "../../utils/groupChat";
import { createBroadcastList } from "../../utils/broadcast";
import "./NewGroupOrBroadcastModal.css";

// mode: "group" | "broadcast"
const NewGroupOrBroadcastModal = ({ mode, currentUser, onClose, onCreated }) => {
  const [step, setStep] = useState("select"); // "select" -> "name"
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState([]); // array of usernames
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .ilike("username", `%${query}%`)
        .neq("username", currentUser)
        .limit(10);
      setResults(data || []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, currentUser]);

  const toggleSelect = (username) => {
    setSelected((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username],
    );
  };

  const goToNameStep = () => {
    if (selected.length === 0) return;
    setStep("name");
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Please give it a name.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      if (mode === "group") {
        const group = await createGroup({
          name: name.trim(),
          createdBy: currentUser,
          memberUsernames: selected,
        });
        onCreated({ type: "group", data: group });
      } else {
        const list = await createBroadcastList({
          name: name.trim(),
          createdBy: currentUser,
          recipientUsernames: selected,
        });
        onCreated({ type: "broadcast", data: list });
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
      setCreating(false);
    }
  };

  const title = mode === "group" ? "New Group" : "New Broadcast List";
  const nameLabel = mode === "group" ? "Group name" : "List name";
  const namePlaceholder = mode === "group" ? "e.g. Weekend Trip" : "e.g. Close Friends";

  return (
    <div className="ngb-overlay" onClick={onClose}>
      <div className="ngb-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ngb-header">
          <span>{step === "select" ? title : `Name your ${mode === "group" ? "group" : "list"}`}</span>
          <button className="ngb-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {step === "select" ? (
          <>
            <div className="ngb-search-row">
              <input
                type="text"
                placeholder="Search people to add…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {selected.length > 0 && (
              <div className="ngb-selected-chips">
                {selected.map((u) => (
                  <span key={u} className="ngb-chip" onClick={() => toggleSelect(u)}>
                    {u} ✕
                  </span>
                ))}
              </div>
            )}

            <div className="ngb-results">
              {searching ? (
                <p className="ngb-empty">Searching…</p>
              ) : results.length === 0 ? (
                <p className="ngb-empty">{search.trim() ? "No matches." : "Search for people to add."}</p>
              ) : (
                results.map((p) => (
                  <div
                    key={p.username}
                    className={`ngb-result-item ${selected.includes(p.username) ? "selected" : ""}`}
                    onClick={() => toggleSelect(p.username)}
                  >
                    <div className="ngb-avatar">{p.username.slice(0, 2).toUpperCase()}</div>
                    <span>{p.username}</span>
                    <span className="ngb-check">{selected.includes(p.username) ? "✓" : ""}</span>
                  </div>
                ))
              )}
            </div>

            <button
              className="ngb-next-btn"
              onClick={goToNameStep}
              disabled={selected.length === 0}
            >
              Next ({selected.length} selected)
            </button>
          </>
        ) : (
          <>
            <label className="ngb-name-label">{nameLabel}</label>
            <input
              type="text"
              className="ngb-name-input"
              placeholder={namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {error && <div className="ngb-error">{error}</div>}
            <div className="ngb-name-actions">
              <button className="ngb-back-btn" onClick={() => setStep("select")} disabled={creating}>
                Back
              </button>
              <button className="ngb-create-btn" onClick={handleCreate} disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NewGroupOrBroadcastModal;