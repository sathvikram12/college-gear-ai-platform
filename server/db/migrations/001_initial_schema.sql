-- =====================================================================
-- COLLEGE GEAR — 001_initial_schema.sql
-- Complete PostgreSQL schema: extensions, enums, tables, constraints,
-- foreign keys, indexes, updated_at triggers and base seed configuration.
-- Generated from src/db/schema.ts (Drizzle ORM) and kept in sync with it.
-- Apply with:  npm run db:migrate
-- Demo content (quizzes, interview questions, placements, news, etc.)
-- is inserted by:  npm run db:seed   (also auto-runs on first API request)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid() on PostgreSQL < 13

CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');
CREATE TYPE "public"."priority_level" AS ENUM('low', 'normal', 'high', 'urgent');
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');
CREATE TYPE "public"."schedule_type" AS ENUM('lecture', 'lab', 'tutorial', 'study', 'personal');
CREATE TYPE "public"."session_status" AS ENUM('active', 'completed');
CREATE TYPE "public"."user_role" AS ENUM('student', 'faculty', 'admin');
CREATE TABLE "announcement_reads" (
	"user_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_reads_user_id_announcement_id_pk" PRIMARY KEY("user_id","announcement_id")
);

CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(220) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(60) NOT NULL,
	"priority" "priority_level" DEFAULT 'normal' NOT NULL,
	"author_id" uuid,
	"author_name" varchar(120) DEFAULT 'Administration' NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "assignment_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"score" integer,
	"report" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"question" text DEFAULT '' NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"extracted_chars" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity" varchar(60),
	"entity_id" varchar(64),
	"metadata" jsonb,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "career_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"degree" varchar(120) DEFAULT '' NOT NULL,
	"department" varchar(120) DEFAULT '' NOT NULL,
	"year" integer,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_industries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"career_goals" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "career_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"input" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "coding_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"language" varchar(20) NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"last_output" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "cover_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_title" varchar(160) NOT NULL,
	"company" varchar(160) NOT NULL,
	"job_description" text DEFAULT '' NOT NULL,
	"sections" jsonb NOT NULL,
	"final_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "forum_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "forum_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "forum_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "forum_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interview_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_text" text NOT NULL,
	"feedback" jsonb,
	"score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interview_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interview_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"question" text NOT NULL,
	"guidance" text DEFAULT '' NOT NULL,
	"difficulty" varchar(20) DEFAULT 'medium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"question_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "jarvis_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "jarvis_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"structured" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(220) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"category" varchar(60) NOT NULL,
	"source" varchar(120) DEFAULT 'COLLEGE GEAR Editorial' NOT NULL,
	"url" text,
	"is_demo" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "note_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tag" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" varchar(200),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "placement_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department" varchar(120) NOT NULL,
	"graduation_year" integer NOT NULL,
	"placement_rate" real NOT NULL,
	"average_package" real NOT NULL,
	"highest_package" real NOT NULL,
	"offers" integer NOT NULL,
	"recruiters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_demo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"department" varchar(120),
	"degree" varchar(120),
	"year" integer,
	"bio" text,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"career_interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avatar_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid,
	"is_correct" boolean NOT NULL
);

CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"total" integer NOT NULL,
	"percentage" real NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "quiz_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"question" text NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"difficulty" varchar(20) DEFAULT 'medium' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(160) NOT NULL,
	"category" varchar(60) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"time_limit_seconds" integer DEFAULT 900 NOT NULL,
	"question_count" integer DEFAULT 15 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"remind_at" timestamp with time zone NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"category" varchar(60) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "resume_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template" varchar(30) DEFAULT 'classic' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "resume_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(120) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "schedule_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject" varchar(120) NOT NULL,
	"course_code" varchar(30) DEFAULT '' NOT NULL,
	"day" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"room" varchar(60) DEFAULT '' NOT NULL,
	"teacher" varchar(120) DEFAULT '' NOT NULL,
	"type" "schedule_type" DEFAULT 'lecture' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "career_profiles" ADD CONSTRAINT "career_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "career_recommendations" ADD CONSTRAINT "career_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "coding_sessions" ADD CONSTRAINT "coding_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_category_id_forum_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."forum_categories"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_question_id_interview_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."interview_questions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_category_id_interview_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."interview_categories"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_category_id_interview_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."interview_categories"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "jarvis_conversations" ADD CONSTRAINT "jarvis_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "jarvis_messages" ADD CONSTRAINT "jarvis_messages_conversation_id_jarvis_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."jarvis_conversations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_selected_option_id_quiz_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."quiz_options"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "resume_profiles" ADD CONSTRAINT "resume_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_resume_id_resume_profiles_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resume_profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "announcements_category_idx" ON "announcements" USING btree ("category");
