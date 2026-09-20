import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="text-3xl font-black">Privacy Policy</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
          <p>COLLEGE GEAR does not require an account, email or password. It stores only the information you provide: profile fields, notes, schedules, quiz and interview history, code, resumes, cover letters, assignment reports and community posts.</p>
          <p>Your data is saved to a private workspace linked to your browser by a secure httpOnly cookie. It is private to that workspace. Other students can only see content you intentionally publish in the Community (your display name, posts and comments).</p>
          <p>Uploaded assignment files are processed in memory for text extraction and are not stored or executed — only metadata and the AI report are saved.</p>
          <p>AI features send the relevant text (e.g. your question or note) to Google Gemini from our server. API keys are never exposed to the browser. AI output may be inaccurate and is labelled as AI-generated.</p>
          <p>You can edit or delete your content at any time, or export it from Settings. Clearing this site&apos;s cookies starts a new, empty workspace.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
