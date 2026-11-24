"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext, supabase } from "@/lib/auth";

async function origin(): Promise<string> {
  if (process.env.CONTINUITY_PUBLIC_URL) return process.env.CONTINUITY_PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

const callback = async (next: string) => `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`;

export async function signInWithEmail(f: FormData) {
  const email = String(f.get("email") ?? "").trim();
  const next = safeNext(String(f.get("next") ?? "/"));
  const { error } = await (await supabase()).auth.signInWithOtp({ email, options: { emailRedirectTo: await callback(next) } });
  if (error) redirect(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`);
  redirect(`/login?sent=1`);
}

export async function signInWithGithub(f: FormData) {
  const next = safeNext(String(f.get("next") ?? "/"));
  const { data, error } = await (await supabase()).auth.signInWithOAuth({ provider: "github", options: { redirectTo: await callback(next) } });
  if (error || !data.url) redirect(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error?.message ?? "GitHub sign-in failed.")}`);
  redirect(data.url);
}
