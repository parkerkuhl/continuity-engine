/**
 * Precedence for context assembly (SPEC "Server-enforced rules", Precedence):
 *   1 user edits and rulings
 *   2 campaign sections and confirmed updates
 *   3 world sections
 *   4 proposed updates
 *   5 unverified pages
 * A lower source never hides a higher one, and proposed or unverified material is always labeled.
 */
import type { Campaign, Entity, Ruling, Section, Storage, Update } from "../storage/types";

export type Rank = 1 | 2 | 3 | 4 | 5;

export const RANK_NAMES: Record<Rank, string> = {
  1: "user edit or ruling",
  2: "campaign canon",
  3: "world canon",
  4: "proposed",
  5: "unverified",
};

export type ContextItem =
  | { kind: "summary"; rank: Rank; label: string | null; text: string; secret: false }
  | { kind: "section"; rank: Rank; label: string | null; section: Section; layer: "world" | "campaign"; secret: boolean }
  | { kind: "update"; rank: Rank; label: string | null; update: Update; secret: boolean };

export interface EntityContext {
  entity: Entity;
  /** Sorted by rank, highest precedence first. */
  items: ContextItem[];
  /** Confirmed or proposed updates this entity knows about (knowledge rows with it as holder). */
  knows: Update[];
}

export function labelFor(rank: Rank, extra?: string): string | null {
  if (rank === 4) return extra ?? "PROPOSED (soft canon, not yet approved)";
  if (rank === 5) return "UNVERIFIED (from an established setting, not yet checked)";
  return null;
}

function sectionRank(section: Section, layer: "world" | "campaign", entity: Entity): Rank {
  if (section.lockedByUser) return 1;
  if (entity.source === "unverified") return 5;
  return layer === "campaign" ? 2 : 3;
}

function updateRank(u: Update): Rank {
  if (u.status === "proposed") return 4;
  return u.author === "user" ? 1 : 2;
}

const LIVE = ["confirmed", "proposed"] as const;

export async function assembleEntityContext(storage: Storage, campaign: Campaign, entity: Entity): Promise<EntityContext> {
  const items: ContextItem[] = [];

  const summaryRank: Rank =
    entity.source === "ruling" ? 1 : entity.source === "unverified" ? 5 : entity.campaignId ? 2 : 3;
  if (entity.summary) items.push({ kind: "summary", rank: summaryRank, label: labelFor(summaryRank), text: entity.summary, secret: false });

  // World and campaign layers, side by side. A campaign section replaces the world section with the same
  // key only when it ranks at least as high; otherwise both are kept so the higher one is never hidden.
  const worldPage = await storage.getPage(entity.id);
  const merged = await storage.getPage(entity.id, { campaignId: campaign.id });
  const world = new Map((worldPage?.sections ?? []).map((s) => [s.key, s]));
  for (const s of merged?.sections ?? []) {
    const layer = s.campaignId ? "campaign" : "world";
    const rank = sectionRank(s, layer, entity);
    items.push({ kind: "section", rank, label: labelFor(rank), section: s, layer, secret: s.visibility === "secret" });
    const under = layer === "campaign" ? world.get(s.key) : undefined;
    if (under) {
      const underRank = sectionRank(under, "world", entity);
      if (underRank < rank) {
        items.push({ kind: "section", rank: underRank, label: labelFor(underRank), section: under, layer: "world", secret: under.visibility === "secret" });
      }
    }
  }

  const updates = await storage.listUpdates(campaign.id, { entityId: entity.id, status: [...LIVE] });
  for (const u of updates) {
    const rank = updateRank(u);
    const label = labelFor(rank, u.conflictsWith ? "PROPOSED, IN CONFLICT (parked for review; the confirmed fact stands)" : undefined);
    // Whether an update is secret depends on the PC's knowledge rows; the player-view filter comes in M5.
    items.push({ kind: "update", rank, label, update: u, secret: false });
  }

  items.sort((a, b) => a.rank - b.rank); // stable: keeps page order and seq order within a rank

  const knows: Update[] = [];
  for (const u of await storage.listUpdates(campaign.id, { status: [...LIVE] })) {
    if ((await storage.listKnowers("update", u.id)).includes(entity.id)) knows.push(u);
  }
  return { entity, items, knows };
}

/** Rulings rank 1 and are always listed first. */
export function rulingItems(rulings: Ruling[]): { rank: 1; ruling: Ruling }[] {
  return rulings.map((ruling) => ({ rank: 1 as const, ruling }));
}
