/**
 * Remote mode only (Milestone 8): keeps the Supabase session fresh and sends signed-out visitors to
 * /login. The OAuth endpoints, the /mcp endpoint (which checks its own bearer token) and the sign-in
 * pages stay open. Local installs (no CONTINUITY_DATABASE_URL) skip this entirely.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const OPEN = [/^\/login/, /^\/auth\//, /^\/\.well-known\//, /^\/oauth\/(token|register)/, /^\/mcp/, /^\/_next\//, /^\/favicon/];

export async function middleware(req: NextRequest) {
  if (!process.env.CONTINUITY_DATABASE_URL) return NextResponse.next();
  const path = req.nextUrl.pathname;
  if (OPEN.some((r) => r.test(path))) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await sb.auth.getUser();
  if (!data.user) {
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
