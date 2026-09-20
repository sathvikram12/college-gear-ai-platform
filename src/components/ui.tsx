"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import Link from "next/link";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

/* ---------------- Button ---------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; loading?: boolean };
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: "bg-blood text-white hover:bg-accent shadow-[0_0_0_1px_rgba(193,18,31,0.4)] hover:shadow-[0_0_24px_-4px_rgba(193,18,31,0.7)]",
    secondary: "bg-surface-2 text-light border border-line hover:border-accent/60 hover:bg-[#1a1a1a]",
    ghost: "text-muted hover:text-light hover:bg-white/5",
    danger: "bg-transparent text-red-400 border border-red-900/60 hover:bg-red-950/50",
  }[variant];
  const s = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" }[size];
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]", v, s, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: "primary" | "secondary"; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200",
        variant === "primary" ? "bg-blood text-white hover:bg-accent hover:shadow-[0_0_24px_-4px_rgba(193,18,31,0.7)]" : "bg-surface-2 border border-line hover:border-accent/60",
        className
      )}
    >
      {children}
    </Link>
  );
}

/* ---------------- Form fields ---------------- */
export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-muted">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted/70">{hint}</p>}
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
export function Input({ label, error, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }) {
  const id = useId();
  const el = <input id={id} aria-invalid={!!error} className={cx("cg-input", className)} {...rest} />;
  return label ? <Field label={label} error={error} hint={hint} id={id}>{el}</Field> : el;
}
export function Textarea({ label, error, hint, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string }) {
  const id = useId();
  const el = <textarea id={id} aria-invalid={!!error} className={cx("cg-input min-h-[96px] resize-y", className)} {...rest} />;
  return label ? <Field label={label} error={error} hint={hint} id={id}>{el}</Field> : el;
}
export function Select({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const id = useId();
  const el = <select id={id} className={cx("cg-input", className)} {...rest}>{children}</select>;
  return label ? <Field label={label} id={id}>{el}</Field> : el;
}

export function TagInput({ label, value, onChange, placeholder, max = 30 }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number }) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const add = () => {
    const parts = draft.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])].slice(0, max));
    setDraft("");
  };
  return (
    <Field label={label} id={id} hint="Press Enter or comma to add">
      <div className="cg-input flex flex-wrap gap-1.5 !py-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded bg-blood/25 border border-blood/40 px-2 py-0.5 text-xs">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="text-muted hover:text-white">×</button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
            else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          placeholder={placeholder}
          className="min-w-[120px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-[#6b6b6b]"
        />
      </div>
    </Field>
  );
}

/* ---------------- Layout primitives ---------------- */
export function Card({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={cx("cg-card p-5", hover && "cg-card-hover", className)}>{children}</div>;
}
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "red" | "green" | "amber" | "blue"; className?: string }) {
  const t = { neutral: "bg-white/5 text-muted border-line", red: "bg-blood/20 text-red-300 border-blood/50", green: "bg-emerald-950/60 text-emerald-300 border-emerald-900", amber: "bg-amber-950/50 text-amber-300 border-amber-900", blue: "bg-sky-950/50 text-sky-300 border-sky-900" }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", t, className)}>{children}</span>;
}
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between cg-fade-up">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>}
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cx("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", value === t.value ? "bg-blood text-white" : "text-muted hover:text-light hover:bg-white/5")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
export function SearchBar({ value, onChange, placeholder = "Search…", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cx("relative", className)}>
      <svg aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input type="search" aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="cg-input !pl-9" />
    </div>
  );
}

/* ---------------- Feedback ---------------- */
export function Spinner({ size = 20 }: { size?: number }) {
  return <span role="status" aria-label="Loading" style={{ width: size, height: size }} className="inline-block animate-spin rounded-full border-2 border-white/20 border-t-accent" />;
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-white/[0.06]", className)} />;
}
export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
}
export function EmptyState({ title, description, action, icon = "◇" }: { title: string; description?: string; action?: ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <div className="mb-3 text-3xl text-accent" aria-hidden>{icon}</div>
      <h3 className="font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-red-900/60 bg-red-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-red-300">⚠ {message}</p>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  );
}
export function AiNotice({ children }: { children?: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-blood/30 bg-blood/10 px-3 py-2 text-xs text-red-200/90">
      <span aria-hidden>✦</span>
      <span>{children ?? "AI-generated content. It may contain mistakes — verify important information."}</span>
    </p>
  );
}

/* ---------------- Modal & confirm ---------------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the open/focus effect: callers pass an inline
  // `() => setX(false)` that changes every render, which previously stole focus on each keystroke.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,textarea,select,button")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx("cg-card cg-fade-up max-h-[92vh] w-full overflow-y-auto !rounded-b-none p-5 sm:!rounded-lg", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-muted hover:bg-white/5 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onCancel, loading }: { open: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

/* ---------------- Toasts ---------------- */
type Toast = { id: number; msg: string; tone: "success" | "error" | "info" };
const ToastCtx = createContext<(msg: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cx("cg-fade-up pointer-events-auto rounded-md border px-4 py-3 text-sm shadow-xl backdrop-blur", t.tone === "error" ? "border-red-800 bg-red-950/90 text-red-100" : t.tone === "info" ? "border-line bg-surface-2/95" : "border-blood/60 bg-[#1a0505]/95 text-light")}>
            {t.tone === "error" ? "⚠ " : t.tone === "success" ? "✓ " : ""}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Dashboard cards ---------------- */
export function useCountUp(target: number, ms = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
export function StatCard({ label, value, suffix = "", hint, href }: { label: string; value: number | null; suffix?: string; hint?: string; href?: string }) {
  const n = useCountUp(value ?? 0);
  const body = (
    <Card hover={!!href} className="h-full !p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-3xl font-black tabular-nums">{value === null ? <span className="text-muted">—</span> : <>{n}<span className="text-lg text-accent">{suffix}</span></>}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      {label && <div className="mb-1 flex justify-between text-xs text-muted"><span>{label}</span><span>{Math.round(value)}%</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-white/5" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-deep to-accent transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
