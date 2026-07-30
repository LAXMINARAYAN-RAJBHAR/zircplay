import React, { useState } from "react";
import { supabase } from "../../config/supabase";
import "./UsernameSetupModal.css";

// Only lowercase letters, numbers, and underscores — adjust to match
// whatever rule your signup form already enforces for usernames.
const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;

const UsernameSetupModal = ({ onComplete }) => {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const candidate = value.trim().toLowerCase();

    if (!USERNAME_RULE.test(candidate)) {
      setError("3-20 characters: lowercase letters, numbers, and underscores only.");
      return;
    }

    setChecking(true);
    setError("");

    const oldUsername = localStorage.getItem("username");
    const userId = localStorage.getItem("userId");

    try {
      // Uniqueness check
      const { data: existing } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", candidate)
        .maybeSingle();

      if (existing) {
        setError("That username is already taken.");
        setChecking(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ username: candidate })
        .eq("id", userId);

      if (updateError) {
        setError("Something went wrong. Please try again.");
        setChecking(false);
        return;
      }

      localStorage.setItem("username", candidate);
      onComplete(candidate, oldUsername);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="username-setup-overlay">
      <div className="username-setup-panel">
        <h2>Choose your username</h2>
        <p>
          You're currently using a temporary ID. Pick a real username so
          people can recognize you in chats, comments, and your profile.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. rahul_dev"
            autoFocus
            disabled={checking}
          />
          {error && <div className="username-setup-error">{error}</div>}
          <button type="submit" disabled={checking || !value.trim()}>
            {checking ? "Saving…" : "Save username"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UsernameSetupModal;