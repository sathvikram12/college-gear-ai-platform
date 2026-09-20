"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg } from "./api";

/** Loads an API resource with loading / error / reload state. Pass null to skip. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!path);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!path) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    setError("");
    try {
      const d = await api<T>(path, { signal: c.signal });
      if (!c.signal.aborted) setData(d);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(errMsg(e));
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
    return () => ctrl.current?.abort();
  }, [load]);

  return { data, setData, error, loading, reload: load };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function qs(params: Record<string, string | undefined | null | boolean>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
