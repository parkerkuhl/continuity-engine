# Backlog

Work Parker has asked for but not scheduled yet. SPEC.md stays the source of truth; items here are not in it until Parker says so.

- **Import a campaign into an existing world from the web app** (asked 2026-11-28). Core already supports it: `RulesEngine.importCampaign(files, { worldId })` joins the campaign to that world and ignores the world folder in the zip. Needs a button on the world page (or a world picker on the home import) so a campaign zip doesn't always create a second copy of its world.
