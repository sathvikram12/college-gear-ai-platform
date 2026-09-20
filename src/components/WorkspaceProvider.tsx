"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

/** Display info for the current user (name/avatar in the navbar): the signed-in account, or the anonymous workspace. */
export type WorkspaceUser = { id: string; name: string; role: "student" | "faculty" | "admin"; avatar?: string | null };
/** Optional account (null for public visitors). Sessions live in an httpOnly cookie, never in JS. */
export type Account = { id: string; name: string; email: string; role: "student" | "faculty" | "admin"; createdAt: string; lastLoginAt: string | null };
type Session = { authenticated: boolean; user: Account | null };
type Ctx = {
  user: WorkspaceUser | null;
  account: Account | null;
  authReady: boolean;
  refresh: () => Promise<{ authenticated: boolean }>;
  logout: () => Promise<void>;
};

const WorkspaceCtx = createContext<Ctx>({ user: null, account: null, authReady: false, refresh: async () => ({ authenticated: false }), logout: async () => {} });
export const useWorkspace = () => useContext(WorkspaceCtx);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WorkspaceUser | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const refresh = useCallback(async () => {
    const [w, s] = await Promise.all([api<{ user: WorkspaceUser }>("/workspace").catch(() => null), api<Session>("/auth/session").catch(() => null)]);
    if (w) setUser(w.user);
    setAccount(s?.authenticated ? s.user : null);
    setAuthReady(true);
    return { authenticated: !!s?.authenticated };
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setAccount(null);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    let active = true;
    Promise.all([api<{ user: WorkspaceUser }>("/workspace").catch(() => null), api<Session>("/auth/session").catch(() => null)]).then(([w, s]) => {
      if (!active) return;
      if (w) setUser(w.user);
      setAccount(s?.authenticated ? s.user : null);
      setAuthReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return <WorkspaceCtx.Provider value={{ user, account, authReady, refresh, logout }}>{children}</WorkspaceCtx.Provider>;
}
