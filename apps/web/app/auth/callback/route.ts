// Supabase sends the browser here after an email link or GitHub sign-in (PKCE code in the query).
import { NextResponse, type NextRequest } from "next/server";
import { currentAccount, safeNext, supabase } from "@/lib/auth";
import { ensureUser } from "@/lib/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const back = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin));
  if (!code) return back(`/login?error=${encodeURIComponent("The sign-in link is missing its code.")}`);
  const { error } = await (await supabase()).auth.exchangeCodeForSession(code);
  if (error) return back(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`);
  const account = await currentAccount();
  if (account) await ensureUser(account.id, account.name);
  return back(next);
}
