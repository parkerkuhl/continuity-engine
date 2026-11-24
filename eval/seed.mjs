// Seeds eval/facts.md into a fresh wiki through the MCP server, as Claude would have stored them in chapter 1.
// Every fact becomes a page, a confirmed update with who knows it, a secret section with its knowers, or a ruling.
//
//   node eval/seed.mjs path/to/continuity.db     (prints the campaign id)
import { connectMcp } from "./lib/mcp.mjs";

const must = (r, what) => {
  if (r.isError) throw new Error(`${what} failed:\n${r.text}`);
  return r;
};

export async function seed(db) {
  const c = await connectMcp(db);
  const call = async (name, args) => must(await c.call(name, args), name);
  try {
    const world = await call("create_world", {
      name: "The Free Cities",
      pitch: "Sellswords and old debts on the Rhoyne.",
      depth: "compact",
      approval_mode: "autopilot",
      as_of: "Spring, year 300",
    });
    const w = world.status.world_id;
    const page = (p) => call("create_entity", { world_id: w, source: "invention", aliases: [], sections: [], ...p });

    await page({
      type: "character", name: "Marro", aliases: ["the squire"], source: "ruling",
      summary: "Rickard Snow's squire, sixteen. Two fingers of his right hand are broken and splinted. He lost his dagger in the Rhoyne and carries a cudgel. Owes Pallo 30 silver stags.",
      sections: [
        { heading: "Background", body: "Squire to Rickard Snow for three years. Quick, watchful, good with numbers. His mother taught him to read." },
        { heading: "Born a slave", body: "Marro was born a slave in Volantis and escaped as a child. Only Hesse knows.", visibility: "secret" },
      ],
    });
    await page({
      type: "character", name: "Rickard Snow", aliases: ["Snow", "the bastard sellsword", "Commander"],
      summary: "Sellsword captain of the Golden Company, camped outside Volantis. A crossbow bolt wound in his left shoulder (ch-01): he can't raise a shield or draw a bow with that arm.",
      sections: [
        { heading: "Appearance", body: "Tall and grey-eyed, with a burn scar along the jaw." },
        { heading: "Wants", body: "Land of his own, and to pay the company before winter." },
        { heading: "Mother", body: "His mother was a daughter of House Maegyr, of the Old Blood.", visibility: "secret" },
        { heading: "The siege plans", body: "He sold the Company's siege plans to the Triarch. No one else knows.", visibility: "secret" },
        { heading: "The Triarch's letter", body: "The Triarch's sealed letter is in his strongbox; the key hangs on a cord at his neck.", visibility: "secret" },
      ],
    });
    await page({
      type: "character", name: "Hesse", aliases: ["Sergeant Hesse", "the sergeant"],
      summary: "Company sergeant. Lost her left eye to the Triarch's men and wears a patch. Her horse, Ash, is lame.",
      sections: [{ heading: "Reports to Lysono", body: "She reports on Rickard to the paymaster, Lysono Qhoran.", visibility: "secret" }],
    });
    await page({ type: "character", name: "Lysono Qhoran", aliases: ["Lysono", "the paymaster"], summary: "The Golden Company's paymaster. Watches the captains' books and their loyalties." });
    await page({ type: "character", name: "Pallo", aliases: ["the moneylender"], summary: "A Volantene moneylender who dresses his men in grey." });
    await page({ type: "character", name: "Ser Tobbin", aliases: ["Tobbin"], summary: "A hedge knight who sells his sword to the company. Dagna's brother." });
    await page({ type: "character", name: "Dagna", aliases: ["Dagna the smuggler"], summary: "A river smuggler. Dead (ch-01): killed by Marro in the alleys; her body went into the Rhoyne." });
    await page({ type: "character", name: "Brother Olyvar", aliases: ["Olyvar", "the septon"], summary: "The company septon. Died of fever in ch-01; buried outside the Black Wall." });
    await page({ type: "character", name: "Lissa", aliases: ["the ferry-girl"], summary: "A ferry-girl on the Rhoyne. Her mother lives in the Dragon's Den district." });
    await page({ type: "character", name: "Triarch Malaquo", aliases: ["Malaquo", "the Triarch"], summary: "One of the three Triarchs of Volantis." });
    await page({ type: "faction", name: "Golden Company", aliases: ["the Company"], source: "canon", summary: "The largest sellsword company in Essos, camped outside Volantis. It owes Triarch Malaquo two months of grain bought on credit." });
    await page({ type: "place", name: "Volantis", aliases: ["Old Volantis"], source: "canon", summary: "The oldest of the Free Cities, split by the Black Wall." });
    await page({ type: "place", name: "Long Bridge", aliases: ["the Long Bridge"], summary: "The bridge joining the two halves of Volantis. Closed by the Triarch's order: crossing needs a stamped pass." });
    await page({ type: "place", name: "Dragon's Den", aliases: ["the Dragon's Den"], summary: "A district of eastern Volantis." });
    await page({ type: "item", name: "Old whetstone", aliases: ["the whetstone", "Rickard's whetstone"], summary: "Rickard's old whetstone, given to Marro. Marro carries it." });
    await page({ type: "item", name: "Lissa's letter", aliases: ["the ferry-girl's letter"], summary: "A letter Lissa gave Marro to carry to her mother in the Dragon's Den." });

    const camp = await call("create_campaign", {
      world_id: w, name: "Run 1", approval_mode: "autopilot",
      settings: { genre: "low fantasy", tone: "grim", difficulty: "balanced", length: "standard", pacing: "balanced", dice: "GM rolls", turn_length: "standard", lines: ["harm to children"], veils: ["sexual content"] },
    });
    const cid = camp.status.campaign_id;
    await call("open_campaign", { campaign_id: cid });
    await call("update_campaign", {
      campaign_id: cid, as_of: "Spring, year 300",
      pc_sheet: {
        name: "Marro",
        stats: { might: 0, finesse: 2, wits: 2, presence: 1, resolve: 3 },
        health: "6/6", stress: "1/5",
        inventory: ["cudgel (no dagger: lost in the Rhoyne)", "Rickard's old whetstone", "Lissa's letter", "4 silver stags", "a borrowed cloak"],
        bonds: ["Hesse: trusted"],
        trackers: { "debt to Pallo": "30 silver stags, due at the new moon (4 days)" },
        flaw_notes: "Gambles when cornered. Swore to Hesse he never would again. Right hand: two fingers broken and splinted.",
      },
    });
    await call("set_voice_anchor", {
      campaign_id: cid,
      sample: "Rain came off the Black Wall in sheets, and the squire counted coins he didn't have.",
      profile: "Clipped, close third person, past tense. Plain diction, hard edges, dry humor; violence quick and ugly.",
      interior_level: "deep",
    });
    const everyone = ["Marro", "Rickard Snow", "Hesse", "Lysono Qhoran", "Pallo", "Ser Tobbin", "Dagna", "Brother Olyvar", "Lissa", "Triarch Malaquo", "Golden Company", "Long Bridge", "Dragon's Den", "Old whetstone", "Lissa's letter"];
    await call("get_context", { campaign_id: cid, present: everyone, place: "Volantis" });
    const company = ["Marro", "Rickard Snow", "Hesse", "Lysono Qhoran", "Ser Tobbin"];
    const u = (entities, type, severity, body, knows) => ({ entities, tags: ["ch-01"], type, severity, body, knows });
    const logged = await call("log_scene", {
      campaign_id: cid,
      summary: "Chapter 1 in brief: the siege camp outside Volantis, a bolt in Rickard's shoulder, a fever in the camp, a brawl in a dice house, and a killing in the alleys.",
      present: ["Marro", "Rickard Snow", "Hesse"],
      place: "Volantis",
      updates: [
        u(["Rickard Snow"], "status-change", "major", "Rickard took a crossbow bolt in the left shoulder. He can't raise a shield or draw a bow with that arm, and fights at -1.", ["Rickard Snow", "Marro", "Hesse"]),
        u(["Marro"], "status-change", "minor", "Two fingers of Marro's right hand are broken and splinted after the dice-house brawl. He can't grip a blade properly in that hand.", ["Marro", "Hesse"]),
        u(["Hesse"], "status-change", "minor", "Hesse lost her left eye to the Triarch's men and wears a patch.", company),
        u(["Brother Olyvar"], "death", "major", "Brother Olyvar died of fever and is buried outside the Black Wall.", company),
        u(["Dagna", "Marro"], "death", "major", "Marro killed Dagna the smuggler in the alleys, in self-defense, and her body went into the Rhoyne. Ser Tobbin doesn't know she is dead.", ["Marro"]),
        u(["Marro", "Pallo"], "new-fact", "minor", "Marro owes Pallo 30 silver stags, due at the next new moon, four days from the start of chapter 2.", ["Marro", "Pallo"]),
        u(["Golden Company", "Triarch Malaquo"], "new-fact", "major", "The Golden Company owes Triarch Malaquo two months of grain, bought on credit.", ["Rickard Snow", "Hesse", "Lysono Qhoran"]),
        u(["Rickard Snow", "Golden Company"], "faction-shift", "major", "Rickard sold the Company's siege plans to the Triarch.", ["Rickard Snow"]),
        u(["Hesse", "Lysono Qhoran"], "knowledge", "major", "Hesse reports on Rickard to the paymaster, Lysono Qhoran.", ["Hesse", "Lysono Qhoran"]),
        u(["Rickard Snow", "Marro"], "item", "minor", "Rickard gave Marro his old whetstone; Marro carries it.", ["Rickard Snow", "Marro"]),
        u(["Marro"], "item", "minor", "Marro lost his dagger in the Rhoyne. He now carries only a cudgel.", ["Marro"]),
        u(["Rickard Snow"], "item", "major", "The Triarch's sealed letter is in Rickard's strongbox; the key hangs on a cord at his neck.", ["Rickard Snow"]),
        u(["Hesse"], "item", "minor", "Hesse's horse, Ash, is lame, and the company has no spare horses.", company),
        u(["Marro", "Hesse"], "relationship", "minor", "Marro swore to Hesse that he would never gamble again.", ["Marro", "Hesse"]),
        u(["Rickard Snow", "Marro"], "relationship", "minor", "Rickard promised Marro a knighthood if the company takes the city.", ["Rickard Snow", "Marro"]),
        u(["Marro", "Lissa"], "relationship", "minor", "Marro promised Lissa to carry her letter to her mother in the Dragon's Den district. He has the letter.", ["Marro", "Lissa"]),
        u(["Long Bridge", "Triarch Malaquo"], "world-rule", "major", "The Long Bridge is closed by the Triarch's order; crossing needs a stamped pass, and Marro has none.", company),
      ],
      thread_changes: [
        { title: "Pallo's debt", body: "30 silver stags due at the new moon.", tags: ["marro", "pallo"] },
        { title: "Lissa's letter", body: "Marro must carry it to her mother in the Dragon's Den.", tags: ["marro", "lissa"] },
        { title: "A knighthood if the city falls", body: "Rickard's promise to Marro.", tags: ["rickard-snow", "marro"] },
        { title: "Who is selling the company?", body: "The Triarch seems to know the company's plans.", tags: ["golden-company"] },
      ],
      secrets_learned: [
        { entity: "Marro", section: "born-a-slave", by: ["Hesse"] },
        { entity: "Rickard Snow", section: "mother", by: ["Marro"] },
        { entity: "Hesse", section: "reports-to-lysono", by: ["Lysono Qhoran"] },
      ],
    });
    if (logged.status.updates?.some((x) => x.status === "refused")) throw new Error(`seed updates refused:\n${logged.text}`);
    await call("record_ruling", { campaign_id: cid, text: "Marro can read; his mother taught him.", kind: "canon" });
    await call("gm_write", { campaign_id: cid, kind: "clock", key: "triarch-assault", body: "The Triarch moves on the camp.", data: { step: 2, steps: 6, advances_on: "each night the plans go unrecovered" } });
    await call("close_chapter", { campaign_id: cid, title: "The Black Wall", summary: "Rickard is wounded, Brother Olyvar dies of fever, Marro kills Dagna in self-defense and loses his dagger, and the company's grain now comes on the Triarch's credit." });
    return { worldId: w, campaignId: cid };
  } finally {
    await c.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = process.argv[2];
  if (!db) throw new Error("usage: node eval/seed.mjs path/to/continuity.db");
  const r = await seed(db);
  console.log(JSON.stringify(r));
}
