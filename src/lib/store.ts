import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Settings } from './types';

let cachedSettings: Settings | null = null;
const listeners = new Set<(s: Settings | null) => void>();

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(cachedSettings);

  useEffect(() => {
    let mounted = true;
    const listener = (s: Settings | null) => mounted && setSettings(s);
    listeners.add(listener);
    if (!cachedSettings) {
      supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            cachedSettings = data as Settings;
            listeners.forEach((l) => l(cachedSettings));
          }
        });
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return settings;
}

export async function updateSettings(patch: Partial<Settings>) {
  const { data, error } = await supabase
    .from('settings')
    .update(patch)
    .eq('id', 1)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (data) {
    cachedSettings = data as Settings;
    listeners.forEach((l) => l(cachedSettings));
  }
  return data as Settings;
}

const BRANCH_STORAGE_KEY = 'selectedBranch';
let cachedBranch: string = localStorage.getItem(BRANCH_STORAGE_KEY) || 'all';
const branchListeners = new Set<(id: string) => void>();

/**
 * Global branch ("all" or a shop id) selected in the header switcher.
 * Every page (Orders, Salesmen, Workers, Cashbook, Dashboard) reads this
 * so the whole app stays scoped to one branch at a time.
 */
export function useSelectedBranch() {
  const [branch, setBranchState] = useState(cachedBranch);

  useEffect(() => {
    const listener = (id: string) => setBranchState(id);
    branchListeners.add(listener);
    return () => { branchListeners.delete(listener); };
  }, []);

  const setBranch = (id: string) => {
    cachedBranch = id;
    localStorage.setItem(BRANCH_STORAGE_KEY, id);
    branchListeners.forEach((l) => l(id));
  };

  return { branch, setBranch };
}

/** Filters a list of rows with a `shop_id` field by the selected branch. 'all' passes everything through. */
export function filterByBranch<T extends { shop_id: string | null }>(rows: T[], branch: string): T[] {
  if (branch === 'all') return rows;
  return rows.filter((r) => r.shop_id === branch);
}

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, setDark, toggle: () => setDark((d) => !d) };
}
