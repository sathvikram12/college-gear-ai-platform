import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const FEATURES = [
  { icon: "✦", title: "Jarvis AI Assistant", text: "Ask academic, career and study questions. Structured answers with steps, resources and in-app actions.", href: "/jarvis" },
  { icon: "▤", title: "Smart Notes", text: "Tag, pin, archive and search notes. Summarize, explain or generate revision points with AI.", href: "/notes" },
  { icon: "◎", title: "Timed Quizzes", text: "8 subjects, randomized 15-question sets, server-side scoring, explanations and attempt history.", href: "/quizzes" },
  { icon: "◉", title: "Mock Interviews", text: "Technical, HR and behavioral practice with AI coaching on clarity, structure and missing points.", href: "/interview" },
  { icon: "▦", title: "Timetable", text: "Weekly calendar, daily view, study blocks, reminders and one-click ICS export.", href: "/schedule" },
  { icon: "</>", title: "Coding Lab", text: "Monaco editor for 5 languages with sandboxed browser execution and saved sessions.", href: "/coding" },
  { icon: "◆", title: "Resume & Cover Letters", text: "Three templates, PDF export, keyword matching and AI wording that never invents facts.", href: "/resume" },
  { icon: "▲", title: "Career & Placements", text: "Personalized career suggestions and interactive placement analytics dashboards.", href: "/career" },
  { icon: "✎", title: "Assignment Checker", text: "Upload PDF, DOCX or TXT for AI feedback on structure, completeness and concepts.", href: "/assignments" },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main">
        {/* HERO */}
        <section className="relative isolate flex min-h-[calc(100vh-72px)] items-center overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-20 overflow-hidden bg-[radial-gradient(ellipse_at_top,#3a0000_0%,#050505_60%)]">
            <div className="cg-hero-bg absolute inset-0 bg-cover bg-center opacity-55 blur-[3px]" style={{ backgroundImage: "url(/images/hero-students.jpg)" }} />
          </div>
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/60 to-ink" />
          <div aria-hidden className="cg-grid-bg absolute inset-0 -z-10 opacity-60" />
          <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8">
            <p className="cg-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-blood/50 bg-blood/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-red-200">
              <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_#c1121f]" /> The Student Command Center
            </p>
            <h1 className="cg-hero-title select-none text-[clamp(3.2rem,13vw,11rem)] font-black leading-[0.85] tracking-[-0.04em]">
              COLLEGE
              <br />
              <span className="cg-hero-accent">GEAR</span>
            </h1>
            <p className="cg-fade-up mt-8 text-[clamp(1.25rem,3vw,2rem)] font-bold text-light">Your AI-Powered College Companion</p>
            <p className="cg-fade-up mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              One intelligent workspace for academics, career prep and campus life — Jarvis AI, notes, quizzes, mock interviews, timetables, coding, resumes and more, all saved automatically — no account needed.
            </p>
            <div className="cg-fade-up mt-10 flex flex-wrap gap-3">
              <Link href="/dashboard" className="rounded-md bg-blood px-8 py-4 text-base font-black uppercase tracking-wider text-white transition-all hover:scale-[1.03] hover:bg-accent hover:shadow-[0_0_40px_-6px_rgba(193,18,31,0.9)]">
                Get Started
              </Link>
              <a href="#features" className="rounded-md border border-white/20 bg-black/40 px-8 py-4 text-base font-bold uppercase tracking-wider backdrop-blur transition-all hover:border-accent hover:text-white">
                Explore Features
              </a>
            </div>
          </div>
        </section>

        {/* ABOUT / PROBLEM */}
        <section id="about" className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">Why COLLEGE GEAR</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Students juggle a dozen disconnected apps. We built one command center.</h2>
            </div>
            <div className="space-y-4 text-muted">
              <p>Notes live in one app, schedules in another, interview prep on a random website and career advice nowhere at all. COLLEGE GEAR connects them.</p>
              <p>Ask Jarvis <em className="text-light">“I have a Python interview next week”</em> and get a structured plan with one-click links to the Programming quiz, mock interview practice, the Coding Lab, your Schedule and your Resume.</p>
              <p className="text-sm">Every feature is backed by a real PostgreSQL database with strict per-student data isolation. AI runs only on the server — API keys never reach your browser.</p>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">Features</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Everything a student needs. Nothing fake.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Link key={f.title} href={f.href} className="cg-card cg-card-hover group block p-6">
                <span className="grid h-11 w-11 place-items-center rounded-md border border-blood/50 bg-blood/15 font-mono text-sm font-bold text-accent transition-colors group-hover:bg-blood group-hover:text-white">{f.icon}</span>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">How it works</h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-4">
              {[
                ["01", "Open the app", "No account, email or password — just click Get Started."],
                ["02", "Tell us about you", "Add your department, skills and interests to personalise everything."],
                ["03", "Use your tools", "Study, practise, plan and build — every action is saved."],
                ["04", "Track progress", "Your Command Center shows streaks, scores and next best actions."],
              ].map(([n, t, d]) => (
                <li key={n} className="cg-card p-6">
                  <span className="text-3xl font-black text-accent">{n}</span>
                  <h3 className="mt-3 font-bold">{t}</h3>
                  <p className="mt-1 text-sm text-muted">{d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-xl border border-blood/40 bg-gradient-to-r from-deep/60 to-transparent p-8 md:flex-row md:items-center">
              <div>
                <h3 className="text-2xl font-black">Ready to gear up?</h3>
                <p className="mt-1 text-muted">Free for students. No sign-up required.</p>
              </div>
              <Link href="/dashboard" className="rounded-md bg-blood px-7 py-3 font-bold uppercase tracking-wider hover:bg-accent">Open App</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
