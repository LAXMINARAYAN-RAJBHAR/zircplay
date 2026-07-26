import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient'; // adjust path to your existing client

const AuthGateContext = createContext(null);
export const useAuthGate = () => useContext(AuthGateContext);

// Fetches the username string for a given Supabase auth user.
// Adjust table/column names to match your `profiles` table.
async function resolveUsername(supabaseUser) {
  if (!supabaseUser) return null;

  // 1. Try profiles table first (source of truth for username)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', supabaseUser.id)
    .single();

  if (!error && profile?.username) {
    return profile.username;
  }

  // 2. Fallback to user_metadata or email prefix
  return (
    supabaseUser.user_metadata?.username ||
    supabaseUser.user_metadata?.full_name ||
    supabaseUser.email?.split('@')[0] ||
    'user'
  );
}

export function AuthGateProvider({ children, onUserResolved }) {
  const [checking, setChecking] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      // Silent session restore
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const username = await resolveUsername(session.user);
        if (mounted) {
          onUserResolved(username); // sets currentUser as plain string
          setShowLoginModal(false);
          setChecking(false);
        }
      } else {
        if (mounted) {
          setShowLoginModal(true); // no session -> auto-show login options
          setChecking(false);
        }
      }
    }

    init();

    // Keep listening for future changes (login/logout in other tabs, token refresh, etc.)
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const username = await resolveUsername(session.user);
        onUserResolved(username);
        setShowLoginModal(false);
      }
      if (event === 'SIGNED_OUT') {
        onUserResolved(null);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [onUserResolved]);

  return (
    <AuthGateContext.Provider value={{ checking, showLoginModal, setShowLoginModal }}>
      {children}
    </AuthGateContext.Provider>
  );
}