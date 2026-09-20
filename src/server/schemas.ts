import { z } from "zod";

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const tagList = (maxItems = 20, maxLen = 60) => z.array(z.string().trim().min(1).max(maxLen)).max(maxItems);
export const uuidSchema = z.string().uuid("Invalid id");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");

/* Optional accounts */
const emailField = z.string().trim().toLowerCase().email("Enter a valid email address").max(255);
export const registerSchema = z
  .object({
    name: trimmed(2, 120),
    email: emailField,
    password: z
      .string()
      .trim()
      .min(8, "Password must be at least 8 characters")
      .max(128)
      .regex(/[A-Za-z]/, "Password must contain a letter")
      .regex(/\d/, "Password must contain a number"),
    confirmPassword: z.string().trim().max(128),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
export const loginSchema = z.object({ email: emailField, password: z.string().min(1, "Enter your password").max(128) });

/* Profile */
export const profileSchema = z.object({
  name: trimmed(2, 120),
  department: z.string().trim().max(120).optional().default(""),
  degree: z.string().trim().max(120).optional().default(""),
  year: z.number().int().min(1).max(8).nullable().optional(),
  bio: z.string().trim().max(1000).optional().default(""),
  skills: tagList(40).optional().default([]),
  careerInterests: tagList(20).optional().default([]),
});

/* Notes */
export const noteSchema = z.object({
  title: trimmed(1, 200),
  content: z.string().max(50000).default(""),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(15).default([]),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
});
export const noteAiSchema = z.object({ action: z.enum(["summarize", "explain", "revision"]) });

/* Jarvis */
export const jarvisChatSchema = z.object({
  conversationId: uuidSchema.optional(),
  message: trimmed(1, 4000),
});
export const jarvisMessageSchema = z.object({ message: trimmed(1, 4000) });

/* Quiz */
export const quizSubmitSchema = z.object({
  answers: z
    .array(z.object({ questionId: uuidSchema, optionId: uuidSchema.nullable() }))
    .min(1)
    .max(100),
  durationSeconds: z.number().int().min(0).max(86400).default(0),
});

/* Interview */
export const interviewStartSchema = z.object({ category: trimmed(1, 60), count: z.number().int().min(1).max(10).default(5) });
export const interviewAnswerSchema = z.object({ questionId: uuidSchema, answer: trimmed(1, 6000) });
export const interviewFeedbackSchema = z.object({ answerId: uuidSchema });

/* Schedule */
export const scheduleSchema = z
  .object({
    subject: trimmed(1, 120),
    courseCode: z.string().trim().max(30).default(""),
    day: z.number().int().min(0).max(6),
    startTime: time,
    endTime: time,
    room: z.string().trim().max(60).default(""),
    teacher: z.string().trim().max(120).default(""),
    type: z.enum(["lecture", "lab", "tutorial", "study", "personal"]).default("lecture"),
  })
  .refine((v) => v.endTime > v.startTime, { message: "End time must be after start time", path: ["endTime"] });
export const reminderSchema = z.object({
  title: trimmed(1, 160),
  note: z.string().max(1000).default(""),
  remindAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
  done: z.boolean().default(false),
});

/* Coding */
export const LANGUAGES = ["python", "javascript", "java", "c", "cpp"] as const;
export const codeSchema = z.object({
  title: trimmed(1, 160),
  language: z.enum(LANGUAGES),
  code: z.string().max(100000).default(""),
  lastOutput: z.string().max(20000).nullable().optional(),
});
export const codeRunSchema = z.object({ language: z.enum(LANGUAGES), code: z.string().min(1).max(100000), stdin: z.string().max(10000).default("") });

/* Resume */
const s = (max: number) => z.string().trim().max(max).default("");
export const resumeDataSchema = z.object({
  personal: z
    .object({ fullName: s(120), email: s(200), phone: s(40), location: s(120), headline: s(160), summary: s(2000) })
    .default({ fullName: "", email: "", phone: "", location: "", headline: "", summary: "" }),
  education: z.array(z.object({ institution: s(200), degree: s(160), field: s(160), start: s(20), end: s(20), score: s(40) })).max(10).default([]),
  skills: tagList(60).default([]),
  projects: z.array(z.object({ name: s(160), tech: s(200), description: s(2000), link: s(300) })).max(15).default([]),
  experience: z.array(z.object({ role: s(160), company: s(160), start: s(20), end: s(20), description: s(3000) })).max(15).default([]),
  certifications: z.array(z.object({ name: s(200), issuer: s(160), year: s(10) })).max(20).default([]),
  achievements: z.array(z.string().trim().max(400)).max(20).default([]),
  languages: tagList(15).default([]),
  links: z.array(z.object({ label: s(60), url: s(300) })).max(10).default([]),
});
export type ResumeData = z.infer<typeof resumeDataSchema>;
export const resumeSaveSchema = z.object({
  template: z.enum(["classic", "modern", "minimal"]).default("classic"),
  data: resumeDataSchema,
  snapshotLabel: z.string().trim().max(120).optional(),
});
export const resumeAiSchema = z.object({
  action: z.enum(["summary", "bullets", "project", "skills", "keywords", "feedback"]),
  target: z.string().max(4000).optional().default(""),
  jobDescription: z.string().max(8000).optional().default(""),
});

/* Cover letter */
export const coverLetterGenSchema = z.object({
  jobTitle: trimmed(2, 160),
  company: trimmed(1, 160),
  jobDescription: z.string().trim().max(8000).default(""),
});
export const coverLetterUpdateSchema = z.object({ finalText: z.string().max(20000) });

/* Career */
export const careerProfileSchema = z.object({
  degree: z.string().trim().max(120).default(""),
  department: z.string().trim().max(120).default(""),
  year: z.number().int().min(1).max(8).nullable().default(null),
  interests: tagList(20).default([]),
  skills: tagList(40).default([]),
  preferredIndustries: tagList(15).default([]),
  careerGoals: z.string().trim().max(2000).default(""),
});

/* Forum */
export const forumPostSchema = z.object({ categoryId: uuidSchema, title: trimmed(3, 200), content: trimmed(3, 10000) });
export const forumCommentSchema = z.object({ content: trimmed(1, 4000) });
export const forumReportSchema = z.object({ reason: trimmed(3, 500) });

/* Assignment upload metadata */
export const assignmentMetaSchema = z.object({
  title: trimmed(1, 200),
  question: z.string().trim().max(4000).default(""),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive(),
});

/* Admin */
export const adminQuizSchema = z.object({
  title: trimmed(2, 160),
  category: trimmed(2, 60).transform((v) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
  description: z.string().trim().max(2000).default(""),
  timeLimitSeconds: z.number().int().min(60).max(7200).default(900),
  questionCount: z.number().int().min(1).max(50).default(15),
  isActive: z.boolean().default(true),
});
export const adminQuestionSchema = z
  .object({
    quizId: uuidSchema,
    question: trimmed(3, 2000),
    explanation: z.string().trim().max(2000).default(""),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    isArchived: z.boolean().default(false),
    options: z.array(z.object({ text: trimmed(1, 500), isCorrect: z.boolean() })).min(2).max(6),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, { message: "Exactly one option must be correct", path: ["options"] });
export const adminNewsSchema = z.object({
  title: trimmed(3, 220),
  summary: z.string().trim().max(1000).default(""),
  content: z.string().trim().max(20000).default(""),
  category: z.enum(["ai", "programming", "cybersecurity", "web-development", "college-technology", "career"]),
  source: z.string().trim().max(120).default("COLLEGE GEAR Editorial"),
  url: z.string().trim().url().max(500).nullable().optional().or(z.literal("").transform(() => null)),
  isDemo: z.boolean().default(true),
});
export const adminAnnouncementSchema = z.object({
  title: trimmed(3, 220),
  content: trimmed(3, 20000),
  category: trimmed(2, 60),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  authorName: z.string().trim().max(120).default("Administration"),
  expiresAt: z.string().trim().max(40).nullable().optional(),
});
export const adminPlacementSchema = z.object({
  department: trimmed(2, 120),
  graduationYear: z.number().int().min(1990).max(2100),
  placementRate: z.number().min(0).max(100),
  averagePackage: z.number().min(0).max(1000),
  highestPackage: z.number().min(0).max(1000),
  offers: z.number().int().min(0).max(100000),
  recruiters: tagList(40, 80).default([]),
  isDemo: z.boolean().default(true),
});
export const adminResourceSchema = z.object({
  title: trimmed(2, 200),
  description: z.string().trim().max(2000).default(""),
  url: z.string().trim().url().max(500),
  category: z.enum(["study-material", "programming", "career", "interview", "documentation", "videos", "tools", "college-resources"]),
});
export const adminInterviewQuestionSchema = z.object({
  categoryId: uuidSchema,
  question: trimmed(3, 2000),
  guidance: z.string().trim().max(2000).default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});
export const adminUserSchema = z.object({ role: z.enum(["student", "faculty", "admin"]), isActive: z.boolean() });
export const adminGenerateQuestionsSchema = z.object({ quizId: uuidSchema, topic: trimmed(2, 200), count: z.number().int().min(1).max(10).default(5) });
