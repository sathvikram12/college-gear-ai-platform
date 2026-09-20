import { describe, expect, it } from "vitest";
import { scoreQuiz, computeStreak, resumeCompletion, buildIcs, extractJson, shuffle } from "@/server/logic";
import { noteSchema, scheduleSchema, quizSubmitSchema, adminQuestionSchema, resumeDataSchema, profileSchema } from "@/server/schemas";
import { jarvisResponseSchema, interviewFeedbackSchema, assignmentReportSchema } from "@/server/ai/services";
import { matchRoute, route } from "@/server/router";

const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("quiz scoring", () => {
  const keys = [
    { questionId: Q1, correctOptionId: A, optionIds: [A, B] },
    { questionId: Q2, correctOptionId: C, optionIds: [C, D] },
  ];
  it("scores correct and wrong answers", () => {
    const r = scoreQuiz(keys, [{ questionId: Q1, optionId: A }, { questionId: Q2, optionId: D }]);
    expect(r).toMatchObject({ score: 1, total: 2, percentage: 50 });
  });
  it("treats skipped answers as wrong", () => {
    expect(scoreQuiz(keys, [{ questionId: Q1, optionId: null }, { questionId: Q2, optionId: C }]).score).toBe(1);
  });
  it("rejects options from other questions (tampering)", () => {
    const r = scoreQuiz(keys, [{ questionId: Q1, optionId: C }, { questionId: Q2, optionId: C }]);
    expect(r.score).toBe(1);
    expect(r.graded[0].optionId).toBeNull();
  });
  it("ignores duplicate and unknown questions", () => {
    const r = scoreQuiz(keys, [{ questionId: Q1, optionId: A }, { questionId: Q1, optionId: A }, { questionId: A, optionId: A }]);
    expect(r).toMatchObject({ score: 1, total: 1, percentage: 100 });
  });
  it("shuffle keeps all elements", () => {
    const arr = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(arr).sort((a, b) => a - b)).toEqual(arr);
  });
});

describe("validation schemas", () => {
  it("notes enforce title and normalise tags", () => {
    expect(noteSchema.safeParse({ title: "", content: "x" }).success).toBe(false);
    expect(noteSchema.parse({ title: "T", tags: ["OS"] }).tags).toEqual(["os"]);
  });
  it("schedule requires end after start and valid day", () => {
    expect(scheduleSchema.safeParse({ subject: "DS", day: 1, startTime: "09:00", endTime: "10:00" }).success).toBe(true);
    expect(scheduleSchema.safeParse({ subject: "DS", day: 1, startTime: "11:00", endTime: "10:00" }).success).toBe(false);
    expect(scheduleSchema.safeParse({ subject: "DS", day: 9, startTime: "09:00", endTime: "10:00" }).success).toBe(false);
  });
  it("quiz submission requires UUIDs", () => {
    expect(quizSubmitSchema.safeParse({ answers: [{ questionId: "x", optionId: null }] }).success).toBe(false);
    expect(quizSubmitSchema.safeParse({ answers: [{ questionId: Q1, optionId: A }] }).success).toBe(true);
  });
  it("admin question requires exactly one correct option", () => {
    const base = { quizId: Q1, question: "What?", options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: true }] };
    expect(adminQuestionSchema.safeParse(base).success).toBe(false);
    expect(adminQuestionSchema.safeParse({ ...base, options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] }).success).toBe(true);
  });
  it("profile update validates year range", () => {
    expect(profileSchema.safeParse({ name: "Ana", year: 12 }).success).toBe(false);
  });
});

describe("AI response validation", () => {
  it("accepts a well-formed Jarvis response and defaults optional arrays", () => {
    const r = jarvisResponseSchema.parse({ answer: "A", summary: "S", steps: [], confidence: "high" });
    expect(r.actions).toEqual([]);
    expect(r.resources).toEqual([]);
  });
  it("rejects invalid confidence and non-whitelisted action links", () => {
    expect(jarvisResponseSchema.safeParse({ answer: "A", summary: "S", steps: [], confidence: "certain" }).success).toBe(false);
    expect(jarvisResponseSchema.safeParse({ answer: "A", summary: "S", steps: [], confidence: "low", actions: [{ label: "x", href: "https://evil.example" }] }).success).toBe(false);
  });
  it("bounds interview scores and assignment scores", () => {
    expect(interviewFeedbackSchema.safeParse({ relevance: 11, clarity: 5, structure: 5, technicalUnderstanding: 5, overall: 5, summary: "" }).success).toBe(false);
    expect(assignmentReportSchema.safeParse({ score: 140, summary: "" }).success).toBe(false);
  });
  it("extracts JSON from fenced model output", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"b":2} hope it helps')).toEqual({ b: 2 });
    expect(() => extractJson("no json")).toThrow();
  });
});

describe("helpers", () => {
  it("computes learning streaks", () => {
    const today = new Date("2025-03-10T12:00:00Z");
    expect(computeStreak(["2025-03-10", "2025-03-09", "2025-03-08"], today)).toBe(3);
    expect(computeStreak(["2025-03-09", "2025-03-08"], today)).toBe(2);
    expect(computeStreak(["2025-03-07"], today)).toBe(0);
  });
  it("computes resume completion", () => {
    expect(resumeCompletion(null)).toBe(0);
    const d = resumeDataSchema.parse({ personal: { fullName: "A", email: "a@b.c", summary: "x" }, skills: ["Go"] });
    expect(resumeCompletion(d)).toBe(33);
  });
  it("builds a valid ICS calendar", () => {
    const ics = buildIcs([{ id: "1", subject: "DS; Algo", courseCode: "CS1", day: 0, startTime: "09:00", endTime: "10:00", room: "B1", teacher: "Dr X", type: "lecture" }]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(ics).toContain("SUMMARY:DS\\; Algo (CS1)");
  });
  it("router prefers static segments over params", () => {
    const h = async () => new Response();
    const routes = [route("GET", "/quizzes/:id", h), route("GET", "/quizzes/attempts/me", h)];
    expect(matchRoute(routes, "GET", "/quizzes/attempts/me").match?.route.pattern).toBe("/quizzes/attempts/me");
    expect(matchRoute(routes, "GET", "/quizzes/abc").match?.params).toEqual({ id: "abc" });
    expect(matchRoute(routes, "POST", "/quizzes/abc")).toMatchObject({ match: null, pathMatched: true });
  });
});

