import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata = { title: "Terms" };

export default function Terms() {
  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="text-3xl font-black">Terms of Use</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
          <p>COLLEGE GEAR is a student productivity and learning platform built as a hackathon project. It is provided “as is”.</p>
          <p>AI-generated answers, interview feedback, assignment reports and career suggestions are learning aids only. They are not official grades, hiring decisions, or guaranteed outcomes.</p>
          <p>Placement statistics, news and announcements marked “Demo” or “Sample” are illustrative and are not official institutional data.</p>
          <p>Use the Community respectfully. Do not post personal data, harassment, or content you do not have the right to share. Moderators may hide or delete content.</p>
          <p>Follow your institution&apos;s academic integrity policies when using AI tools.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
