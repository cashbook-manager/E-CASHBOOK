import { useEffect, useState } from 'react';

const SESSION_KEY = 'admin_authorized';
const listeners = new Set<() => void>();

function readSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeSession(v: boolean) {
  try {
    if (v) sessionStorage.setItem(SESSION_KEY, 'true');
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useAdminAuth() {
  const [authorized, setAuthorized] = useState(readSession());

  useEffect(() => {
    const listener = () => setAuthorized(readSession());
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return {
    authorized,
    login: () => writeSession(true),
    logout: () => writeSession(false),
  };
}

export async function verifyPassword(password: string): Promise<{ authorized: boolean; error?: string }> {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-password`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      return { authorized: false, error: 'Server error. Try again.' };
    }
    const data = await res.json();
    if (data && typeof data.authorized === 'boolean') {
      return { authorized: data.authorized, error: data.authorized ? undefined : 'Incorrect password' };
    }
    return { authorized: false, error: 'Unexpected response from server.' };
  } catch {
    return { authorized: false, error: 'Network error. Check your connection.' };
  }
}

export function isAdminAuthorized(): boolean {
  return readSession();
}