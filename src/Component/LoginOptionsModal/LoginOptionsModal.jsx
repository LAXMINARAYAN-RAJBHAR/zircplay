import React, { useState } from "react";
import { supabase } from "../../config/supabase";
import "./LoginOptionsModal.css";

export default function LoginOptionsModal({ onDismiss }) {
  const [mode, setMode] = useState("options"); // 'options' | 'email'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    }
    // On success, App.js's onAuthStateChange listener updates currentUser
    // and closes this modal automatically — no need to call onDismiss here.
  };

  return (
    <div className="login-modal-backdrop" onClick={onDismiss}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onDismiss} aria-label="Close">×</button>

        {mode === "options" && (
          <>
            <h2>Sign in to ZIXPLON</h2>
            <p className="login-modal-subtitle">Pick a way to continue</p>

            <button className="login-option-btn google" onClick={handleGoogleLogin}>
              <GoogleIcon /> Continue with Google
            </button>

            <button className="login-option-btn email" onClick={() => setMode("email")}>
              Continue with Email
            </button>

            <button className="login-option-btn skip" onClick={onDismiss}>
              Continue browsing without signing in
            </button>

            {error && <p className="login-modal-error">{error}</p>}
          </>
        )}

        {mode === "email" && (
          <form onSubmit={handleEmailLogin}>
            <h2>Sign in with Email</h2>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="login-modal-error">{error}</p>}
            <button type="submit" className="login-option-btn google" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <button type="button" className="login-option-btn skip" onClick={() => setMode("options")}>
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.9 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3c-7.7 0-14.3 4.4-17.7 10.7z"/>
      <path fill="#4CAF50" d="M24 45c5.4 0 10.3-1.8 14.1-5l-6.5-5.5C29.6 36 26.9 37 24 37c-5.3 0-9.8-3.1-11.4-7.6l-6.6 5.1C9.6 40.6 16.2 45 24 45z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.8-2.9 5.1-5.4 6.5l6.5 5.5C39.9 37.5 43 31.7 43 24c0-1.4-.1-2.7-.4-3.5z"/>
    </svg>
  );
}