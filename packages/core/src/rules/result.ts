/** Refusals are values, not exceptions: tools turn them into messages that tell Claude how to fix the call. */

export type RuleCode =
  | "read_before_write"
  | "unknown_reference"
  | "ambiguous_reference"
  | "invalid_tag"
  | "locked_by_user"
  | "edit_kind_required"
  | "not_found"
  | "session_closed"
  | "user_only"
  | "duplicate"
  | "intake_only"
  | "invalid";

export interface Refusal {
  rule: RuleCode;
  /** Says what was refused and how to fix it. */
  message: string;
  ref?: string;
  /** Closest matching slugs, for unknown or ambiguous references. */
  suggestions?: string[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const refuse = (rule: RuleCode, message: string, extra: Omit<Refusal, "rule" | "message"> = {}): { ok: false; refusal: Refusal } => ({
  ok: false,
  refusal: { rule, message, ...extra },
});
