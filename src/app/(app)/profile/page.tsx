"use client";

import { useEffect, useRef, useState } from "react";
import { api, errMsg, fmtDate } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Button, Input, Textarea, TagInput, Select, Card, Badge, LoadingBlock, ErrorState, PageHeader, useToast } from "@/components/ui";

type ProfileRes = { id: string; name: string; role: string; createdAt: string; profile: { department: string | null; degree: string | null; year: number | null; bio: string | null; skills: string[]; careerInterests: string[]; avatarData: string | null } | null };

export default function ProfilePage() {
  const toast = useToast();
  const { refresh } = useWorkspace();
  const { data, error, loading, reload } = useApi<ProfileRes>("/profile");
  const [f, setF] = useState({ name: "", department: "", degree: "", year: null as number | null, bio: "", skills: [] as string[], careerInterests: [] as string[] });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    const p = data.profile;
    setF({ name: data.name, department: p?.department ?? "", degree: p?.degree ?? "", year: p?.year ?? null, bio: p?.bio ?? "", skills: p?.skills ?? [], careerInterests: p?.careerInterests ?? [] });
    setAvatar(p?.avatarData ?? null);
  }, [data]);

  async function save() {
    setSaving(true);
    try { await api("/profile", { method: "PUT", body: f }); toast("Profile saved"); void refresh(); } catch (e) { toast(errMsg(e), "error"); } finally { setSaving(false); }
  }
  async function upload(file: File) {
    if (file.size > 1024 * 1024) return toast("Image must be 1 MB or smaller", "error");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast("Use PNG, JPEG or WEBP", "error");
    setUploading(true);
    const fd = new FormData();
    fd.append("avatar", file);
    try { const r = await api<{ avatar: string }>("/profile/avatar", { form: fd }); setAvatar(r.avatar); toast("Photo updated"); void refresh(); } catch (e) { toast(errMsg(e), "error"); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function removeAvatar() {
    try { await api("/profile/avatar", { method: "DELETE" }); setAvatar(null); void refresh(); toast("Photo removed"); } catch (e) { toast(errMsg(e), "error"); }
  }

  if (loading && !data) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader eyebrow="Account" title="Your Profile" subtitle="Your profile personalises Jarvis, the dashboard and career recommendations. It is private to you." />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="text-center">
            <div className="relative mx-auto h-32 w-32">
              {avatar ? <img src={avatar} alt="Profile photo" className="h-32 w-32 rounded-full border-2 border-blood object-cover" /> : <div className="grid h-32 w-32 place-items-center rounded-full border-2 border-blood bg-deep text-5xl font-black">{data.name[0]?.toUpperCase()}</div>}
            </div>
            <h2 className="mt-4 text-xl font-bold">{data.name}</h2>
            <div className="mt-2 flex justify-center gap-2"><Badge tone="red">{data.role}</Badge><Badge>Joined {fmtDate(data.createdAt)}</Badge></div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="avatar-input" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <div className="mt-4 flex justify-center gap-2">
              <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>Upload photo</Button>
              {avatar && <Button size="sm" variant="ghost" onClick={removeAvatar}>Remove</Button>}
            </div>
            <p className="mt-2 text-[11px] text-muted">PNG, JPEG or WEBP · max 1 MB · content-verified on the server</p>
          </Card>
        </div>
        <Card className="space-y-4 self-start">
          <h2 className="font-bold">Edit profile</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Input label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <Select label="Year" value={f.year ?? ""} onChange={(e) => setF({ ...f, year: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}</Select>
            <Input label="Department" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} placeholder="Computer Science" />
            <Input label="Degree" value={f.degree} onChange={(e) => setF({ ...f, degree: e.target.value })} placeholder="B.Tech" />
          </div>
          <Textarea label="Bio" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={1000} />
          <TagInput label="Skills" value={f.skills} onChange={(v) => setF({ ...f, skills: v })} placeholder="Python, Git" max={40} />
          <TagInput label="Career interests" value={f.careerInterests} onChange={(v) => setF({ ...f, careerInterests: v })} placeholder="Data Science, Cloud" max={20} />
          <Button onClick={save} loading={saving}>Save profile</Button>
        </Card>
      </div>
    </div>
  );
}
