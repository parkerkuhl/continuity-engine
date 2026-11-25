// Supabase sends the browser here after an email link or GitHub sign-in.
// - Email links (implicit flow, see login/actions.ts) put the session tokens in the URL fragment, which
//   only the browser can read: GET returns a tiny page that posts them back here, and POST stores the session.
//   This works in any browser or device.
// - Email links built from a custom template may carry `token_hash` and `type` (verifyOtp).
// - GitHub sign-in carries a PKCE `code`, which only works in the browser that started it.
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { currentAccount, safeNext, supabase } from "@/lib/auth";
import { ensureUser } from "@/lib/server";

const EMAIL_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

function redirector(req: NextRequest, next: string) {
  const back = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin), 303);
  const fail = (message: string) => back(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`);
  return { back, fail };
}

async function signedIn(back: (path: string) => NextResponse, next: string) {
  const account = await currentAccount();
  if (account) await ensureUser(account.id, account.name);
  return back(next);
}

// Reads the fragment and posts it to POST /auth/callback. No user data is written into the page.
const FRAGMENT_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Signing in…</title></head>
<body style="font-family:system-ui,sans-serif;margin:6rem auto;max-width:420px;padding:0 1rem">
<p>Signing in…</p>
<form id="f" method="POST"><input type="hidden" name="fragment"></form>
<script>
var f = document.getElementById("f");
f.elements.fragment.value = location.hash.replace(/^#/, "");
f.action = location.pathname + location.search;
f.submit();
</script>
<noscript>Sign-in needs JavaScript. Turn it on and open the link again.</noscript>
</body></html>`;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNext(params.get("next"));
  const { back, fail } = redirector(req, next);

  if (tokenHash && type && EMAIL_TYPES.includes(type)) {
    const { error } = await (await supabase()).auth.verifyOtp({ token_hash: tokenHash, type });
    return error ? fail(error.message) : signedIn(back, next);
  }
  if (code) {
    const { error } = await (await supabase()).auth.exchangeCodeForSession(code);
    if (error && /code verifier/i.test(error.message)) {
      return fail("This sign-in link was opened in a different browser from the one that asked for it. Ask for a new link here.");
    }
    return error ? fail(error.message) : signedIn(back, next);
  }
  if (params.get("error_description")) return fail(params.get("error_description")!);
  return new NextResponse(FRAGMENT_PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const { back, fail } = redirector(req, next);
  // Only this site's own page may post tokens here (no signing a visitor into someone else's account).
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin && origin !== process.env.CONTINUITY_PUBLIC_URL?.replace(/\/$/, "")) {
    return fail("Sign-in was blocked because it came from another site.");
  }
  const form = await req.formData();
  const fragment = new URLSearchParams(String(form.get("fragment") ?? ""));
  const access_token = fragment.get("access_token");
  const refresh_token = fragment.get("refresh_token");
  if (fragment.get("error_description")) return fail(fragment.get("error_description")!);
  if (!access_token || !refresh_token) return fail("The sign-in link is missing its code. Ask for a new link here.");
  const { error } = await (await supabase()).auth.setSession({ access_token, refresh_token });
  return error ? fail(error.message) : signedIn(back, next);
}
