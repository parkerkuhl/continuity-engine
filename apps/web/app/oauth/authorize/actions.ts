"use server";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth";
import { ensureUser, remoteDb } from "@/lib/server";

export async function decide(f: FormData) {
  const get = (k: string) => String(f.get(k) ?? "");
  const account = await currentAccount();
  if (!account) redirect("/login");
  const { remote } = await remoteDb();
  const client = await remote.getClient(get("client_id"));
  const redirectUri = get("redirect_uri");
  // Never redirect to an address the client didn't register.
  if (!client || !client.redirectUris.includes(redirectUri) || !get("code_challenge")) redirect("/oauth/authorize");
  const target = new URL(redirectUri);
  if (get("state")) target.searchParams.set("state", get("state"));
  if (get("decision") !== "allow") {
    target.searchParams.set("error", "access_denied");
    redirect(target.toString());
  }
  await ensureUser(account.id, account.name);
  const code = await remote.createCode({
    clientId: client.clientId,
    userId: account.id,
    redirectUri,
    codeChallenge: get("code_challenge"),
    scope: get("scope"),
    resource: get("resource") || null,
  });
  target.searchParams.set("code", code);
  redirect(target.toString());
}
