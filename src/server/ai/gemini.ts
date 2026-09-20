// Server-side module: imported only from API route handlers. Never import from client components.
import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { ApiError } from "../http";
import { extractJson } from "../logic";

let client: GoogleGenAI | null = null;

export function aiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new ApiError(503, "AI_NOT_CONFIGURED", "AI features are not configured on this server. An administrator must set GEMINI_API_KEY.");
  }
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

type Turn = { role: "user" | "model"; text: string };

/**
 * Calls Gemini (server-side only) requesting JSON output, then validates it with Zod.
 * Retries once on malformed output. Never leaks provider errors to clients.
 */
export async function generateStructured<S extends z.ZodTypeAny>(opts: {
  system: string;
  prompt: string;
  schema: S;
  jsonShape: string;
  history?: Turn[];
  temperature?: number;
}): Promise<z.infer<S>> {
  const ai = getClient();
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const contents = [
    ...(opts.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: opts.prompt }] },
  ];
  const systemInstruction = `${opts.system}\n\nRespond ONLY with a single valid JSON object matching exactly this shape (no markdown, no code fences):\n${opts.jsonShape}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction, responseMimeType: "application/json", temperature: opts.temperature ?? 0.4 },
      });
      const text = res.text ?? "";
      const parsed = opts.schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastErr = parsed.error;
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number })?.status;
      if (status === 429) throw new ApiError(429, "AI_RATE_LIMITED", "The AI service is busy. Please try again in a moment.");
      if (status && status >= 400 && status < 500 && status !== 408) break;
    }
  }
  console.error("[gemini] request failed:", lastErr instanceof Error ? lastErr.message : lastErr);
  throw new ApiError(502, "AI_UNAVAILABLE", "The AI assistant could not produce a valid response. Please try again.");
}
