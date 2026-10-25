import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { isCloud, supabase } from './supabase';

interface AuthState {
  /** True until we know whether someone is signed in. */
  loading: boolean;
  /** Cloud mode needs a session; demo mode is always "signed in". */
  signedIn: boolean;
  session: Session | null;
  email: string | null;
  isCloud: boolean;
}

const AuthContext = createContext<AuthState>({ loading: true, signedIn: false, session: null, email: null, isCloud });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isCloud);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    loading,
    signedIn: isCloud ? !!session : true,
    session,
    email: session?.user.email ?? null,
    isCloud,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export async function signIn(email: string, password: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** Returns true when the person must confirm their email before signing in. */
export async function signUp(email: string, password: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(friendlyAuthError(error.message));
  return !data.session;
}

export async function resetPassword(email: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function signOut() {
  await supabase?.auth.signOut();
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return "That email and password don't match. Check them and try again.";
  if (m.includes('already registered')) return 'There is already an account with this email. Sign in instead.';
  if (m.includes('password')) return 'Use a password with at least 8 characters.';
  if (m.includes('email not confirmed')) return 'Confirm your email first. Check your inbox for the link.';
  if (m.includes('rate limit')) return 'Too many tries. Wait a few minutes and try again.';
  return message;
}
