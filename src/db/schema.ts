import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  real,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */
export const userRole = pgEnum("user_role", ["student", "faculty", "admin"]);
export const scheduleType = pgEnum("schedule_type", ["lecture", "lab", "tutorial", "study", "personal"]);
export const priorityLevel = pgEnum("priority_level", ["low", "normal", "high", "urgent"]);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);
export const sessionStatus = pgEnum("session_status", ["active", "completed"]);
export const messageRole = pgEnum("message_role", ["user", "assistant"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    role: userRole("role").default("student").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    /** Temporary guest session account (no email/password). Auto-deleted after 24h. */
    isGuest: boolean("is_guest").default(false).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_role_idx").on(t.role), index("users_created_idx").on(t.createdAt), index("users_guest_idx").on(t.isGuest)]
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  department: varchar("department", { length: 120 }),
  degree: varchar("degree", { length: 120 }),
  year: integer("year"),
  bio: text("bio"),
  skills: jsonb("skills").$type<string[]>().default([]).notNull(),
  careerInterests: jsonb("career_interests").$type<string[]>().default([]).notNull(),
  avatarData: text("avatar_data"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("refresh_tokens_hash_uq").on(t.tokenHash), index("refresh_tokens_user_idx").on(t.userId)]
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("password_reset_hash_uq").on(t.tokenHash), index("password_reset_user_idx").on(t.userId)]
);

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").default("").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    archived: boolean("archived").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("notes_user_idx").on(t.userId), index("notes_updated_idx").on(t.updatedAt), index("notes_created_idx").on(t.createdAt)]
);

export const noteTags = pgTable(
  "note_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tag: varchar("tag", { length: 40 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("note_tags_note_tag_uq").on(t.noteId, t.tag), index("note_tags_user_idx").on(t.userId)]
);

/* ------------------------------------------------------------------ */
/* Jarvis                                                              */
/* ------------------------------------------------------------------ */
export const jarvisConversations = pgTable(
  "jarvis_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("jarvis_conv_user_idx").on(t.userId), index("jarvis_conv_updated_idx").on(t.updatedAt)]
);

export const jarvisMessages = pgTable(
  "jarvis_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => jarvisConversations.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    structured: jsonb("structured"),
    createdAt: createdAt(),
  },
  (t) => [index("jarvis_msg_conv_idx").on(t.conversationId), index("jarvis_msg_created_idx").on(t.createdAt)]
);

/* ------------------------------------------------------------------ */
/* Quizzes                                                             */
/* ------------------------------------------------------------------ */
export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    description: text("description").default("").notNull(),
    timeLimitSeconds: integer("time_limit_seconds").default(900).notNull(),
    questionCount: integer("question_count").default(15).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("quizzes_category_idx").on(t.category)]
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    explanation: text("explanation").default("").notNull(),
    difficulty: varchar("difficulty", { length: 20 }).default("medium").notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("quiz_questions_quiz_idx").on(t.quizId)]
);

export const quizOptions = pgTable(
  "quiz_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").default(false).notNull(),
    position: integer("position").default(0).notNull(),
  },
  (t) => [index("quiz_options_question_idx").on(t.questionId)]
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    percentage: real("percentage").notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("quiz_attempts_user_idx").on(t.userId), index("quiz_attempts_created_idx").on(t.createdAt)]
);

export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    selectedOptionId: uuid("selected_option_id").references(() => quizOptions.id, { onDelete: "set null" }),
    isCorrect: boolean("is_correct").notNull(),
  },
  (t) => [index("quiz_answers_attempt_idx").on(t.attemptId)]
);

/* ------------------------------------------------------------------ */
/* Interviews                                                          */
/* ------------------------------------------------------------------ */
export const interviewCategories = pgTable(
  "interview_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 60 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").default("").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("interview_categories_slug_uq").on(t.slug)]
);

