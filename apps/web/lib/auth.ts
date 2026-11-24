/**
 * Sign-in for the remote web app (Milestone 8): Supabase Auth, with the session in cookies (@supabase/ssr).
 * Local installs have no sign-in; `currentAccount()` is only called in remote mode.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export async function supabase() {
  const jar = await cookies();
  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Server components can't set cookies; middleware refreshes the session instead.
        }
      },
    },
  });
}

export type Account = { id: string; name: string; email: string | null };

/** The signed-in account, checked with Supabase (getUser verifies the token server side). */
export const currentAccount = cache(async (): Promise<Account | null> => {
  const { data } = await (await supabase()).auth.getUser();
  const u = data.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string; user_name?: string };
  return { id: u.id, email: u.email ?? null, name: meta.full_name || meta.name || meta.user_name || u.email || "Account" };
});

/** Sign-in methods offered on /login. Email links always work; GitHub needs the provider turned on in Supabase. */
export const githubEnabled = () => process.env.CONTINUITY_AUTH_GITHUB === "1";

/** Only same-site paths may follow sign-in, so a link can't bounce the user to another site. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
