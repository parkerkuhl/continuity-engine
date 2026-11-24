// UX review screenshots. Seeds a realistic world through the real MCP server (as Claude would), starts
// `next start` on the same database, and saves full-page PNGs of every key page and state to
// <repo>/ux-screenshots/ at 1440px desktop and 390px mobile, light and dark.
//
//   pnpm --filter @continuity/mcp build && pnpm --filter @continuity/web build
//   node apps/web/e2e/ux-screenshots.mjs              # everything
//   ONLY=entity,review node apps/web/e2e/ux-screenshots.mjs   # only shots whose name contains "entity" or "review"
//
// Also writes ux-screenshots/_notes.json (page titles, timings of the search task, console errors).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HALCYON, LANTERN } from "./ux-seed-data.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..");
const mcpBundle = join(web, "../mcp/dist/bin/server.js");
const out = join(web, "../../ux-screenshots");
mkdirSync(out, { recursive: true });
if (!existsSync(mcpBundle)) throw new Error("Build the MCP server first: pnpm --filter @continuity/mcp build");
if (!existsSync(join(web, ".next"))) throw new Error("Build the web app first: pnpm --filter @continuity/web build");

const db = join(mkdtempSync(join(tmpdir(), "continuity-ux-")), "continuity.db");
const PORT = Number(process.env.PORT || 3131);
const BASE = `http://localhost:${PORT}`;
const ONLY = process.env.ONLY;
const notes = { titles: {}, timings: {}, console: [], refusals: [] };

