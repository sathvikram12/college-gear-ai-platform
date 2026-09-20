import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: { default: "COLLEGE GEAR — Your AI-Powered College Companion", template: "%s · COLLEGE GEAR" },
  description: "COLLEGE GEAR brings Jarvis AI, notes, quizzes, mock interviews, schedules, coding, resumes and careers into one student command center.",
};
export const viewport: Viewport = { themeColor: "#050505", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ToastProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
