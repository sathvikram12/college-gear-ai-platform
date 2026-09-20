/** Pure, framework-independent business logic (unit-tested in tests/core.test.ts). */
import type { ResumeData } from "./schemas";

export type QuestionKey = { questionId: string; correctOptionId: string; optionIds: string[] };
export type SubmittedAnswer = { questionId: string; optionId: string | null };

/** Scores a quiz on the server. Unknown questions are ignored; unknown options count as wrong. */
export function scoreQuiz(keys: QuestionKey[], answers: SubmittedAnswer[]) {
  const byQ = new Map(keys.map((k) => [k.questionId, k]));
  const seen = new Set<string>();
  const graded: { questionId: string; optionId: string | null; isCorrect: boolean }[] = [];
  for (const a of answers) {
    const k = byQ.get(a.questionId);
    if (!k || seen.has(a.questionId)) continue;
    seen.add(a.questionId);
    const validOption = a.optionId && k.optionIds.includes(a.optionId) ? a.optionId : null;
    graded.push({ questionId: a.questionId, optionId: validOption, isCorrect: validOption === k.correctOptionId });
  }
  const total = graded.length;
  const score = graded.filter((g) => g.isCorrect).length;
  const percentage = total ? Math.round((score / total) * 1000) / 10 : 0;
  return { score, total, percentage, graded };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function resumeCompletion(d: Partial<ResumeData> | null | undefined): number {
  if (!d) return 0;
  const checks = [
    !!(d.personal?.fullName && d.personal?.email),
    !!d.personal?.summary,
    (d.education?.length ?? 0) > 0,
    (d.skills?.length ?? 0) > 0,
    (d.projects?.length ?? 0) > 0,
    (d.experience?.length ?? 0) > 0,
    (d.certifications?.length ?? 0) > 0 || (d.achievements?.length ?? 0) > 0,
    (d.languages?.length ?? 0) > 0,
    (d.links?.length ?? 0) > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/** Consecutive-day streak ending today (or yesterday) from a set of YYYY-MM-DD strings. */
export function computeStreak(days: string[], today = new Date()): number {
  const set = new Set(days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const cur = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!set.has(fmt(cur))) cur.setUTCDate(cur.getUTCDate() - 1);
  let streak = 0;
  while (set.has(fmt(cur))) {
    streak++;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  return streak;
}

/** Builds an RFC5545 calendar with weekly recurring events. day: 0=Mon … 6=Sun. */
export function buildIcs(entries: { id: string; subject: string; courseCode: string; day: number; startTime: string; endTime: string; room: string; teacher: string; type: string }[]) {
  const days = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  const esc = (v: string) => v.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//COLLEGE GEAR//Schedule//EN", "CALSCALE:GREGORIAN"];
  for (const e of entries) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + e.day);
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@college-gear`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${date}T${e.startTime.replace(":", "")}00`,
      `DTEND:${date}T${e.endTime.replace(":", "")}00`,
      `RRULE:FREQ=WEEKLY;BYDAY=${days[e.day]}`,
      `SUMMARY:${esc(`${e.subject}${e.courseCode ? ` (${e.courseCode})` : ""}`)}`,
      `LOCATION:${esc(e.room)}`,
      `DESCRIPTION:${esc(`${e.type}${e.teacher ? ` with ${e.teacher}` : ""}`)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Extracts a JSON object from model text (tolerates code fences / leading prose). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("No JSON object found");
  }
}
