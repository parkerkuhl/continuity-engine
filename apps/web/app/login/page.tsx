import { githubEnabled, safeNext } from "@/lib/auth";
import { signInWithEmail, signInWithGithub } from "./actions";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string; error?: string }> }) {
  const { next, sent, error } = await searchParams;
  const to = safeNext(next);
  return (
    <main className="mx-auto mt-24 max-w-[420px] px-4">
      <h1 className="page-title">Continuity Engine</h1>
      <p className="mt-1.5 text-muted">Sign in to your worlds.</p>
      <section className="card mt-6 space-y-4">
        {sent ? (
          <p role="status">Check your email for a sign-in link. You can close this tab.</p>
        ) : (
          <form action={signInWithEmail} className="space-y-3">
            <input type="hidden" name="next" value={to} />
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input w-full" />
            <button className="btn btn-primary w-full">Email me a sign-in link</button>
          </form>
        )}
        {githubEnabled() && (
          <form action={signInWithGithub}>
            <input type="hidden" name="next" value={to} />
            <button className="btn w-full">Sign in with GitHub</button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