// ---------- Claude's side ----------
async function claude() {
  const client = new Client({ name: "ux-claude", version: "0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [mcpBundle], env: { ...process.env, CONTINUITY_DB: db }, stderr: "ignore" }));
  const call = async (name, args = {}) => {
    if (name === "log_scene") {
      const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      args = { ...args, updates: (args.updates ?? []).map((u) => ({ ...u, tags: u.tags.map(slug) })) };
      const names = new Set([...(args.present ?? []), ...(args.updates ?? []).flatMap((u) => [...u.entities, ...u.knows, ...u.tags.filter((t) => !/^ch-\d+$/.test(t))]), ...(args.secrets_learned ?? []).map((x) => x.entity)]);
      await call("get_context", { campaign_id: args.campaign_id, present: [...names], ...(args.place && { place: args.place }) });
    }
    const r = await client.callTool({ name, arguments: args });
    const res = { text: r.content[0].text, status: r.content[1] ? JSON.parse(r.content[1].text) : {}, isError: !!r.isError };
    if (res.isError) notes.refusals.push(`${name}: ${res.text.slice(0, 300)}`);
    if (name === "log_scene" && !res.isError && res.status.updates?.some((u) => u.status === "refused")) notes.refusals.push(`log_scene: ${res.text.slice(0, 1500)}`);
    // Read every page a scene touches first, as the protocol module tells the GM to.
    if (name === "get_context" && res.isError) notes.refusals.push(`get_context: ${res.text.slice(0, 300)}`);
    return res;
  };
  return { call, close: () => client.close() };
}

async function seedWorld(c, def) {
  const w = await c.call("create_world", def.world);
  const worldId = w.status.world_id;
  for (const pg of def.pages) await c.call("create_entity", { world_id: worldId, ...pg });
  return worldId;
}

async function seed() {
  const c = await claude();
  const lanternId = await seedWorld(c, LANTERN);
  const halcyonId = await seedWorld(c, HALCYON); // review mode: Claude's pages wait as drafts
  const moors = await c.call("create_world", { name: "The Moorlands", pitch: "", depth: "compact", approval_mode: "batch" });

  const camp = await c.call("create_campaign", {
    world_id: lanternId, name: "The Long Dark", approval_mode: "mixed",
    settings: { genre: "maritime gothic mystery", tone: "melancholy, slow-burn", difficulty: "balanced", lines: ["harm to children"], veils: ["drowning described in detail"] },
  });
  const campaignId = camp.status.campaign_id;
  await c.call("create_campaign", { world_id: halcyonId, name: "First Salvage" });
  await c.call("open_campaign", { campaign_id: campaignId });
  await c.call("update_campaign", {
    campaign_id: campaignId, as_of: "Late autumn, year 212",
    pc_sheet: { name: "Isolde Varre", stats: { might: 0, finesse: 1, wits: 2, presence: 1, resolve: 2 }, health: 6, stress: 1, inventory: ["father's oilskin", "tide tables", "brass oil-store key"], bonds: ["Corwen Hale (master)", "Jory Varre (brother)"] },
  });
  await c.call("set_voice_anchor", {
    campaign_id: campaignId,
    sample: "The fog came in with the tide, as it always did, and Isolde counted the steps because counting was something she could still be sure of.",
    profile: "Close third on Isolde, quiet, concrete.", interior_level: "grounded", avoid_list: ["epigrams", "neat closing lines"],
  });

  // Labels, as the GM backfills them.
  await c.call("get_context", { campaign_id: campaignId, present: ["Isolde Varre", "Corwen Hale", "Jory Varre", "Wren Tallow", "Marta Gorse", "Pell", "Mirela Oduya", "Lamplighters' Guild", "Corwen's Logbook"], place: "The Lantern Spire" });
  for (const [who, label] of [["Corwen Hale", "Master"], ["Jory Varre", "Older brother"], ["Wren Tallow", "Ferry pilot"]]) {
    await c.call("edit_entity", { entity: who, campaign_id: campaignId, sections: [{ key: "to-the-pc", heading: "To the PC", body: label }] });
  }

  // Chapter 1, scene 1
  await c.call("log_scene", {
    campaign_id: campaignId, place: "The Lantern Spire", present: ["Isolde Varre", "Corwen Hale"],
    summary: "Fog night at the Spire. Corwen gives Isolde the oil-store key and drinks on the gallery; Isolde finds the logbook page for the Night of No Lights cut out.",
    updates: [
      { entities: ["Corwen Hale", "Isolde Varre"], tags: ["ch-01"], type: "item", severity: "minor", body: "Corwen gave Isolde the brass key to the oil store.", knows: ["Corwen Hale", "Isolde Varre"] },
      { entities: ["Corwen's Logbook", "Isolde Varre"], tags: ["ch-01", "The Night of No Lights"], type: "new-fact", severity: "minor", body: "The page for the Night of No Lights has been cut from Corwen's logbook with a razor.", knows: ["Isolde Varre"] },
      { entities: ["Corwen Hale"], tags: ["ch-01"], type: "status-change", severity: "minor", body: "Corwen is drinking more since the Guild announced the midwinter vote.", knows: ["Corwen Hale", "Isolde Varre"] },
      { entities: ["Corwen Hale", "Lamplighters' Guild"], tags: ["ch-01", "The Guild Vote"], type: "knowledge", severity: "major", body: "Corwen believes Ysolt Marrow already has the five votes she needs to remove him.", knows: ["Corwen Hale"] },
    ],
    thread_changes: [{ title: "The missing log page", body: "Who cut the Night of No Lights from the logbook, and why?", tags: ["corwens-logbook"] }],
  });
  // Chapter 1, scene 2
  await c.call("log_scene", {
    campaign_id: campaignId, place: "Gullwharf", present: ["Isolde Varre", "Wren Tallow", "Marta Gorse", "Pell"],
    summary: "Market morning in Gullwharf. Isolde haggles passage to Hollow Isle with the Heron; Old Marta lets slip that the Choir counted eleven wrecks, not nine.",
    updates: [
      { entities: ["Wren Tallow", "Isolde Varre"], tags: ["ch-01", "Hollow Isle"], type: "relationship", severity: "minor", body: "Wren agreed to ferry Isolde to Hollow Isle at half tide for three crowns, no questions.", knows: ["Wren Tallow", "Isolde Varre"] },
      { entities: ["Wren Tallow", "Sabin Roake"], tags: ["ch-01", "Tidewater Free Company"], type: "status-change", severity: "minor", body: "Wren's debt to Sabin Roake has grown to 80 crowns with interest; he wants it by midwinter.", knows: ["Wren Tallow", "Marta Gorse"] },
      { entities: ["Pell", "The Fogwright"], tags: ["ch-01", "The Ninefold Shoals"], type: "new-fact", severity: "minor", body: "Pell swears he saw the Grey Man walking the shoals at low tide two nights ago.", knows: ["Pell", "Isolde Varre", "Marta Gorse"] },
      { entities: ["Marta Gorse", "Choir of the Drowned", "The Night of No Lights"], tags: ["ch-01"], type: "knowledge", severity: "major", body: "Marta told Isolde the Choir sings eleven names for the Night of No Lights, not the nine the Watch published.", knows: ["Marta Gorse", "Isolde Varre"] },
    ],
    thread_changes: [{ title: "Eleven, not nine", body: "Two boats lost on the Night of No Lights were left off the Watch's list.", tags: ["the-night-of-no-lights"] }],
    secrets_learned: [{ entity: "Mirela Oduya", section: "what-the-choir-knows", by: ["Isolde Varre", "Marta Gorse"] }],
  });
  // The GM corrects Wren's page directly during play (AI page edits apply at once and show in history).
  await c.call("edit_entity", { entity: "Wren Tallow", campaign_id: campaignId, sections: [{ key: "debts", body: "Owes the Tidewater Free Company 80 crowns (60 for the new sail on the Gull's Mercy, plus interest). Sabin Roake holds the note and wants it paid by midwinter." }] });
  // Chapter 1, scene 3
  await c.call("get_context", { campaign_id: campaignId, present: ["Isolde Varre", "Wren Tallow", "The Fogwright", "Tidewater Free Company"], place: "Hollow Isle" });
  await c.call("log_scene", {
    campaign_id: campaignId, place: "Hollow Isle", present: ["Isolde Varre", "Wren Tallow", "The Fogwright"],
    summary: "Half-tide crossing to Hollow Isle. Isolde sees a grey figure walking the shoals and finds Free Company crates in the caves.",
    updates: [
      { entities: ["The Fogwright", "Isolde Varre"], tags: ["ch-01", "The Ninefold Shoals"], type: "new-fact", severity: "minor", body: "Isolde saw the Grey Man crossing the shoals on foot where the water should have been chest-deep.", knows: ["Isolde Varre", "Wren Tallow"] },
      { entities: ["The Fogwright", "Isolde Varre"], tags: ["ch-01"], type: "knowledge", severity: "major", body: "The Fogwright recognised Isolde in the lantern light and turned back before she could see his face.", knows: ["The Fogwright"] },
      { entities: ["Tidewater Free Company", "Hollow Isle", "Admiralty of Brennach"], tags: ["ch-01"], type: "faction-shift", severity: "major", body: "The Free Company is caching Admiralty powder on Hollow Isle, which means someone in the Company is trading with the blockade.", knows: ["Isolde Varre", "Wren Tallow"] },
    ],
    thread_changes: [{ title: "Powder on Hollow Isle", body: "Who in the Free Company is selling to Brennach?", tags: ["tidewater-free-company"] }],
  });
  await c.call("close_chapter", { campaign_id: campaignId, title: "Fog Night", summary: "Isolde finds the cut log page, learns of the eleven names, and sees the Grey Man on the shoals." });
  // Chapter 2, scene 1
  await c.call("get_context", { campaign_id: campaignId, present: ["Isolde Varre", "Sabin Roake", "Theodora Quell"], place: "Kettle's Rest" });
  await c.call("log_scene", {
    campaign_id: campaignId, place: "Kettle's Rest", present: ["Isolde Varre", "Sabin Roake", "Theodora Quell"],
    summary: "Stew and threats at Kettle's Rest. Black Sabin offers Isolde Wren's debt in exchange for the Spire's lamp hours; the Warden watches from the Watch side.",
    updates: [
      { entities: ["Sabin Roake", "Isolde Varre"], tags: ["ch-02", "Wren Tallow"], type: "relationship", severity: "major", body: "Sabin offered to forgive Wren's debt if Isolde tells him which nights the Spire will burn low.", knows: ["Sabin Roake", "Isolde Varre"] },
      { entities: ["Theodora Quell", "Halvard Brisk"], tags: ["ch-02", "Admiralty of Brennach"], type: "knowledge", severity: "major", body: "Quell slipped a sealed letter to an Admiralty courier on her way out of the Kettle.", knows: ["Theodora Quell"] },
    ],
  });
  await c.call("gm_write", { campaign_id: campaignId, kind: "twist", key: "the-forty-crowns", body: "Corwen darkened the Spire for Brennach money on the Night of No Lights. Isolde's father died because of it." });
  await c.call("gm_write", { campaign_id: campaignId, kind: "clock", key: "guild-vote", body: "Ysolt Marrow gathers votes to remove Corwen.", data: { step: 3, steps: 5, advances_on: "each guild meeting without Corwen" } });
  await c.call("gm_write", { campaign_id: campaignId, kind: "ending", key: "drowned-at-low-tide", body: "If the truth comes out at the vote, Lamp law drowns Corwen at the Spire's foot." });
  await c.call("record_ruling", { campaign_id: campaignId, text: "Isolde can read the tide tables in her sleep; don't make her roll for tides." });
  await c.call("record_ruling", { campaign_id: campaignId, text: "The fog never lies about the time. Use it as a clock." });
  await c.close();

  // A second Lantern Coast campaign, to check the world and campaign stay distinct.
  const c2 = await claude();
  await c2.call("create_campaign", { world_id: lanternId, name: "Brennach Run", approval_mode: "autopilot" });
  await c2.close();
  return { lanternId, halcyonId, moorsId: moors.status.world_id, campaignId };
}

/** After the user's edit locks Corwen's Wants, the GM proposes a change to it: a conflict. */
async function seedConflict(campaignId) {
  const c = await claude();
  await c.call("open_campaign", { campaign_id: campaignId });
  await c.call("get_context", { campaign_id: campaignId, present: ["Isolde Varre", "Corwen Hale"], place: "The Lantern Spire" });
  await c.call("log_scene", {
    campaign_id: campaignId, place: "The Lantern Spire", present: ["Isolde Varre", "Corwen Hale"],
    summary: "Corwen tells Isolde he means to resign before the vote.",
    updates: [
      { entities: ["Corwen Hale"], tags: ["ch-02"], type: "status-change", severity: "minor", body: "Corwen now wants to resign before the midwinter vote rather than be removed.", knows: ["Corwen Hale", "Isolde Varre"], proposes_section: { entity: "Corwen Hale", key: "wants" } },
      { entities: ["Corwen Hale", "Isolde Varre"], tags: ["ch-02"], type: "new-fact", severity: "minor", body: "Corwen has started teaching Isolde to trim the wick of the Ninth Lens herself.", knows: ["Corwen Hale", "Isolde Varre"] },
    ],
  });
  await c.close();
}

// ---------- the web app ----------
async function startWeb() {
  const proc = spawn(process.execPath, [require.resolve("next/dist/bin/next", { paths: [web] }), "start", "-p", String(PORT)], {
    cwd: web, env: { ...process.env, CONTINUITY_DB: db, CONTINUITY_REFRESH_MS: "600000" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  proc.stdout.on("data", (d) => (log += d));
  proc.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(BASE)).ok) return proc;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error(`web app did not start:\n${log}`);
}

const VARIANTS = [
  { tag: "desktop_light", viewport: { width: 1440, height: 900 }, scheme: "light", dsf: 1 },
  { tag: "desktop_dark", viewport: { width: 1440, height: 900 }, scheme: "dark", dsf: 1 },
  { tag: "mobile_light", viewport: { width: 390, height: 844 }, scheme: "light", dsf: 2 },
  { tag: "mobile_dark", viewport: { width: 390, height: 844 }, scheme: "dark", dsf: 2 },
];

const server = await startWeb();
const browser = await chromium.launch();
const contexts = await Promise.all(
  VARIANTS.map(async (v) => {
    const ctx = await browser.newContext({ viewport: v.viewport, colorScheme: v.scheme, deviceScaleFactor: v.dsf, ...(v.tag.startsWith("mobile") && { isMobile: true, hasTouch: true }) });
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && notes.console.push(`${v.tag} ${page.url()}: ${m.text()}`));
    return { ...v, ctx, page };
  }),
);
const want = (name) => !ONLY || ONLY.split(",").some((o) => name.includes(o));

/** Visit a URL in every variant (or only `which`), run `prep`, save `<name>_<variant>.png`. */
async function shot(name, url, prep, which = VARIANTS.map((v) => v.tag)) {
  if (!want(name)) return;
  for (const v of contexts.filter((x) => which.includes(x.tag))) {
    const resp = await v.page.goto(url, { waitUntil: "networkidle" });
    if (prep) await prep(v.page, v);
    await v.page.waitForTimeout(150);
    await v.page.screenshot({ path: join(out, `${name}_${v.tag}.png`), fullPage: true });
    notes.titles[name] = { title: await v.page.title(), status: resp?.status() };
  }
}

const first = contexts[0].page;
/** Set a campaign's spoiler toggle (stored on the campaign, so it holds for every variant). */
async function spoilers(campaignId, on) {
  await first.goto(`${BASE}/c/${campaignId}/wiki`);
  const sw = first.getByRole("switch", { name: "GM spoilers" });
  if (((await sw.getAttribute("aria-checked")) === "true") !== on) {
    await sw.click();
    await first.waitForLoadState("networkidle");
  }
}

try {
  // Before anything exists: the first-run home screen.
  await shot("00-home-first-run", BASE);

  const { lanternId, halcyonId, moorsId, campaignId } = await seed();
  const C = `${BASE}/c/${campaignId}`;
  const W = `${BASE}/w/${lanternId}`;

  // The user edits Corwen's Wants (locking it), then the GM proposes a change to it.
  await first.goto(`${C}/e/corwen-hale`);
  await first.getByRole("button", { name: "Edit section Wants" }).click();
  await first.getByRole("textbox", { name: "section Wants" }).fill("To hand the Spire to Isolde, and to die before anyone learns what he did on the Night of No Lights.");
  await first.getByRole("button", { name: "Save", exact: true }).click();
  await first.getByRole("radio", { name: "Change from now on" }).check();
  await first.getByRole("button", { name: "Save edit" }).click();
  await first.getByTitle("You edited this section, so GM writes to it are refused.").first().waitFor();
  await seedConflict(campaignId);

  // Home and worlds
  await shot("01-home", BASE);
  await shot("02-world-empty", `${BASE}/w/${moorsId}`);
  await shot("03-world-wiki", W);
  await shot("04-world-review-drafts", `${BASE}/w/${halcyonId}/review`);
  await shot("05-entity-draft-page", `${BASE}/w/${halcyonId}/e/captain-oyelaran`);

  // Campaign, player view (spoilers off)
  await spoilers(campaignId, false);
  await shot("10-campaign-settings_player", C);
  await shot("11-campaign-wiki-cards_player", `${C}/wiki`);
  await shot("12-campaign-wiki-list_player", `${C}/wiki?view=list`);
  await shot("13-search-alias-heron_player", `${C}/wiki?q=heron`);
  await shot("14-search-typo-wrenn_player", `${C}/wiki?q=wrenn`);
  await shot("15-search-no-results_player", `${C}/wiki?q=lighthouse`);
  await shot("16-search-secret-term-admiralty_player", `${C}/wiki?q=admiralty`);
  await shot("17-entity-minor-character-wren_player", `${C}/e/wren-tallow`);
  await shot("18-entity-long-corwen_player", `${C}/e/corwen-hale`);
  await shot("19-entity-corwen-updates-tab_player", `${C}/e/corwen-hale?tab=updates`);
  await shot("20-entity-corwen-history-tab_player", `${C}/e/corwen-hale?tab=history`);
  await shot("21-entity-pc-isolde_player", `${C}/e/isolde-varre`);
  await shot("22-entity-abbess-secret-pc-knows_player", `${C}/e/mirela-oduya`);
  await shot("23-entity-event-night_player", `${C}/e/the-night-of-no-lights`);
  await shot("24-review-queue_player", `${C}/review`);
  await shot("25-gm-notes_player", `${C}/gm`);
  await shot("26-entity-fogwright_player", `${C}/e/the-fogwright`);

  // Campaign, GM view (spoilers on)
  await spoilers(campaignId, true);
  await shot("30-entity-long-corwen_gm", `${C}/e/corwen-hale`);
  await shot("31-entity-corwen-updates-tab_gm", `${C}/e/corwen-hale?tab=updates`);
  await shot("32-review-queue_gm", `${C}/review`);
  await shot("33-review-conflict-filter_gm", `${C}/review?filter=conflicts`);
  await shot("34-gm-notes_gm", `${C}/gm`);
  await shot("35-search-secret-term-admiralty_gm", `${C}/wiki?q=admiralty`);
  await shot("36-entity-fogwright_gm", `${C}/e/the-fogwright`);
  await shot("37-entity-wren-history_gm", `${C}/e/wren-tallow?tab=history`);

  // Editing
  await shot("40-edit-mode-section", `${C}/e/corwen-hale`, async (p) => {
    await p.getByRole("button", { name: "Edit section Background" }).click();
  });
  await shot("41-edit-confirm-dialog", `${C}/e/corwen-hale`, async (p) => {
    await p.getByRole("button", { name: "Edit section Appearance" }).click();
    await p.getByRole("textbox", { name: "section Appearance" }).fill("Tall, stooped from the Spire's stairs, beard gone the colour of ash. Missing two fingers of his left hand, lost to a winch in year 190.");
    await p.getByRole("button", { name: "Save", exact: true }).click();
  });
  await shot("42-add-section-open", `${C}/e/wren-tallow`, async (p) => {
    await p.getByText("+ Add a section").click();
  });
  await shot("43-empty-slots-write", `${C}/e/pell`);
  await shot("44-review-edit-update", `${C}/review`, async (p) => {
    const b = p.getByRole("button", { name: /^Edit/ }).first();
    if (await b.count()) await b.click();
  }, ["desktop_light", "mobile_light"]);

  // New page (UX #5)
  await shot("45-new-page-form", `${C}/new?type=character`);
  await shot("46-new-page-created", `${C}/new?type=character`, async (p) => {
    await p.getByLabel("Name", { exact: true }).fill("Ottilie Brand");
    await p.getByLabel("Also called").fill("the Lamp-widow");
    await p.getByLabel("Current state").fill("Widow of the keeper who drowned in year 199. Sells oil to the Spire at a loss, and won't say why.");
    await p.getByRole("button", { name: "Create page" }).click();
    await p.waitForURL(/\/e\/ottilie-brand/);
    await p.waitForLoadState("networkidle");
  }, ["desktop_light"]);
  await shot("47-new-page-duplicate", `${C}/new`, async (p) => {
    await p.getByLabel("Name", { exact: true }).fill("The Heron");
    await p.getByRole("button", { name: "Create page" }).click();
    await p.getByRole("alert").waitFor();
  }, ["desktop_light"]);

  // Import and errors
  await shot("50-import-error", BASE, async (p) => {
    const bad = join(tmpdir(), "not-a-world.zip");
    writeFileSync(bad, "this is not a zip");
    await p.getByLabel("World export .zip").setInputFiles(bad);
    await p.getByRole("button", { name: "Import" }).click();
    await p.waitForTimeout(800);
  }, ["desktop_light", "mobile_light"]);
  await shot("51-create-world-empty-name", BASE, async (p) => {
    await p.getByRole("button", { name: "Create world" }).click();
  }, ["desktop_light"]);
  await shot("52-entity-not-found", `${C}/e/the-heron`, null, ["desktop_light", "mobile_light"]);
  await shot("53-campaign-not-found", `${BASE}/c/does-not-exist`, null, ["desktop_light"]);
  await shot("54-second-campaign-same-world", `${BASE}/`, null, ["desktop_light"]);

  // Keyboard focus: tab through the top of an entity page
  await shot("60-keyboard-focus", `${C}/e/wren-tallow`, async (p) => {
    for (let i = 0; i < 4; i++) await p.keyboard.press("Tab");
  }, ["desktop_light", "desktop_dark"]);

  // ---------- timed task: find a minor character's fact mid-game ----------
  // From the campaign dashboard, the AI just said "the Heron". Need: how much Wren owes, and to whom.
  if (want("timed")) {
    await spoilers(campaignId, false);
    for (const v of contexts.filter((x) => x.tag === "desktop_light" || x.tag === "mobile_light")) {
      const p = v.page;
      const steps = [];
      await p.goto(`${C}/e/isolde-varre`, { waitUntil: "networkidle" });
      const t0 = Date.now();
      if (v.tag.startsWith("mobile")) {
        const box = p.getByRole("search").getByRole("searchbox");
        await box.tap();
        steps.push("tap search box");
        await box.fill("heron");
      } else {
        await p.getByRole("searchbox", { name: "Search the wiki" }).click();
        steps.push("click search box");
        await p.getByRole("searchbox", { name: "Search the wiki" }).fill("heron");
      }
      await p.keyboard.press("Enter");
      steps.push("type 'heron' + Enter");
      await p.waitForURL(/q=heron/);
      await p.waitForLoadState("networkidle");
      const t1 = Date.now();
      await p.screenshot({ path: join(out, `70-timed-search-results_${v.tag}.png`), fullPage: false });
      await p.getByRole("link", { name: /Wren Tallow/ }).first().click();
      steps.push("click Wren Tallow result");
      await p.waitForURL(/wren-tallow/);
      await p.waitForLoadState("networkidle");
      const t2 = Date.now();
      const debts = p.getByRole("heading", { name: "Debts" });
      const inView = await debts.evaluate((el) => el.getBoundingClientRect().top < window.innerHeight);
      if (!inView) steps.push("scroll to Debts");
      await debts.scrollIntoViewIfNeeded();
      await p.screenshot({ path: join(out, `71-timed-fact-found_${v.tag}.png`), fullPage: false });
      notes.timings[v.tag] = { steps, searchMs: t1 - t0, pageMs: t2 - t1, debtsAboveFold: inView };
    }
  }

  // Page titles across a few screens, for the browser-tab check
  for (const u of [`${C}/e/corwen-hale`, `${C}/review`, `${BASE}/w/${halcyonId}`, `${C}/gm`]) {
    await first.goto(u);
    notes.titles[u.replace(BASE, "")] = { title: await first.title() };
  }
  notes.urls = { C, W, halcyon: `${BASE}/w/${halcyonId}`, moors: `${BASE}/w/${moorsId}` };
} finally {
  writeFileSync(join(out, "_notes.json"), JSON.stringify(notes, null, 2));
  await browser.close();
  server.kill();
}
console.log(`Screenshots in ${out}`);
