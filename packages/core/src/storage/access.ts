/**
 * Per-account access (Milestone 8). `scopeStorage(storage, userId)` returns a `Storage` that behaves as
 * if the account's worlds and campaigns were the only ones there: anything else reads as missing.
 *
 * It works at the read boundary. Every engine and web path looks an object up before it writes to it
 * (and refuses with `not_found` when the lookup is empty), so hiding the lookups hides the writes too.
 * Writes that name a world or campaign directly are checked as well, as a second guard.
 *
 * Access comes from `permissions` rows: a world row grants that world, a campaign row grants that
 * campaign. In M8 every row is `owner` (sharing is planned in SPEC "Later: sharing and invites").
 */
import type { Campaign, Entity, Section, Session, Storage, Update, Version, World } from "./types";
import { StorageError } from "./types";

type Grants = { worlds: Set<string>; campaigns: Set<string> };

export function scopeStorage(inner: Storage, userId: string): Storage {
  let grants: Grants | null = null;
  const load = async (): Promise<Grants> => {
    if (!grants) {
      const rows = await inner.listPermissions(userId);
      grants = {
        worlds: new Set(rows.filter((r) => r.subjectType === "world").map((r) => r.subjectId)),
        campaigns: new Set(rows.filter((r) => r.subjectType === "campaign").map((r) => r.subjectId)),
      };
    }
    return grants;
  };
  const world = async (id: string | null | undefined) => !!id && (await load()).worlds.has(id);
  const campaign = async (id: string | null | undefined) => !!id && (await load()).campaigns.has(id);
  const entity = async (e: Entity | null) => !!e && (await world(e.worldId)) && (!e.campaignId || (await campaign(e.campaignId)));
  const denied = (what: string): never => {
    throw new StorageError("not_found", `${what} not found`);
  };

  /** Memoized per scoped instance (one request): a change feed checks many versions of the same objects. */
  const seen = new Map<string, Promise<boolean>>();
  const versionVisible = (v: Version): Promise<boolean> => {
    const key = `${v.objectType}:${v.objectId}`;
    if (v.objectType !== "user" && !["world", "campaign", "entity", "section", "update"].includes(v.objectType)) return objectVisible(v);
    if (!seen.has(key)) seen.set(key, objectVisible(v));
    return seen.get(key)!;
  };
  const objectVisible = async (v: Version): Promise<boolean> => {
    switch (v.objectType) {
      case "world":
        return world(v.objectId);
      case "campaign":
        return campaign(v.objectId);
      case "entity":
        return entity(await inner.getEntity(v.objectId));
      case "section": {
        const sec = await inner.getSection(v.objectId);
        return !!sec && (await entity(await inner.getEntity(sec.entityId)));
      }
      case "update":
        return campaign((await inner.getUpdate(v.objectId))?.campaignId);
      case "user":
        return v.objectId === userId;
      default: {
        // Campaign-owned rows (scenes, threads, chapters, GM notes, voice anchor, PC sheet) carry campaignId in their state.
        const state = (v.after ?? v.before) as { campaignId?: string; worldId?: string } | null;
        if (state?.campaignId) return campaign(state.campaignId);
        if (state?.worldId) return world(state.worldId);
        return false;
      }
    }
  };

  const scoped: Storage = {
    // users: an account sees only itself
    createUser: (input, meta) => inner.createUser(input, meta),
    getUser: async (id) => (id === userId ? inner.getUser(id) : null),
    listPermissions: async (id) => (id === userId ? inner.listPermissions(id) : []),

    // worlds
    createWorld: async (input, meta) => {
      if (input.ownerId !== userId) denied("owner");
      const w = await inner.createWorld(input, meta);
      grants = null;
      seen.clear();
      return w;
    },
    updateWorld: async (id, patch, meta) => ((await world(id)) ? inner.updateWorld(id, patch, meta) : denied(`world ${id}`)),
    getWorld: async (id) => ((await world(id)) ? inner.getWorld(id) : null),
    listWorlds: async () => {
      const g = await load();
      return (await inner.listWorlds()).filter((w: World) => g.worlds.has(w.id));
    },

    // campaigns
    createCampaign: async (input, meta) => {
      if (input.ownerId !== userId || !(await world(input.worldId))) denied(`world ${input.worldId}`);
      const c = await inner.createCampaign(input, meta);
      grants = null;
      seen.clear();
      return c;
    },
    getCampaign: async (id) => ((await campaign(id)) ? inner.getCampaign(id) : null),
    listCampaigns: async (worldId) => {
      if (!(await world(worldId))) return [];
      const g = await load();
      return (await inner.listCampaigns(worldId)).filter((c: Campaign) => g.campaigns.has(c.id));
    },
    updateCampaign: async (id, patch, meta) => ((await campaign(id)) ? inner.updateCampaign(id, patch, meta) : denied(`campaign ${id}`)),

    // entities and sections
    createEntity: async (input, meta) =>
      (await world(input.worldId)) && (!input.campaignId || (await campaign(input.campaignId))) ? inner.createEntity(input, meta) : denied(`world ${input.worldId}`),
    updateEntity: async (id, patch, meta) => ((await entity(await inner.getEntity(id))) ? inner.updateEntity(id, patch, meta) : denied(`entity ${id}`)),
    addSection: async (entityId, input, meta) =>
      (await entity(await inner.getEntity(entityId))) && (!input.campaignId || (await campaign(input.campaignId)))
        ? inner.addSection(entityId, input, meta)
        : denied(`entity ${entityId}`),
    updateSection: async (id, patch, meta) => {
      const sec = await inner.getSection(id);
      return sec && (await entity(await inner.getEntity(sec.entityId))) ? inner.updateSection(id, patch, meta) : denied(`section ${id}`);
    },
    getSection: async (id) => {
      const sec: Section | null = await inner.getSection(id);
      return sec && (await entity(await inner.getEntity(sec.entityId))) && (!sec.campaignId || (await campaign(sec.campaignId))) ? sec : null;
    },
    getEntity: async (id) => {
      const e = await inner.getEntity(id);
      return (await entity(e)) ? e : null;
    },
    getEntityBySlug: async (worldId, slug) => {
      const e = (await world(worldId)) ? await inner.getEntityBySlug(worldId, slug) : null;
      return (await entity(e)) ? e : null;
    },
    getPage: async (entityId, opts) =>
      (await entity(await inner.getEntity(entityId))) && (!opts?.campaignId || (await campaign(opts.campaignId))) ? inner.getPage(entityId, opts) : null,
    listEntities: async (worldId, opts) =>
      (await world(worldId)) && (!opts?.campaignId || (await campaign(opts.campaignId))) ? inner.listEntities(worldId, opts) : [],

    // updates, knowledge, rulings, scenes
    createUpdate: async (input, meta) => ((await campaign(input.campaignId)) ? inner.createUpdate(input, meta) : denied(`campaign ${input.campaignId}`)),
    updateUpdate: async (id, patch, meta) => ((await campaign((await inner.getUpdate(id))?.campaignId)) ? inner.updateUpdate(id, patch, meta) : denied(`update ${id}`)),
    getUpdate: async (id) => {
      const u: Update | null = await inner.getUpdate(id);
      return u && (await campaign(u.campaignId)) ? u : null;
    },
    getUpdateBySeq: async (campaignId, seq) => ((await campaign(campaignId)) ? inner.getUpdateBySeq(campaignId, seq) : null),
    listUpdates: async (campaignId, filter) => ((await campaign(campaignId)) ? inner.listUpdates(campaignId, filter) : []),
    addSectionKnowers: async (sectionId, holderIds, meta) => ((await scoped.getSection(sectionId)) ? inner.addSectionKnowers(sectionId, holderIds, meta) : denied(`section ${sectionId}`)),
    listKnowers: async (targetType, targetId) => {
      const visible = targetType === "update" ? await scoped.getUpdate(targetId) : await scoped.getSection(targetId);
      return visible ? inner.listKnowers(targetType, targetId) : [];
    },
    createRuling: async (input, meta) =>
      (await world(input.worldId)) && (!input.campaignId || (await campaign(input.campaignId))) ? inner.createRuling(input, meta) : denied(`world ${input.worldId}`),
    listRulings: async (worldId, campaignId) => ((await world(worldId)) && (!campaignId || (await campaign(campaignId))) ? inner.listRulings(worldId, campaignId) : []),
    createScene: async (input, meta) => ((await campaign(input.campaignId)) ? inner.createScene(input, meta) : denied(`campaign ${input.campaignId}`)),
    updateScene: async (id, patch, meta) => inner.updateScene(id, patch, meta), // scene ids come only from getLatestScene/listScenes, which are scoped
    getLatestScene: async (campaignId) => ((await campaign(campaignId)) ? inner.getLatestScene(campaignId) : null),
    listScenes: async (campaignId) => ((await campaign(campaignId)) ? inner.listScenes(campaignId) : []),

    // threads, chapters, GM notes, voice anchor, PC sheet
    createThread: async (input, meta) => ((await campaign(input.campaignId)) ? inner.createThread(input, meta) : denied(`campaign ${input.campaignId}`)),
    updateThread: async (id, patch, meta) => inner.updateThread(id, patch, meta), // thread ids come only from listThreads, which is scoped
    listThreads: async (campaignId, state) => ((await campaign(campaignId)) ? inner.listThreads(campaignId, state) : []),
    createChapter: async (input, meta) => ((await campaign(input.campaignId)) ? inner.createChapter(input, meta) : denied(`campaign ${input.campaignId}`)),
    listChapters: async (campaignId) => ((await campaign(campaignId)) ? inner.listChapters(campaignId) : []),
    createGmNote: async (input, meta) => ((await campaign(input.campaignId)) ? inner.createGmNote(input, meta) : denied(`campaign ${input.campaignId}`)),
    updateGmNote: async (id, patch, meta) => inner.updateGmNote(id, patch, meta), // note ids come only from listGmNotes, which is scoped
    listGmNotes: async (campaignId) => ((await campaign(campaignId)) ? inner.listGmNotes(campaignId) : []),
    setVoiceAnchor: async (anchor, meta) => ((await campaign(anchor.campaignId)) ? inner.setVoiceAnchor(anchor, meta) : denied(`campaign ${anchor.campaignId}`)),
    getVoiceAnchor: async (campaignId) => ((await campaign(campaignId)) ? inner.getVoiceAnchor(campaignId) : null),
    setPcSheet: async (sheet, meta) => ((await campaign(sheet.campaignId)) ? inner.setPcSheet(sheet, meta) : denied(`campaign ${sheet.campaignId}`)),
    getPcSheet: async (campaignId) => ((await campaign(campaignId)) ? inner.getPcSheet(campaignId) : null),

    // sessions and reads
    openSession: async (campaignId) => ((await campaign(campaignId)) ? inner.openSession(campaignId) : denied(`campaign ${campaignId}`)),
    closeSession: async (id) => ((await scoped.getSession(id)) ? inner.closeSession(id) : denied(`session ${id}`)),
    getSession: async (id) => {
      const s: Session | null = await inner.getSession(id);
      return s && (await campaign(s.campaignId)) ? s : null;
    },
    getOpenSession: async (campaignId) => ((await campaign(campaignId)) ? inner.getOpenSession(campaignId) : null),
    recordReads: async (sessionId, entityIds) => ((await scoped.getSession(sessionId)) ? inner.recordReads(sessionId, entityIds) : denied(`session ${sessionId}`)),
    hasRead: async (sessionId, entityId) => ((await scoped.getSession(sessionId)) ? inner.hasRead(sessionId, entityId) : false),

    // lookup
    resolveEntity: async (worldId, ref, opts) =>
      (await world(worldId)) && (!opts?.campaignId || (await campaign(opts.campaignId)))
        ? inner.resolveEntity(worldId, ref, opts)
        : { status: "unknown", ref, suggestions: [] },
    search: async (worldId, query, opts) => ((await world(worldId)) && (!opts?.campaignId || (await campaign(opts.campaignId))) ? inner.search(worldId, query, opts) : []),

    // history
    listVersions: async (filter) => {
      const out: Version[] = [];
      for (const v of await inner.listVersions(filter)) if (await versionVisible(v)) out.push(v);
      return out;
    },
    getVersion: async (id) => {
      const v = await inner.getVersion(id);
      return v && (await versionVisible(v)) ? v : null;
    },

    close: () => inner.close(),
  };
  return scoped;
}