export const interviewQuestions = pgTable(
  "interview_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => interviewCategories.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    guidance: text("guidance").default("").notNull(),
    difficulty: varchar("difficulty", { length: 20 }).default("medium").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("interview_questions_category_idx").on(t.categoryId)]
);

export const interviewSessions = pgTable(
  "interview_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => interviewCategories.id, { onDelete: "cascade" }),
    questionIds: jsonb("question_ids").$type<string[]>().default([]).notNull(),
    status: sessionStatus("status").default("active").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("interview_sessions_user_idx").on(t.userId), index("interview_sessions_created_idx").on(t.createdAt)]
);

export const interviewAnswers = pgTable(
  "interview_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => interviewQuestions.id, { onDelete: "cascade" }),
    answerText: text("answer_text").notNull(),
    feedback: jsonb("feedback"),
    score: integer("score"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("interview_answers_session_q_uq").on(t.sessionId, t.questionId)]
);

/* ------------------------------------------------------------------ */
/* Schedule                                                            */
/* ------------------------------------------------------------------ */
export const scheduleEntries = pgTable(
  "schedule_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 120 }).notNull(),
    courseCode: varchar("course_code", { length: 30 }).default("").notNull(),
    day: integer("day").notNull(),
    startTime: varchar("start_time", { length: 5 }).notNull(),
    endTime: varchar("end_time", { length: 5 }).notNull(),
    room: varchar("room", { length: 60 }).default("").notNull(),
    teacher: varchar("teacher", { length: 120 }).default("").notNull(),
    type: scheduleType("type").default("lecture").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("schedule_user_idx").on(t.userId), index("schedule_day_idx").on(t.day)]
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    note: text("note").default("").notNull(),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    done: boolean("done").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("reminders_user_idx").on(t.userId), index("reminders_at_idx").on(t.remindAt)]
);

/* ------------------------------------------------------------------ */
/* Content: news, announcements, placements, resources                 */
/* ------------------------------------------------------------------ */
export const news = pgTable(
  "news",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 220 }).notNull(),
    summary: text("summary").default("").notNull(),
    content: text("content").default("").notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    source: varchar("source", { length: 120 }).default("COLLEGE GEAR Editorial").notNull(),
    url: text("url"),
    isDemo: boolean("is_demo").default(true).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("news_category_idx").on(t.category), index("news_published_idx").on(t.publishedAt)]
);

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 220 }).notNull(),
    content: text("content").notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    priority: priorityLevel("priority").default("normal").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    authorName: varchar("author_name", { length: 120 }).default("Administration").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("announcements_category_idx").on(t.category), index("announcements_published_idx").on(t.publishedAt)]
);

export const announcementReads = pgTable(
  "announcement_reads",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.announcementId] })]
);

export const placementStats = pgTable(
  "placement_stats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    department: varchar("department", { length: 120 }).notNull(),
    graduationYear: integer("graduation_year").notNull(),
    placementRate: real("placement_rate").notNull(),
    averagePackage: real("average_package").notNull(),
    highestPackage: real("highest_package").notNull(),
    offers: integer("offers").notNull(),
    recruiters: jsonb("recruiters").$type<string[]>().default([]).notNull(),
    isDemo: boolean("is_demo").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("placement_dept_year_uq").on(t.department, t.graduationYear)]
);

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").default("").notNull(),
    url: text("url").notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("resources_category_idx").on(t.category), index("resources_created_idx").on(t.createdAt)]
);

/* ------------------------------------------------------------------ */
/* Career                                                              */
/* ------------------------------------------------------------------ */
export const careerProfiles = pgTable("career_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  degree: varchar("degree", { length: 120 }).default("").notNull(),
  department: varchar("department", { length: 120 }).default("").notNull(),
  year: integer("year"),
  interests: jsonb("interests").$type<string[]>().default([]).notNull(),
  skills: jsonb("skills").$type<string[]>().default([]).notNull(),
  preferredIndustries: jsonb("preferred_industries").$type<string[]>().default([]).notNull(),
  careerGoals: text("career_goals").default("").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const careerRecommendations = pgTable(
  "career_recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    input: jsonb("input").notNull(),
    result: jsonb("result").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("career_rec_user_idx").on(t.userId), index("career_rec_created_idx").on(t.createdAt)]
);

