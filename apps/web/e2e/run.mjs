// Milestone 5 and 6 acceptance, end to end: Claude (the real MCP server over stdio) and the web app
// (next start) share one database file, and a browser drives the screens.
//
//   pnpm --filter @continuity/mcp build && pnpm --filter @continuity/web build && pnpm --filter @continuity/web e2e
//
// Screenshots land in e2e/out/. Exits non-zero if any acceptance check fails.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..");
const mcpBundle = join(web, "../mcp/dist/bin/server.js");
const out = join(here, "out");
mkdirSync(out, { recursive: true });
if (!existsSync(mcpBundle)) throw new Error("Build the MCP server first: pnpm --filter @continuity/mcp build");
if (!existsSync(join(web, ".next"))) throw new Error("Build the web app first: pnpm --filter @continuity/web build");

const db = join(mkdtempSync(join(tmpdir(), "continuity-e2e-")), "continuity.db");
const PORT = Number(process.env.PORT || 3123);
const BASE = `http://localhost:${PORT}`;

// ---------- Claude's side ----------
async function claude() {
  const client = new Client({ name: "e2e-claude", version: "0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [mcpBundle], env: { ...process.env, CONTINUITY_DB: db }, stderr: "ignore" }));
  const call = async (name, args = {}) => {
    const r = await client.callTool({ name, arguments: args });
    return { text: r.content[0].text, status: r.content[1] ? JSON.parse(r.content[1].text) : {}, isError: !!r.isError };
  };
  return { call, close: () => client.close() };
}

async function seed() {
  const c = await claude();
  const world = await c.call("create_world", { name: "The Free Cities", pitch: "Sellswords and old debts on the Rhoyne.", depth: "compact", approval_mode: "autopilot" });
  const worldId = world.status.world_id;
  await c.call("create_entity", {
    world_id: worldId, type: "character", name: "Rickard Snow", aliases: ["Snow", "the bastard sellsword"], source: "invention",
    summary: "Sellsword captain of the Golden Company, camped outside Volantis.",
    sections: [
      { heading: "Appearance", body: "Tall and grey-eyed, with a burn scar along the jaw." },
      { heading: "Wants", body: "Land of his own.\n\n### Short term\nPay the company before winter." },
      { heading: "Hiding", body: "His mother's name, and why it matters in Volantis.", visibility: "secret" },
    ],
  });
  await c.call("create_entity", { world_id: worldId, type: "character", name: "Marro", aliases: ["the squire"], source: "ruling", summary: "Rickard's squire, sixteen and sharp-eyed." });
  await c.call("create_entity", { world_id: worldId, type: "place", name: "Volantis", aliases: ["Old Volantis"], source: "canon", summary: "The oldest of the Free Cities, split by the Black Wall." });
  await c.call("create_entity", { world_id: worldId, type: "faction", name: "Golden Company", aliases: ["the Company"], source: "canon", summary: "The largest sellsword company in Essos." });
  await c.call("create_entity", { world_id: worldId, type: "concept", name: "Glossary", source: "invention", summary: "Oaths and forms of address.", sections: [{ heading: "Oaths", body: "- *By the Black Wall*: a Volantene oath." }] });
  const campaign = await c.call("create_campaign", { world_id: worldId, name: "Run 1", approval_mode: "review", settings: { genre: "low fantasy", tone: "grim", difficulty: "balanced", lines: ["harm to children"] } });
  const campaignId = campaign.status.campaign_id;
  await c.call("open_campaign", { campaign_id: campaignId });
  await c.call("update_campaign", { campaign_id: campaignId, as_of: "Spring, year 300", pc_sheet: { name: "Marro", stats: { might: 0, finesse: 2, wits: 2, presence: 1, resolve: 1 }, health: 6, stress: 1, inventory: ["dagger", "a borrowed cloak"] } });
  await c.call("set_voice_anchor", { campaign_id: campaignId, sample: "Rain came off the Black Wall in sheets, and the squire counted coins he didn't have.", profile: "Clipped, close third.", interior_level: "deep" });
  await c.call("get_context", { campaign_id: campaignId, present: ["Rickard Snow", "Marro", "Golden Company"], place: "Volantis" });
  const logged = await c.call("log_scene", {
    campaign_id: campaignId, summary: "A night watch on the walls; Rickard limps and won't say why.", present: ["Rickard Snow", "Marro", "Golden Company"], place: "Volantis",
    updates: [
      { entities: ["Rickard Snow"], tags: ["ch-01"], type: "status-change", severity: "minor", body: "Rickard limps on his left leg.", knows: ["Rickard Snow", "Marro"] },
      { entities: ["Rickard Snow"], tags: ["ch-01"], type: "item", severity: "minor", body: "Rickard gave Marro his old whetstone.", knows: ["Rickard Snow", "Marro"] },
      { entities: ["Rickard Snow", "Marro"], tags: ["ch-01"], type: "relationship", severity: "minor", body: "Rickard trusts Marro with the company payroll.", knows: ["Rickard Snow", "Marro"] },
      { entities: ["Rickard Snow", "Golden Company"], tags: ["ch-01"], type: "faction-shift", severity: "major", body: "Rickard sold the Company's siege plans to the Triarch.", knows: ["Rickard Snow"] },
    ],
    thread_changes: [{ title: "Rickard's limp", body: "He won't say where he got it.", tags: ["rickard-snow"] }],
  });
  if (logged.isError || logged.status.updates.some((u) => u.status === "refused")) throw new Error(`seed scene not fully logged:\n${logged.text}`);
  await c.call("gm_write", { campaign_id: campaignId, kind: "twist", key: "the-sale", body: "Rickard is the traitor; the limp is from the meeting at the Long Bridge." });
  await c.call("gm_write", { campaign_id: campaignId, kind: "clock", key: "triarch-assault", body: "The Triarch moves on the camp.", data: { step: 2, steps: 6, advances_on: "each night the plans go unrecovered" } });
  await c.call("record_ruling", { campaign_id: campaignId, text: "Marro can read; his mother taught him." });
  // Milestone 6: a world built by interview in review mode, so Claude's pages wait for approval.
  const salt = await c.call("create_world", { name: "Saltmarch", pitch: "Drowned towns and toll-lords.", depth: "compact", approval_mode: "review" });
  const saltId = salt.status.world_id;
  for (const p of [
    { type: "concept", name: "Overview", summary: "Drowned towns ruled by toll-lords.", sections: [{ heading: "Pillars", body: "Debt, water, family." }] },
    { type: "place", name: "Gullhaven", summary: "The last dry harbor, on stilts.", sections: [{ heading: "Districts", body: "Stilts and the Dry Ward." }] },
    { type: "character", name: "Old Ivo", summary: "A ferryman who drowned twice.", sections: [] },
  ]) {
    const r = await c.call("create_entity", { world_id: saltId, source: "invention", ...p });
    if (r.status.status !== "proposed") throw new Error(`Saltmarch page not proposed:\n${r.text}`);
  }
  await c.call("update_world", { world_id: saltId, as_of: "First week of the dry season" });
  await c.close();
  return { worldId, campaignId, saltId };
}

// ---------- the web app ----------
async function startWeb() {
  const proc = spawn(process.execPath, [require.resolve("next/dist/bin/next", { paths: [web] }), "start", "-p", String(PORT)], {
    cwd: web, env: { ...process.env, CONTINUITY_DB: db, CONTINUITY_REFRESH_MS: "1500" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  proc.stdout.on("data", (d) => (log += d));
  proc.stderr.on("data", (d) => (log += d));
  proc.log = () => log;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return proc;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error(`web app did not start:\n${log}`);
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push([name, true]);
  } catch (e) {
    results.push([name, false, process.env.E2E_LOG ? e.message : e.message.split("\n")[0]]);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const { campaignId, worldId, saltId } = await seed();
const server = await startWeb();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
const C = `${BASE}/c/${campaignId}`;
const text = () => page.locator("main").innerText();

try {
  await page.goto(BASE);
  await shot("01-home");

  await check("Spoiler toggle off hides secret sections, gm/ notes, and updates the PC doesn't know", async () => {
    await page.goto(`${C}/e/rickard-snow`);
    expect((await page.getByRole("switch", { name: "GM spoilers" }).getAttribute("aria-checked")) === "false", "spoilers should default to off");
    let t = await text();
    expect(!t.includes("Hiding") && !t.includes("mother's name"), "secret section shown with spoilers off");
    expect(t.includes("1 secret section is hidden"), "no hidden-section notice");
    expect(t.includes("Rickard limps on his left leg."), "an update the PC knows is missing");
    expect(!t.includes("siege plans"), "an update the PC doesn't know is shown");
    expect((await page.getByRole("img", { name: "Hidden in player view" }).count()) === 1, "GM notes link isn't marked hidden with spoilers off");
    await shot("02-entity-player-view");
    await page.goto(`${C}/gm`);
    expect((await text()).includes("GM notes are hidden"), "GM notes page shows notes with spoilers off");
    expect(!(await text()).includes("traitor"), "GM note text leaked");
    await page.goto(`${C}/wiki?q=mother`);
    expect((await text()).includes("Nothing matches."), "search matched secret-only text");

    await page.getByRole("switch", { name: "GM spoilers" }).click();
    await page.waitForSelector('[role=switch][aria-checked="true"]');
    await page.goto(`${C}/e/rickard-snow`);
    t = await text();
    expect(t.includes("Hiding") && t.includes("siege plans"), "spoilers on should show secrets");
    await shot("03-entity-gm-view");
    await page.goto(`${C}/gm`);
    expect((await text()).includes("traitor"), "GM notes missing with spoilers on");
    await shot("04-gm-notes");
    await page.getByRole("switch", { name: "GM spoilers" }).click();
    await page.waitForSelector('[role=switch][aria-checked="false"]');
  });

  await check("Editing a section locks it, and an AI write to it is then refused", async () => {
    await page.goto(`${C}/e/rickard-snow`);
    await page.getByRole("button", { name: "Edit section Wants" }).click();
    await page.getByRole("textbox", { name: "section Wants" }).fill("A keep by the sea, and a name nobody spits at.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await shot("05-edit-confirm");
    await page.getByRole("radio", { name: "Change from now on" }).check();
    await page.getByRole("button", { name: "Save edit" }).click();
    await page.getByText("The section is now locked against AI edits.").waitFor();
    const wants = page.locator("section", { has: page.getByRole("heading", { name: "Wants" }) });
    expect((await wants.innerText()).includes("locked"), "no lock badge after editing");

    const c = await claude();
    const opened = await c.call("open_campaign", { campaign_id: campaignId });
    expect(/### Rickard Snow[\s\S]*\[FORWARD/.test(opened.text), "the edit isn't in Claude's change feed as a forward change");
    await c.call("read_entity", { entity: "Rickard Snow" });
    const r = await c.call("edit_entity", { entity: "Rickard Snow", sections: [{ key: "wants", body: "Gold, and plenty of it." }] });
    await c.close();
    expect(r.isError && r.text.includes("locked_by_user"), `AI write was not refused: ${r.text}`);
    expect(r.text.includes("proposes_section"), "refusal doesn't say how to fix it");
    await page.reload();
    expect((await text()).includes("A keep by the sea"), "the user's text was overwritten");
  });

  await check("A user edit appears in the next open_campaign change feed with its edit kind", async () => {
    await page.goto(`${C}/e/volantis`);
    await page.getByRole("button", { name: "Edit summary" }).click();
    await page.getByRole("textbox", { name: "summary" }).fill("The oldest of the Free Cities, now under siege by the Triarch's elephants.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("radio", { name: "Retcon: it was always this way" }).check();
    await page.getByRole("button", { name: "Save edit" }).click();
    await page.getByText("Summary saved as a retcon.").waitFor();
    const c = await claude();
    const opened = await c.call("open_campaign", { campaign_id: campaignId });
    await c.close();
    const feed = opened.text.split("## Changed since last session")[1]?.split("\n## ")[0] ?? "";
    expect(/### Volantis[\s\S]*\[RETCON/.test(feed), `no retcon for Volantis in the feed:\n${opened.text.slice(0, 1500)}`);
  });

  await check("Approving in the review queue flips the update to confirmed; restore from history works", async () => {
    await page.goto(`${C}/review`);
    const t = await text();
    expect(t.includes("1 proposed update the PC doesn't know is hidden"), "hidden proposed update not reported");
    await shot("06-review-queue");
    const item = page.locator("section[aria-label='Proposed updates'] li", { hasText: "Rickard limps on his left leg." });
    await item.getByRole("button", { name: "Approve" }).click();
    await item.waitFor({ state: "detached" }); // approved updates leave the queue
    await page.goto(`${C}/e/rickard-snow`);
    const upd = page.locator("aside li", { hasText: "Rickard limps on his left leg." });
    expect(/confirmed/i.test(await upd.innerText()), "approved update isn't confirmed on the entity page");

    const c = await claude();
    await c.call("open_campaign", { campaign_id: campaignId });
    const ctx = await c.call("read_entity", { entity: "Rickard Snow" });
    await c.close();
    expect(/Rickard limps on his left leg\.[^\n]*\[confirmed\]|\[confirmed\][^\n]*Rickard limps/.test(ctx.text) || !/PROPOSED[^\n]*Rickard limps/.test(ctx.text), "Claude still sees the approved update as proposed");

    // Restore: undo the Wants edit from the history panel.
    const row = page.locator("aside li", { hasText: "the Wants section" }).first();
    await row.getByRole("button", { name: "Undo this change" }).click();
    await page.getByRole("radio", { name: "Retcon: it was always this way" }).check();
    await page.getByRole("button", { name: "Undo change" }).click();
    await page.getByText("Restored. The restore is itself a new version.").waitFor();
    await page.reload();
    await shot("07-entity-history");
    const wantsNow = await page.locator("section", { has: page.getByRole("heading", { name: "Wants" }) }).innerText();
    expect(wantsNow.includes("Land of his own.") && !wantsNow.includes("A keep by the sea"), "restore didn't bring back the earlier text");
    await shot("07-entity-history");
  });

  await check("M6: pages Claude drafts wait in the review queue; approving makes them canon, rejecting drops them", async () => {
    const W = `${BASE}/w/${saltId}`;
    await page.goto(W);
    expect((await text()).includes("First week of the dry season"), "world as-of moment not shown");
    const badge = await page.locator("nav a", { hasText: "Review queue" }).innerText();
    expect(badge.includes("3"), `review badge should count 3 drafts, got "${badge}"`);
    expect((await page.locator("main a", { hasText: "Gullhaven" }).innerText()).includes("Draft"), "draft pill missing on the wiki card");
    await page.goto(`${W}/review`);
    expect((await text()).includes("3 pages the GM drafted"), "world review queue doesn't list the drafts");
    await shot("11-world-review");
    for (const name of ["Overview", "Gullhaven"]) {
      await page.getByRole("button", { name: `Approve ${name}` }).click();
      await page.locator("section[aria-label='New pages'] li", { hasText: name }).waitFor({ state: "detached" });
    }
    await page.goto(`${W}/e/old-ivo`);
    expect((await text()).includes("Draft: the GM wrote this page"), "draft banner missing on the entity page");
    await shot("12-entity-draft");
    await page.getByRole("button", { name: "Reject page" }).click();
    await page.waitForURL(W);
    const wiki = await text();
    expect(!wiki.includes("Old Ivo") && wiki.includes("Gullhaven"), "rejected page still listed, or approved page missing");
    await page.goto(`${W}/e/gullhaven`);
    expect(!(await text()).includes("Draft: the GM wrote"), "approved page still shows the draft banner");

    const c = await claude();
    const camp = await c.call("create_campaign", { world_id: saltId, name: "Salt run" });
    const opened = await c.call("open_campaign", { campaign_id: camp.status.campaign_id });
    const ctx = await c.call("read_entity", { campaign_id: camp.status.campaign_id, entity: "Gullhaven" });
    const ivo = await c.call("read_entity", { campaign_id: camp.status.campaign_id, entity: "Old Ivo" });
    await c.close();
    expect(/as of: First week of the dry season/.test(opened.text), "campaign doesn't start at the world's as-of moment");
    expect(!/PROPOSED/.test(ctx.text), "Claude still sees the approved page as proposed");
    expect(ivo.isError, "Claude can still read the rejected page");
  });

  await check("Voice: editing the sample in campaign settings reaches Claude in open_campaign and every get_context", async () => {
    await page.goto(C);
    const card = page.locator("section#voice");
    expect((await card.innerText()).includes("Rain came off the Black Wall"), "the stored sample isn't shown");
    await card.getByText("Edit voice").click();
    await card.getByRole("textbox", { name: /Sample/ }).fill("Snow fell on the Black Wall, and nobody counted it.");
    await card.getByRole("textbox", { name: /Avoid/ }).fill("neat closing lines\nepigrams");
    await card.getByRole("button", { name: "Save voice" }).click();
    await page.getByText("Voice saved.").waitFor();
    await page.reload();
    await shot("11-voice-settings");
    const c = await claude();
    const opened = await c.call("open_campaign", { campaign_id: campaignId });
    const ctx = await c.call("get_context", { campaign_id: campaignId, present: ["Rickard Snow"] });
    await c.close();
    expect(opened.text.includes("voice anchor (write against the new version"), "the voice edit isn't in the change feed");
    expect(ctx.text.includes("> Snow fell on the Black Wall, and nobody counted it."), `get_context lacks the new sample:\n${ctx.text.slice(0, 1200)}`);
    expect(ctx.text.includes("Avoid: neat closing lines; epigrams"), "get_context lacks the avoid list");
  });

  await check("Auto-refresh: a scene Claude logs shows up in the open review queue without a reload", async () => {
    await page.goto(`${C}/review`);
    const before = await page.evaluate(() => performance.timeOrigin);
    const c = await claude();
    await c.call("open_campaign", { campaign_id: campaignId });
    await c.call("get_context", { campaign_id: campaignId, present: ["Rickard Snow", "Marro"] });
    const r = await c.call("log_scene", {
      campaign_id: campaignId, summary: "Dawn drill.", present: ["Rickard Snow", "Marro"],
      updates: [{ entities: ["Marro"], tags: ["ch-01"], type: "status-change", severity: "minor", body: "Marro split his lip at the dawn drill.", knows: ["Marro", "Rickard Snow"] }],
    });
    await c.close();
    expect(!r.isError, `log_scene failed: ${r.text}`);
    await page.getByText("Marro split his lip at the dawn drill.").waitFor({ timeout: 15_000 });
    expect((await page.evaluate(() => performance.timeOrigin)) === before, "the page reloaded instead of refreshing in place");
  });

  await check("Review filters cover drafted pages; Approve all pages approves the ones listed", async () => {
    const c = await claude();
    await c.call("open_campaign", { campaign_id: campaignId });
    for (const name of ["Ser Wyl", "The Tidewatch"]) {
      const r = await c.call("create_entity", { world_id: worldId, campaign_id: campaignId, type: name === "Ser Wyl" ? "character" : "faction", name, source: "invention", summary: `${name}, new in camp.` });
      expect(r.status.status === "proposed", `${name} isn't proposed: ${r.text}`);
    }
    await page.goto(`${C}/review?filter=minor`);
    expect(!(await text()).includes("New pages the GM drafted"), "the Minor filter still shows drafted pages");
    await page.getByRole("link", { name: /New pages 2/ }).click();
    await page.waitForURL(/filter=pages/);
    const t = await text();
    expect(t.includes("Ser Wyl") && t.includes("The Tidewatch"), "the New pages filter doesn't list the drafts");
    expect(!t.includes("Proposed updates"), "the New pages filter still shows updates");
    await shot("12-review-pages-filter");
    await page.getByRole("button", { name: "Approve all pages (2)" }).click();
    await page.locator("section[aria-label='New pages']").waitFor({ state: "detached" }); // approved pages leave the queue
    const check = await c.call("read_entity", { campaign_id: campaignId, entity: "Ser Wyl" });
    await c.close();
    expect(!check.text.includes("PROPOSED PAGE"), `Ser Wyl is still proposed:\n${check.text.slice(0, 400)}`);
  });

  await check("To the PC: open_campaign lists characters without a label; the label Claude sets shows on the wiki card and the page", async () => {
    const c = await claude();
    const opened = await c.call("open_campaign", { campaign_id: campaignId });
    expect(/no "To the PC" line[\s\S]*Rickard Snow \(rickard-snow\)/.test(opened.text), "open_campaign doesn't list Rickard as missing a label");
    await c.call("read_entity", { campaign_id: campaignId, entity: "Rickard Snow" });
    const r = await c.call("edit_entity", { campaign_id: campaignId, entity: "Rickard Snow", sections: [{ key: "to-the-pc", body: "Liege lord" }] });
    await c.close();
    expect(!r.isError, `edit_entity failed: ${r.text}`);
    await page.goto(`${C}/wiki?type=character`);
    const card = page.getByRole("link", { name: /Rickard Snow/ });
    expect((await card.innerText()).includes("Liege lord"), "the wiki card doesn't show the label");
    expect((await page.getByRole("link", { name: /Ser Wyl/ }).innerText()).includes("To the PC: not set"), "a character without a label doesn't show the empty spot");
    expect(!(await page.getByRole("link", { name: /Marro/ }).innerText()).includes("To the PC"), "the PC's card shows a To the PC spot");
    await shot("13-wiki-to-the-pc");
    await page.goto(`${C}/e/rickard-snow`);
    await page.getByRole("link", { name: "To the PC: Liege lord" }).waitFor();
    await shot("14-entity-to-the-pc");
  });

  await page.goto(`${C}/wiki`);
  await shot("08-wiki-browser");
  await page.goto(`${BASE}/w/${worldId}`);
  await shot("08b-world-wiki");
  await page.goto(C);
  await shot("09-campaign-dashboard");
  await page.goto(`${C}/e/marro`);
  await shot("09b-entity-pc");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${C}/e/rickard-snow`);
  await shot("10-entity-phone");
} finally {
  await browser.close();
  server.kill();
}

if (process.env.E2E_LOG) console.log(server.log());
for (const [name, ok, why] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${why ? `\n      ${why}` : ""}`);
console.log(`Screenshots: ${out}`);
process.exit(results.every(([, ok]) => ok) && results.length === 9 ? 0 : 1);
