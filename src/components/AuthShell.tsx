import Link from "next/link";
import type { ReactNode } from "react";

/** Layout for the optional Log in / Sign up pages (same visual language as the rest of the site). */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main id="main" className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,#2a0000_0%,#050505_65%)]" />
      <div aria-hidden className="cg-grid-bg absolute inset-0 -z-10 opacity-50" />
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-3xl font-black tracking-tight">
          COLLEGE<span className="text-accent">GEAR</span>
        </Link>
        <div className="cg-card cg-fade-up p-7 shadow-[0_30px_80px_-30px_rgba(139,0,0,0.6)]">
          <h1 className="text-2xl font-black">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
        {footer && <div className="mt-6 space-y-2 text-center text-sm text-muted">{footer}</div>}
        <p className="mt-4 text-center text-sm">
          <Link href="/dashboard" className="text-muted hover:text-accent">Continue without an account →</Link>
        </p>
      </div>
    </main>
  );
}

/** Shown when the browser refused the httpOnly login cookie (e.g. inside an embedded preview frame). */
export const COOKIE_BLOCKED_MESSAGE =
  "Your browser blocked the secure login cookie (this happens when the site is shown inside an embedded preview). Open the website in its own browser tab to use your account.";
