"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";

const LINKS = [
  ["/admin", "Overview"], ["/admin/analytics", "Analytics"], ["/admin/users", "Workspaces"], ["/admin/quizzes", "Quizzes"], ["/admin/questions", "Questions"],
  ["/admin/interviews", "Interviews"], ["/admin/news", "News"], ["/admin/announcements", "Announcements"], ["/admin/placements", "Placements"], ["/admin/resources", "Resources"], ["/admin/reports", "Moderation"],
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded bg-blood px-2 py-1 text-[11px] font-black uppercase tracking-widest">Admin</span>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto pb-1">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={cx("whitespace-nowrap rounded-md px-3 py-1.5 text-sm", path === href ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white")}>{label}</Link>
          ))}
        </nav>
      </div>
      {children}
    </>
  );
}
