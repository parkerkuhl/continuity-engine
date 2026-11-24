// The consent screen Claude opens when the connector signs in. Sign-in itself is handled by middleware
// (signed-out visitors go to /login and come back here).
import { currentAccount } from "@/lib/auth";
import { remoteDb } from "@/lib/server";
import { decide } from "./actions";

export const dynamic = "force-dynamic";

type Params = Record<string, string | undefined>;

export default async function Authorize({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const { remote } = await remoteDb();
  const client = p.client_id ? await remote.getClient(p.client_id) : null;
  const problem = !client
    ? "This app isn't registered. Remove the connector and add it again."
    : !p.redirect_uri || !client.redirectUris.includes(p.redirect_uri)
      ? "The redirect address doesn't match the one this app registered."
      : p.response_type !== "code"
        ? "Only the authorization code flow is supported."
        : !p.code_challenge || p.code_challenge_method !== "S256"
          ? "The request is missing its PKCE (S256) challenge."
          : null;
  const account = await currentAccount();
  return (
    <main className="mx-auto mt-24 max-w-[460px] px-4">
      <h1 className="page-title">Connect to Continuity Engine</h1>
      <section className="card mt-6 space-y-4">
        {problem ? (
          <p role="alert" className="text-danger">
            {problem}
          </p>
        ) : (
          <>
            <p>
              <strong>{client!.name || "An MCP client"}</strong> wants to read and update your worlds and campaigns as your game master.
            </p>
            <p className="text-muted text-sm">Signed in as {account?.email ?? account?.name}. You can revoke access by removing the connector.</p>
            <form action={decide} className="flex gap-3">
              {["client_id", "redirect_uri", "code_challenge", "state", "scope", "resource"].map((k) => (
                <input key={k} type="hidden" name={k} value={p[k] ?? ""} />
              ))}
              <button name="decision" value="allow" className="btn btn-primary">
                Allow
              </button>
              <button name="decision" value="deny" className="btn">
                Deny
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
