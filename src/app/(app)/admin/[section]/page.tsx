"use client";

import { useParams } from "next/navigation";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { AdminReports } from "@/components/admin/AdminReports";

export default function AdminSection() {
  const { section } = useParams<{ section: string }>();
  if (section === "analytics") return <AdminAnalytics />;
  if (section === "reports") return <AdminReports />;
  return <AdminCrud key={section} section={section} />;
}