/* ------------------------------------------------------------------ */
/* Coding                                                              */
/* ------------------------------------------------------------------ */
export const codingSessions = pgTable(
  "coding_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    language: varchar("language", { length: 20 }).notNull(),
    code: text("code").default("").notNull(),
    lastOutput: text("last_output"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("coding_user_idx").on(t.userId), index("coding_updated_idx").on(t.updatedAt)]
);

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */
export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    question: text("question").default("").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    extractedChars: integer("extracted_chars").default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("assignments_user_idx").on(t.userId), index("assignments_created_idx").on(t.createdAt)]
);

export const assignmentSubmissions = pgTable(
  "assignment_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: integer("score"),
    report: jsonb("report"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("assignment_sub_user_idx").on(t.userId), index("assignment_sub_assignment_idx").on(t.assignmentId)]
);

/* ------------------------------------------------------------------ */
/* Resume & cover letters                                              */
/* ------------------------------------------------------------------ */
export const resumeProfiles = pgTable(
  "resume_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    template: varchar("template", { length: 30 }).default("classic").notNull(),
    data: jsonb("data").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("resume_profiles_user_uq").on(t.userId)]
);

export const resumeVersions = pgTable(
  "resume_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumeProfiles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }).notNull(),
    data: jsonb("data").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("resume_versions_user_idx").on(t.userId)]
);

export const coverLetters = pgTable(
  "cover_letters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobTitle: varchar("job_title", { length: 160 }).notNull(),
    company: varchar("company", { length: 160 }).notNull(),
    jobDescription: text("job_description").default("").notNull(),
    sections: jsonb("sections").notNull(),
    finalText: text("final_text").default("").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("cover_letters_user_idx").on(t.userId), index("cover_letters_created_idx").on(t.createdAt)]
);

/* ------------------------------------------------------------------ */
/* Community                                                           */
/* ------------------------------------------------------------------ */
export const forumCategories = pgTable(
  "forum_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 60 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").default("").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("forum_categories_slug_uq").on(t.slug)]
);

export const forumPosts = pgTable(
  "forum_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => forumCategories.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    isHidden: boolean("is_hidden").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("forum_posts_user_idx").on(t.userId), index("forum_posts_category_idx").on(t.categoryId), index("forum_posts_created_idx").on(t.createdAt)]
);

export const forumComments = pgTable(
  "forum_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => forumPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isHidden: boolean("is_hidden").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("forum_comments_post_idx").on(t.postId), index("forum_comments_user_idx").on(t.userId)]
);

export const forumReports = pgTable(
  "forum_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => forumPosts.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: reportStatus("status").default("open").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("forum_reports_post_reporter_uq").on(t.postId, t.reporterId), index("forum_reports_status_idx").on(t.status)]
);

/* ------------------------------------------------------------------ */
/* System                                                              */
/* ------------------------------------------------------------------ */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").default("").notNull(),
    link: varchar("link", { length: 200 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId), index("notifications_created_idx").on(t.createdAt)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    entity: varchar("entity", { length: 60 }),
    entityId: varchar("entity_id", { length: 64 }),
    metadata: jsonb("metadata"),
    ip: varchar("ip", { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_user_idx").on(t.userId), index("audit_logs_action_idx").on(t.action), index("audit_logs_created_idx").on(t.createdAt)]
);

/** Migration tracking table used by server/db/migrate.ts (declared so drizzle-kit push never drops it). */
export const schemaMigrations = pgTable("schema_migrations", {
  name: text("name").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
});
