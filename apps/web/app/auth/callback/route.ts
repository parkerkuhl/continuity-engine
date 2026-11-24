// Supabase sends the browser here after an email link or GitHub sign-in.
// Email links carry `token_hash` and `type` (set in the Supabase magic-link template, see docs/remote.md),
// which works in any browser or device. GitHub sign-in carries a PKCE `code`, which only works in the
// browser that started it.
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { currentAccount, safeNext, supabase } from "@/lib/auth";
import { ensureUser } from "@/lib/server";

const EMAIL_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNext(params.get("next"));
  const back = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin));
  const fail = (message: string) => back(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`);

  const sb = await supabase();
  let error: { message: string } | null = null;
  if (tokenHash && type && EMAIL_TYPES.includes(type)) {
    ({ error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code) {
    ({ error } = await sb.auth.exchangeCodeForSession(code));
    if (error && /code verifier/i.test(error.message)) {
      error = { message: "This sign-in link was opened in a different browser from the one that asked for it. Ask for a new link here." };
    }
  } else {
    return fail("The sign-in link is missing its code.");
  }
  if (error) return fail(error.message);

  const account = await currentAccount();
  if (account) await ensureUser(account.id, account.name);
  return back(next);
}
