"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell, COOKIE_BLOCKED_MESSAGE } from "@/components/AuthShell";
import { Button, Input, ErrorState, useToast } from "@/components/ui";
import { api, ApiClientError } from "@/lib/api";
import { useWorkspace } from "@/components/WorkspaceProvider";

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useWorkspace();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Mirrors the server-side Zod rules for instant feedback; the server validates again.
  function validate() {
    const e: Record<string, string> = {};
    const pw = form.password.trim();
    if (form.name.trim().length < 2) e.name = "Enter your name";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter a valid email address";
    if (pw.length < 8 || !/\d/.test(pw) || !/[A-Za-z]/.test(pw)) e.password = "At least 8 characters with a letter and a number";
    if (form.password.trim() !== form.confirmPassword.trim()) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      await api("/auth/register", { body: form });
      // Account created and signed in by the server — go straight into the website (no second login).
      const { authenticated } = await refresh();
      if (!authenticated) return setError(`Account created. ${COOKIE_BLOCKED_MESSAGE}`);
      toast("Account created — you're signed in");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError && ["CONFLICT", "VALIDATION_ERROR", "RATE_LIMITED", "BAD_REQUEST"].includes(err.code) ? err.message : "Unable to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthShell
      title="Create your account"
      subtitle="Optional — anything you've already saved in this browser is kept in your new account."
      footer={<>Already have an account? <Link href="/login" className="font-semibold text-accent hover:underline">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorState message={error} />}
        <Input label="Name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} placeholder="Aarav Sharma" />
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} placeholder="you@college.edu" />
        <Input label="Password" type={showPw ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="Min 8 characters, include a letter and a number" />
        <Input label="Confirm password" type={showPw ? "text" : "password"} autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} />
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="accent-[#c1121f]" /> Show password
        </label>
        <Button type="submit" className="w-full" size="lg" loading={loading}>Sign up</Button>
      </form>
    </AuthShell>
  );
}
