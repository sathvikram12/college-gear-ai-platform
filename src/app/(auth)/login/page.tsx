"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, COOKIE_BLOCKED_MESSAGE } from "@/components/AuthShell";
import { Button, Input, ErrorState } from "@/components/ui";
import { api, ApiClientError } from "@/lib/api";
import { useWorkspace } from "@/components/WorkspaceProvider";

/** Credential errors only when credentials are actually wrong; anything else is a generic failure. */
function loginError(err: unknown) {
  if (err instanceof ApiClientError) {
    if (["ACCOUNT_NOT_FOUND", "INVALID_PASSWORD", "ACCOUNT_DISABLED", "RATE_LIMITED"].includes(err.code)) return err.message;
    if (err.code === "VALIDATION_ERROR") return "Please enter a valid email address and your password.";
  }
  return "Unable to sign in. Please try again.";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useWorkspace();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/auth/login", { body: { email, password } });
      const { authenticated } = await refresh();
      if (!authenticated) return setError(COOKIE_BLOCKED_MESSAGE);
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch (err) {
      setError(loginError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <ErrorState message={error} />}
      <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" />
      <Input label="Password" type={showPw ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="accent-[#c1121f]" /> Show password
      </label>
      <Button type="submit" className="w-full" size="lg" loading={loading}>Log in</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Log in"
      subtitle="Optional — log in to keep your COLLEGE GEAR data in your account."
      footer={<>New here? <Link href="/signup" className="font-semibold text-accent hover:underline">Create an account</Link></>}
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
