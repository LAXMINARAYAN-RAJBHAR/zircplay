import React, { useState, useEffect } from "react";
import { supabase } from "../../config/supabase";
import { addGroupMembers } from "../../utils/groupChat";
import "./AddMembersModal.css";

// Lets a group member search for people not already in the group and
// add one or more of them at once. Mirrors the "select" step of
// NewGroupOrBroadcastModal so the search/select UX stays consistent.
const AddMembersModal = ({ group, existingUsernames, currentUser, onClose, onAdded }) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState([]); // array of usernames
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const existingSet = new Set(existingUsernames);

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
      setResults((data || []).filter((p) => !existingSet.has(p.username)));
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, currentUser]);

  const toggleSelect = (username) => {
    setSelected((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username],
    );
  };

  const handleAdd = async () => {
    if (selected.length === 0 || adding) return;
    setAdding(true);
    setError("");
    try {
      await addGroupMembers(group.id, selected);
      onAdded(selected);
    } catch (e) {
      setError("Something went wrong. Please try again.");
      setAdding(false);
    }
  };

  return (
    <div className="amm-overlay" onClick={onClose}>
      <div className="amm-panel" onClick={(e) => e.stopPropagation()}>
        <div className="amm-header">
          <span>Add members to {group.name}</span>
          <button className="amm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="amm-search-row">
          <input
            type="text"
            placeholder="Search people to add…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {selected.length > 0 && (
          <div className="amm-selected-chips">
            {selected.map((u) => (
              <span key={u} className="amm-chip" onClick={() => toggleSelect(u)}>
                {u} ✕
              </span>
            ))}
          </div>
        )}

        <div className="amm-results">
          {searching ? (
            <p className="amm-empty">Searching…</p>
          ) : results.length === 0 ? (
            <p className="amm-empty">
              {search.trim() ? "No matches." : "Search for people to add."}
            </p>
          ) : (
            results.map((p) => (
              <div
                key={p.username}
                className={`amm-result-item ${selected.includes(p.username) ? "selected" : ""}`}
                onClick={() => toggleSelect(p.username)}
              >
                <div className="amm-avatar">{p.username.slice(0, 2).toUpperCase()}</div>
                <span>{p.username}</span>
                <span className="amm-check">{selected.includes(p.username) ? "✓" : ""}</span>
              </div>
            ))
          )}
        </div>

        {error && <div className="amm-error">{error}</div>}

        <button className="amm-add-btn" onClick={handleAdd} disabled={selected.length === 0 || adding}>
          {adding ? "Adding…" : `Add (${selected.length})`}
        </button>
      </div>
    </div>
  );
};

export default AddMembersModal;