"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { cx } from "./ui";

export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/jarvis", label: "Jarvis" },
  { href: "/notes", label: "Notes" },
  { href: "/quizzes", label: "Quizzes" },
  { href: "/interview", label: "Interview" },
  { href: "/schedule", label: "Schedule" },
  { href: "/coding", label: "Coding" },
  { href: "/career", label: "Career" },
  { href: "/resume", label: "Resume" },
  { href: "/news", label: "News" },
  { href: "/resources", label: "Resources" },
  { href: "/profile", label: "Profile" },
];
export const MORE_ITEMS = [
  { href: "/dashboard", label: "Command Center" },
  { href: "/placements", label: "Placements" },
  { href: "/cover-letter", label: "Cover Letter" },
  { href: "/assignments", label: "Assignment Checker" },
  { href: "/announcements", label: "Announcements" },
  { href: "/community", label: "Community" },
  { href: "/settings", label: "Settings" },
];

function Logo() {
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label="COLLEGE GEAR home">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-blood font-black text-white shadow-[0_0_18px_-2px_rgba(193,18,31,0.8)] transition-transform group-hover:rotate-12">⚙</span>
      <span className="text-lg font-black tracking-tight">
        COLLEGE<span className="text-accent">GEAR</span>
      </span>
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { user, account, logout } = useWorkspace();
  const router = useRouter();
  const doLogout = async () => {
    await logout();
    router.push("/");
  };
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    setOpen(false);
    setMore(false);
  }, [pathname]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => moreRef.current && !moreRef.current.contains(e.target as Node) && setMore(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setMore(false), setOpen(false));
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const extra = [...MORE_ITEMS, { href: "/admin", label: "Admin Panel" }];

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-blood focus:px-3 focus:py-2">Skip to content</a>
      <nav className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-4 px-4 sm:px-6" aria-label="Main navigation">
        <Logo />
        <ul className="ml-4 hidden flex-1 items-center gap-0.5 xl:flex">
          {NAV_ITEMS.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={isActive(it.href) ? "page" : undefined}
                className={cx(
                  "relative block rounded-md px-2.5 py-2 text-[13.5px] font-semibold transition-all duration-200 hover:scale-[1.06] hover:bg-blood/15 hover:text-white hover:shadow-[0_0_18px_-6px_rgba(193,18,31,0.9)]",
                  isActive(it.href) ? "text-white" : "text-muted"
                )}
              >
                {it.label}
                {isActive(it.href) && <span className="absolute inset-x-2 -bottom-[15px] h-[3px] rounded-full bg-accent shadow-[0_0_12px_rgba(193,18,31,0.9)]" />}
              </Link>
            </li>
          ))}
          <li className="relative" ref={moreRef}>
            <button
              onClick={() => setMore((v) => !v)}
              aria-expanded={more}
              aria-haspopup="menu"
              className="rounded-md px-2.5 py-2 text-[13.5px] font-semibold text-muted transition-all hover:scale-[1.06] hover:bg-blood/15 hover:text-white"
            >
              More ▾
            </button>
            {more && (
              <div role="menu" className="cg-card cg-fade-up absolute right-0 top-12 w-56 !p-1.5 shadow-2xl">
                {extra.map((it) => (
                  <Link key={it.href} role="menuitem" href={it.href} className={cx("block rounded px-3 py-2 text-sm hover:bg-blood/20", isActive(it.href) ? "text-white" : "text-muted")}>
                    {it.label}
                  </Link>
                ))}
                <div className="my-1 border-t border-line" />
                {account ? (
                  <>
                    <Link role="menuitem" href="/account" className={cx("block rounded px-3 py-2 text-sm hover:bg-blood/20", isActive("/account") ? "text-white" : "text-muted")}>My Account</Link>
                    <button role="menuitem" onClick={doLogout} className="block w-full rounded px-3 py-2 text-left text-sm text-muted hover:bg-blood/20">Log out</button>
                  </>
                ) : (
                  <>
                    <Link role="menuitem" href="/login" className="block rounded px-3 py-2 text-sm text-muted hover:bg-blood/20">Log in</Link>
                    <Link role="menuitem" href="/signup" className="block rounded px-3 py-2 text-sm text-muted hover:bg-blood/20">Sign up</Link>
                  </>
                )}
              </div>
            )}
          </li>
        </ul>
        <div className="ml-auto hidden items-center gap-2 xl:flex">
          {pathname === "/" ? (
            <Link href="/dashboard" className="rounded-md bg-blood px-4 py-2 text-sm font-bold text-white hover:bg-accent hover:shadow-[0_0_20px_-4px_rgba(193,18,31,0.8)]">Open App</Link>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-sm hover:border-accent/60">
              {user?.avatar ? <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-deep text-xs font-bold">{(user?.name ?? "S")[0]?.toUpperCase()}</span>}
              <span className="max-w-[110px] truncate">{user?.name.split(" ")[0] ?? "Student"}</span>
            </Link>
          )}
          {account ? (
            <>
              <Link href="/account" className="rounded-md px-2.5 py-2 text-sm font-semibold text-muted hover:bg-white/5 hover:text-white">Account</Link>
              <button onClick={doLogout} className="rounded-md px-2.5 py-2 text-sm font-semibold text-muted hover:bg-white/5 hover:text-white">Log out</button>
            </>
          ) : (
            <Link href="/login" className="rounded-md px-2.5 py-2 text-sm font-semibold text-muted hover:bg-white/5 hover:text-white">Log in</Link>
          )}
        </div>
        <button onClick={() => setOpen(true)} className="ml-auto rounded-md border border-line p-2 xl:hidden" aria-label="Open menu" aria-expanded={open}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-[70] xl:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="cg-fade-up absolute right-0 top-0 flex h-full w-[min(88vw,340px)] flex-col overflow-y-auto border-l border-line bg-surface p-5">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded p-2 text-muted hover:text-white">✕</button>
            </div>
            <ul className="space-y-1">
              {[...NAV_ITEMS, ...extra].map((it) => (
                <li key={it.href}>
                  <Link href={it.href} className={cx("block rounded-md border-l-2 px-3 py-2.5 text-[15px] font-semibold transition-colors", isActive(it.href) ? "border-accent bg-blood/15 text-white" : "border-transparent text-muted hover:bg-white/5 hover:text-white")}>
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-line pt-4">
              <Link href="/dashboard" className="block rounded-md bg-blood py-2.5 text-center text-sm font-bold hover:bg-accent">Open App</Link>
              {account ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link href="/account" className="rounded-md border border-line py-2.5 text-center text-sm font-semibold">My Account</Link>
                  <button onClick={doLogout} className="rounded-md border border-line py-2.5 text-center text-sm font-semibold">Log out</button>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link href="/login" className="rounded-md border border-line py-2.5 text-center text-sm font-semibold">Log in</Link>
                  <Link href="/signup" className="rounded-md border border-line py-2.5 text-center text-sm font-semibold">Sign up</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
