"use client";

import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main id="main" className="cg-grid-bg min-h-[calc(100vh-72px)]">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
      <Footer />
    </>
  );
}
