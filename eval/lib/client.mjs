// Anthropic client for the eval scripts. Reads EVAL_ANTHROPIC_API_KEY first (cloud sessions withhold
// ANTHROPIC_API_KEY from the process), then ANTHROPIC_API_KEY. Never logs the key.
import Anthropic from "@anthropic-ai/sdk";

export function apiKey() {
  return process.env.EVAL_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "";
}

export function makeClient() {
  const key = apiKey();
  if (!key) throw new Error("Set EVAL_ANTHROPIC_API_KEY (or ANTHROPIC_API_KEY) first (Project settings, environment variables).");
  return new Anthropic({ apiKey: key });
}
