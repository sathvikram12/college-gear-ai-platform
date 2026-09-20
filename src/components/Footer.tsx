import Link from "next/link";

export function Footer() {
  const links = [
    { href: "/#about", label: "About" },
    { href: "/#features", label: "Features" },
    { href: "/resources", label: "Resources" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "mailto:hello@collegegear.dev", label: "Contact" },
    { href: "https://github.com", label: "GitHub" },
  ];
  return (
    <footer className="border-t border-line bg-black">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xl font-black tracking-tight">
            COLLEGE<span className="text-accent">GEAR</span>
          </p>
          <p className="mt-1 text-sm text-muted">Your AI-Powered College Companion</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {links.map((l) => (
              <li key={l.label}>
                {l.href.startsWith("http") || l.href.startsWith("mailto") ? (
                  <a href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="text-muted transition-colors hover:text-accent">{l.label}</a>
                ) : (
                  <Link href={l.href} className="text-muted transition-colors hover:text-accent">{l.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-xs text-muted/70">© {new Date().getFullYear()} COLLEGE GEAR. Built for students. Demo data is clearly labelled.</div>
    </footer>
  );
}
