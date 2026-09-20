"use client";

import { useState } from "react";
import Link from "next/link";
import { api, errMsg } from "@/lib/api";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Button, Card, Badge, PageHeader, useToast } from "@/components/ui";

export default function SettingsPage() {
  const toast = useToast();
  const { user } = useWorkspace();
  const [exporting, setExporting] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      const [profile, notes, schedule, attempts, interviews, code, resume, letters, career, assignments] = await Promise.all([
        api("/profile"), api("/notes"), api("/schedule"), api("/quizzes/attempts/me"), api("/interviews/sessions"), api("/code"), api("/resume"), api("/cover-letter"), api("/career/profile"), api("/assignments"),
      ]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile, notes, schedule, quizAttempts: attempts, interviews, code, resume, coverLetters: letters, career, assignments }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "college-gear-my-data.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Your data export has been downloaded");
    } catch (e) { toast(errMsg(e), "error"); } finally { setExporting(false); }
  }

  return (
    <div>
      <PageHeader eyebrow="Account" title="Settings" subtitle="Your workspace and your data." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Workspace</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Name</dt><dd>{user?.name ?? "Student"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Type</dt><dd><Badge tone="red">No login required</Badge></dd></div>
          </dl>
          <Link href="/profile" className="mt-4 inline-block text-sm text-accent hover:underline">Edit profile →</Link>
        </Card>
        <div className="space-y-5">
          <Card>
            <h2 className="mb-2 font-bold">How your data is saved</h2>
            <p className="text-sm text-muted">No account is needed. Your notes, schedule, resume and other work are saved to a private workspace linked to this browser. Clearing this site&apos;s cookies or using a different browser opens a fresh workspace. Use “Export my data” below to keep a copy.</p>
          </Card>
          <Card>
            <h2 className="mb-2 font-bold">Your data</h2>
            <p className="mb-4 text-sm text-muted">Download a JSON copy of everything stored in your COLLEGE GEAR workspace.</p>
            <Button variant="secondary" onClick={exportData} loading={exporting}>⤓ Export my data</Button>
          </Card>
          <Card>
            <h2 className="mb-2 font-bold">Accessibility</h2>
            <p className="text-sm text-muted">Animations automatically respect your operating system&apos;s “reduce motion” setting. All features are keyboard accessible.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