CREATE INDEX "announcements_published_idx" ON "announcements" USING btree ("published_at");
CREATE INDEX "assignment_sub_user_idx" ON "assignment_submissions" USING btree ("user_id");
CREATE INDEX "assignment_sub_assignment_idx" ON "assignment_submissions" USING btree ("assignment_id");
CREATE INDEX "assignments_user_idx" ON "assignments" USING btree ("user_id");
CREATE INDEX "assignments_created_idx" ON "assignments" USING btree ("created_at");
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");
CREATE INDEX "career_rec_user_idx" ON "career_recommendations" USING btree ("user_id");
CREATE INDEX "career_rec_created_idx" ON "career_recommendations" USING btree ("created_at");
CREATE INDEX "coding_user_idx" ON "coding_sessions" USING btree ("user_id");
CREATE INDEX "coding_updated_idx" ON "coding_sessions" USING btree ("updated_at");
CREATE INDEX "cover_letters_user_idx" ON "cover_letters" USING btree ("user_id");
CREATE INDEX "cover_letters_created_idx" ON "cover_letters" USING btree ("created_at");
CREATE UNIQUE INDEX "forum_categories_slug_uq" ON "forum_categories" USING btree ("slug");
CREATE INDEX "forum_comments_post_idx" ON "forum_comments" USING btree ("post_id");
CREATE INDEX "forum_comments_user_idx" ON "forum_comments" USING btree ("user_id");
CREATE INDEX "forum_posts_user_idx" ON "forum_posts" USING btree ("user_id");
CREATE INDEX "forum_posts_category_idx" ON "forum_posts" USING btree ("category_id");
CREATE INDEX "forum_posts_created_idx" ON "forum_posts" USING btree ("created_at");
CREATE UNIQUE INDEX "forum_reports_post_reporter_uq" ON "forum_reports" USING btree ("post_id","reporter_id");
CREATE INDEX "forum_reports_status_idx" ON "forum_reports" USING btree ("status");
CREATE UNIQUE INDEX "interview_answers_session_q_uq" ON "interview_answers" USING btree ("session_id","question_id");
CREATE UNIQUE INDEX "interview_categories_slug_uq" ON "interview_categories" USING btree ("slug");
CREATE INDEX "interview_questions_category_idx" ON "interview_questions" USING btree ("category_id");
CREATE INDEX "interview_sessions_user_idx" ON "interview_sessions" USING btree ("user_id");
CREATE INDEX "interview_sessions_created_idx" ON "interview_sessions" USING btree ("created_at");
CREATE INDEX "jarvis_conv_user_idx" ON "jarvis_conversations" USING btree ("user_id");
CREATE INDEX "jarvis_conv_updated_idx" ON "jarvis_conversations" USING btree ("updated_at");
CREATE INDEX "jarvis_msg_conv_idx" ON "jarvis_messages" USING btree ("conversation_id");
CREATE INDEX "jarvis_msg_created_idx" ON "jarvis_messages" USING btree ("created_at");
CREATE INDEX "news_category_idx" ON "news" USING btree ("category");
CREATE INDEX "news_published_idx" ON "news" USING btree ("published_at");
CREATE UNIQUE INDEX "note_tags_note_tag_uq" ON "note_tags" USING btree ("note_id","tag");
CREATE INDEX "note_tags_user_idx" ON "note_tags" USING btree ("user_id");
CREATE INDEX "notes_user_idx" ON "notes" USING btree ("user_id");
CREATE INDEX "notes_updated_idx" ON "notes" USING btree ("updated_at");
CREATE INDEX "notes_created_idx" ON "notes" USING btree ("created_at");
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");
CREATE UNIQUE INDEX "password_reset_hash_uq" ON "password_reset_tokens" USING btree ("token_hash");
CREATE INDEX "password_reset_user_idx" ON "password_reset_tokens" USING btree ("user_id");
CREATE UNIQUE INDEX "placement_dept_year_uq" ON "placement_stats" USING btree ("department","graduation_year");
CREATE INDEX "quiz_answers_attempt_idx" ON "quiz_answers" USING btree ("attempt_id");
CREATE INDEX "quiz_attempts_user_idx" ON "quiz_attempts" USING btree ("user_id");
CREATE INDEX "quiz_attempts_created_idx" ON "quiz_attempts" USING btree ("created_at");
CREATE INDEX "quiz_options_question_idx" ON "quiz_options" USING btree ("question_id");
CREATE INDEX "quiz_questions_quiz_idx" ON "quiz_questions" USING btree ("quiz_id");
CREATE INDEX "quizzes_category_idx" ON "quizzes" USING btree ("category");
CREATE UNIQUE INDEX "refresh_tokens_hash_uq" ON "refresh_tokens" USING btree ("token_hash");
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");
CREATE INDEX "reminders_user_idx" ON "reminders" USING btree ("user_id");
CREATE INDEX "reminders_at_idx" ON "reminders" USING btree ("remind_at");
CREATE INDEX "resources_category_idx" ON "resources" USING btree ("category");
CREATE INDEX "resources_created_idx" ON "resources" USING btree ("created_at");
CREATE UNIQUE INDEX "resume_profiles_user_uq" ON "resume_profiles" USING btree ("user_id");
CREATE INDEX "resume_versions_user_idx" ON "resume_versions" USING btree ("user_id");
CREATE INDEX "schedule_user_idx" ON "schedule_entries" USING btree ("user_id");
CREATE INDEX "schedule_day_idx" ON "schedule_entries" USING btree ("day");
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");
CREATE INDEX "users_created_idx" ON "users" USING btree ("created_at");
-- ---------------------------------------------------------------------
-- updated_at maintenance (defence in depth — the ORM also sets it)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$I', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Base seed configuration
-- ---------------------------------------------------------------------
INSERT INTO forum_categories (slug, name, description) VALUES
  ('general', 'General', 'Anything student life related.'),
  ('academics', 'Academics', 'Course doubts, study tips and exam prep.'),
  ('programming', 'Programming', 'Code help, projects and tools.'),
  ('placements', 'Placements & Careers', 'Interviews, internships and job search.'),
  ('projects', 'Projects & Hackathons', 'Find teammates and share what you build.'),
  ('announcements-discussion', 'Campus Discussion', 'Discuss events and announcements.')
ON CONFLICT (slug) DO NOTHING;
