// Seed world for the UX review screenshots: an original setting with 39 interlinked pages of varied
// length, aliases and nicknames, secret sections, and a campaign with scenes, updates and threads.

const p = (...paras) => paras.join("\n\n");

export const LANTERN = {
  world: {
    name: "The Lantern Coast",
    pitch: "A fog-bound archipelago where the lamp-keepers decide which ships come home.",
    depth: "full",
    approval_mode: "batch",
    as_of: "Late autumn, the 212th year of the Compact",
  },
  pages: [
    // ---------------- characters ----------------
    {
      type: "character", name: "Isolde Varre", aliases: ["Izzy", "the apprentice"], source: "invention",
      summary: "Nineteen, apprentice lamp-keeper at the Lantern Spire under Corwen Hale. Stubborn, good with numbers, bad at keeping quiet.",
      sections: [
        { heading: "Background", body: p("Born in Gullwharf to a net-mender and a ferryman who drowned in the Ninefold shoals when she was eight. Her brother Jory raised her after that, badly and with love.", "She bought her apprenticeship with three years of wages from the fish-market ledgers, which is where she learned that numbers lie less than people do.") },
        { heading: "Appearance", body: "Short, wind-chapped, ink on her fingers. Wears her father's oilskin, patched at both elbows." },
        { heading: "Wants", body: p("To be named keeper of her own light before she turns twenty-five.", "### Underneath\nTo find out why the Spire went dark on the Night of No Lights, because her father's boat was one of the ones that didn't come home.") },
      ],
    },
    {
      type: "character", name: "Corwen Hale", aliases: ["Master Hale", "the Old Lamp", "Keeper Hale"], source: "invention",
      summary: "Keeper of the Lantern Spire for thirty-one years. Gruff, exacting, drinks alone on the gallery. Isolde's master.",
      sections: [
        { heading: "Background", body: p(
          "Corwen came to the Spire at fourteen as a boy who could not read and left his first logbook full of drawings instead of entries. Keeper Annick taught him letters with the tide tables, and he has never written a sentence since without a time and a height of water beside it.",
          "He became keeper at thirty after Annick's death, the youngest the Lamplighters' Guild had named in a century. The appointment was contested; Ysolt Marrow's father argued that a man who had once let the lamp gutter during a storm should never hold the key. Corwen won by a single vote and has treated every guild meeting since as a trial he is still losing.",
          "### The years since\nHe married late and was widowed early. He does not speak of his wife, Elin, except to say that she hated the sound of the foghorn. He has trained six apprentices. Two are keepers now, one drowned, and three left the service. Isolde is the seventh, and the first he chose himself rather than accepted from the Guild's list.",
          "Sailors on the Gullwharf docks say he can tell a ship's home port from the way her lamps sit in the fog. He says that is nonsense and then names the port anyway.",
        ) },
        { heading: "Appearance", body: "Tall, stooped from the Spire's stairs, beard gone the colour of ash. Smells of lamp oil and clove. Missing the last two fingers of his left hand." },
        { heading: "Personality", body: "Patient with the lamp and impatient with everyone else. Keeps promises to the letter and finds loopholes in their spirit. Laughs rarely and too loudly when he does." },
        { heading: "Wants", body: "To hand the Spire to someone who will keep it lit no matter who pays them to let it go dark." },
        { heading: "The Night of No Lights", body: p("Corwen let the Spire go dark on purpose. A Brennach officer paid him forty crowns and promised that the ships coming in that night carried Admiralty spies. Eleven boats ran onto the Ninefold shoals instead, among them the ferry of Isolde's father.", "He has kept the forty crowns, unspent, in a tin under the lamp-room floor."), visibility: "secret" },
      ],
    },
    {
      type: "character", name: "Wren Tallow", aliases: ["the Heron", "Tallow"], source: "invention",
      summary: "Ferry pilot on the Gullwharf to Hollow Isle run. Thin, long-legged, stands in the stern like a wading bird, hence the Heron. Owes money to the wrong people.",
      sections: [
        { heading: "Appearance", body: "All knees and elbows, grey scarf, one gold tooth she says she won at dice." },
        { heading: "Debts", body: "Owes the Tidewater Free Company 60 crowns for the new sail on the Gull's Mercy. Sabin Roake holds the note and has been patient so far." },
        { heading: "Boat", body: "Pilots the Gull's Mercy, a flat-bottomed ferry that can cross the shoals at half tide. Nobody else on the coast will take Hollow Isle passengers after dark." },
      ],
    },
    {
      type: "character", name: "Mirela Oduya", aliases: ["the Abbess", "Mother Oduya"], source: "invention",
      summary: "Abbess of the Choir of the Drowned. Sings the names of the lost at every low tide. Calm, formidable, keeps a ledger of the dead.",
      sections: [
        { heading: "Background", body: "Came from the Brennach mainland as a girl, took vows at sixteen, abbess at forty. Has outlasted three Harbor Wardens." },
        { heading: "Personality", body: "Speaks slowly so that people lean in. Never threatens. Never needs to." },
        { heading: "What the Choir knows", body: "The Choir keeps the true list of the boats lost on the Night of No Lights, and the list has eleven names, not the nine the Harbor Watch published.", visibility: "secret" },
      ],
    },
    {
      type: "character", name: "Sabin Roake", aliases: ["Black Sabin", "Captain Roake"], source: "invention",
      summary: "Captain of the Tidewater Free Company's fastest cutter. Smuggler, money-lender, charming in the way of a man who has never paid full price.",
      sections: [
        { heading: "Appearance", body: "Black coat, silver buttons he cuts off and spends when he is short. Smiles with his whole face." },
        { heading: "Wants", body: "The Brennach blockade broken, because he can't sell what he can't land." },
      ],
    },
    {
      type: "character", name: "Theodora Quell", aliases: ["the Warden", "Lady Quell"], source: "invention",
      summary: "Harbor Warden of Saltlight. Runs the Harbor Watch and sits on the Lamplighters' Guild council. Precise, tired, never seen without gloves.",
      sections: [
        { heading: "Background", body: p("Third daughter of a shipping house that lost everything in the blockade. Took the Warden's chain because nobody else would.", "Her published list of the Night of No Lights named nine boats.") },
        { heading: "Allegiance", body: "Quell has been in the Admiralty of Brennach's pay for two years. She reports guild votes to Commodore Brisk.", visibility: "secret" },
      ],
    },
    { type: "character", name: "Pell", aliases: ["the Rat", "Pell the Rat"], source: "invention", summary: "Gullwharf street kid, maybe eleven. Runs messages for a copper and secrets for a silver.", sections: [] },
    {
      type: "character", name: "Anselm Fitch", aliases: ["Doctor Fitch", "the Surgeon"], source: "invention",
      summary: "Ship's surgeon turned dockside doctor. Drinks, but only after sundown. Patched up half of Gullwharf.",
      sections: [{ heading: "Personality", body: "Gentle hands, cruel tongue. Charges the Watch double and the poor nothing." }],
    },
    {
      type: "character", name: "Marta Gorse", aliases: ["Old Marta", "Granny Gorse"], source: "invention",
      summary: "Fishwife at the Gullwharf market. Hears everything that is said within three stalls of hers, which is most things.",
      sections: [{ heading: "Relationships", body: "Sells to Kettle's Rest. Feeds Pell when nobody is looking. Thinks Corwen Hale is a fool and a good man, in that order." }],
    },
    { type: "character", name: "Brother Iven", aliases: ["Iven"], source: "invention", summary: "Novice of the Choir of the Drowned. Seventeen, devout, terrified of the Abbess and in love with the sea.", sections: [] },
    {
      type: "character", name: "Ysolt Marrow", aliases: ["the Treasurer", "Mistress Marrow"], source: "invention",
      summary: "Treasurer of the Lamplighters' Guild. Inherited her father's seat and his grudge against Corwen Hale.",
      sections: [{ heading: "Wants", body: "Corwen removed as keeper, and the Spire's oil contract given to her cousins." }],
    },
    {
      type: "character", name: "The Fogwright", aliases: ["the Grey Man"], source: "invention",
      summary: "A figure seen on the shoals at low tide, walking where no one can walk. The Choir says he is a ghost. The Watch says he is a smuggler.",
      sections: [
        { heading: "Sightings", body: "Seen three times this autumn on the Ninefold shoals, always the night before a wreck." },
        { heading: "Truth", body: "The Fogwright is Jory Varre, Isolde's brother, mapping the shoals' safe channels for the Tidewater Free Company.", visibility: "secret" },
      ],
    },
    {
      type: "character", name: "Jory Varre", aliases: ["Jory"], source: "invention",
      summary: "Isolde's older brother, twenty-six. Net-mender by trade, often out at night by habit. Says he is fishing.",
      sections: [{ heading: "Relationships", body: "Raised Isolde after their father drowned. Owes Sabin Roake a favour he won't name." }],
    },
    {
      type: "character", name: "Halvard Brisk", aliases: ["the Commodore", "Commodore Brisk"], source: "canon",
      summary: "Commodore of the Brennach blockade squadron. Courteous in letters, merciless in practice.",
      sections: [],
    },
    // ---------------- places ----------------
    {
      type: "place", name: "Saltlight", aliases: ["the City", "Salt"], source: "canon",
      summary: "The largest port of the Lantern Coast, built on three islands joined by bridges. Home of the Lamplighters' Guild.",
      sections: [
        { heading: "Districts", body: p("**Gullwharf**: the docks, the fish market and the ferry slips. Loud, wet, honest.", "**Warden's Hall**: the hill above the harbor. Guild houses, the Watch barracks, the Warden's residence.", "**The Narrows**: the bridge district, where the Tidewater Free Company does business in back rooms.") },
        { heading: "Daily life", body: "The city wakes to the Choir's low-tide bell and sleeps to the foghorn. Nobody whistles on the bridges, because whistling calls the fog." },
      ],
    },
    {
      type: "place", name: "The Lantern Spire", aliases: ["the Spire", "Hale's Light"], source: "canon",
      summary: "The great lighthouse on the point north of Saltlight. Its Ninth Lens can be seen from forty miles in clear weather.",
      sections: [
        { heading: "Layout", body: "Three hundred and twelve steps. The keeper's quarters at the base, the oil store halfway up, the lamp room and gallery at the top." },
        { heading: "Hidden", body: "A loose board under the lamp-room floor hides a tin of Brennach crowns.", visibility: "secret" },
      ],
    },
    { type: "place", name: "Gullwharf", aliases: ["the Wharf"], source: "canon", summary: "Saltlight's dock district: fish market, ferry slips, Kettle's Rest.", sections: [] },
    { type: "place", name: "The Drowned Chapel", aliases: ["the Chapel"], source: "canon", summary: "The Choir of the Drowned's chapel, built half below the high-tide line. At high water the congregation stands in the sea.", sections: [{ heading: "Rites", body: "The names of the lost are sung at every low tide. A name is sung for a year and a day, then carved into the chapel wall." }] },
    { type: "place", name: "Kettle's Rest", aliases: ["the Kettle"], source: "invention", summary: "Gullwharf inn and the best fish stew on the coast. Neutral ground: the Watch drinks on one side, the Free Company on the other.", sections: [] },
    {
      type: "place", name: "The Ninefold Shoals", aliases: ["Ninefold", "the Shoals"], source: "canon",
      summary: "Sandbanks north of the Spire that shift with every storm. Hundreds of wrecks. Passable only with a pilot or a light.",
      sections: [{ heading: "Channels", body: "There are three safe channels at half tide. Their positions change each winter, and the Guild charts them every spring." }],
    },
    { type: "place", name: "Hollow Isle", aliases: ["the Hollow"], source: "invention", summary: "A small island of caves beyond the shoals. Officially empty. Smugglers' cache, unofficially.", sections: [] },
    { type: "place", name: "Warden's Hall", aliases: ["the Hall"], source: "canon", summary: "The Harbor Warden's residence and courtroom on the hill above Saltlight harbor.", sections: [] },
    // ---------------- factions ----------------
    {
      type: "faction", name: "Lamplighters' Guild", aliases: ["the Guild", "the Lamplighters"], source: "canon",
      summary: "The ancient guild that keeps every light on the coast. Sells safe passage to every ship and owes loyalty to none.",
      sections: [
        { heading: "Structure", body: p("A council of seven: four keepers, the Treasurer, the Harbor Warden, and the Abbess of the Choir as witness.", "Keepers are appointed for life and can only be removed by a vote of five.") },
        { heading: "The Lantern Compact", body: "The guild's founding oath: a light is never sold, never bargained, never dimmed for gain. Breaking it is the only crime the guild punishes with drowning." },
      ],
    },
    { type: "faction", name: "Choir of the Drowned", aliases: ["the Choir"], source: "canon", summary: "A religious order that sings for the souls of the drowned and keeps a ledger of every life the sea takes.", sections: [] },
    { type: "faction", name: "Harbor Watch", aliases: ["the Watch"], source: "canon", summary: "Saltlight's harbor police. Underpaid, overworked, answer to the Harbor Warden.", sections: [] },
    { type: "faction", name: "Tidewater Free Company", aliases: ["the Free Company", "the Tidewaters"], source: "invention", summary: "Smugglers, money-lenders and blockade-runners, organised like a merchant house and armed like a navy.", sections: [{ heading: "Leaders", body: "A board of three captains. Sabin Roake is the youngest and the loudest." }] },
    { type: "faction", name: "Admiralty of Brennach", aliases: ["the Admiralty", "Brennach"], source: "canon", summary: "The mainland navy that claims the Lantern Coast and has blockaded Saltlight for two years.", sections: [] },
    // ---------------- items ----------------
    {
      type: "item", name: "The Ninth Lens", aliases: ["the Lens"], source: "canon",
      summary: "The great glass of the Lantern Spire, ground by the first keepers. There is no tenth.",
      sections: [{ heading: "Flaw", body: "A hairline crack runs through the fourth ring. In fog it throws a second, fainter beam to the west.", visibility: "secret" }],
    },
    { type: "item", name: "Corwen's Logbook", aliases: ["the logbook", "the Spire log"], source: "invention", summary: "Thirty-one years of tide heights, ships sighted and lamp hours, in Corwen's cramped hand. The page for the Night of No Lights is missing.", sections: [] },
    { type: "item", name: "Gull's Mercy", aliases: ["the Mercy"], source: "invention", summary: "Wren Tallow's flat-bottomed ferry. Patched, slow, the only boat on the coast that can cross the shoals at half tide.", sections: [] },
    { type: "item", name: "The Choir Bell", aliases: ["the low-tide bell"], source: "canon", summary: "A bronze bell hung below the Drowned Chapel's high-water line. It rings itself when the tide is lowest.", sections: [] },
    // ---------------- events ----------------
    {
      type: "event", name: "The Night of No Lights", aliases: ["the Dark Night", "the Night"], source: "canon",
      summary: "Eleven years ago, every light on the north coast went dark for one night in a storm. The Watch counted nine wrecks on the Ninefold Shoals.",
      sections: [
        { heading: "What everyone knows", body: p("The storm came in after dusk. The Spire's lamp was seen burning at the first bell and was dark by the third. Corwen Hale told the guild inquiry that the oil had been watered and the wick drowned.", "The inquiry found no fault and fined the oil merchant. The merchant left Saltlight the following spring.") },
        { heading: "Aftermath", body: "The Choir carved nine names into the chapel wall. Every year on the anniversary the Spire burns two lamps instead of one." },
      ],
    },
    { type: "event", name: "The Brennach Blockade", aliases: ["the Blockade"], source: "canon", summary: "Two years ago the Admiralty of Brennach closed the sea lanes to Saltlight. Only smugglers and Admiralty-licensed ships get in.", sections: [] },
    { type: "event", name: "The Guild Vote", aliases: ["the vote"], source: "invention", summary: "The Lamplighters' Guild council will vote at midwinter on whether to remove Corwen Hale as keeper.", sections: [] },
    // ---------------- setting ----------------
    {
      type: "concept", name: "Glossary", source: "invention", summary: "Words and oaths of the Lantern Coast.",
      sections: [{ heading: "Terms", body: p("- **Half tide**: the only hours the Ninefold channels are deep enough to cross.", "- **Drowned**: the dead lost at sea. Never \"dead\", never \"lost\".", "- **By the Lens**: an oath. Swearing it falsely is bad luck for the whole coast.", "- **Fogsong**: whistling. Forbidden on the bridges.") }],
    },
    {
      type: "concept", name: "Timeline", source: "invention", summary: "Key dates, counted in years of the Lantern Compact.",
      sections: [{ heading: "Years", body: p("- **Year 1**: the Lantern Compact is sworn.", "- **Year 181**: Corwen Hale becomes keeper of the Spire.", "- **Year 201**: the Night of No Lights.", "- **Year 210**: the Brennach Blockade begins.", "- **Year 212**: now.") }],
    },
    { type: "concept", name: "Fog-tides", aliases: ["the fog"], source: "invention", summary: "The coast's fog comes in with the tide and leaves with it. Sailors read the fog like a clock.", sections: [] },
    { type: "rule", name: "Lamp law", aliases: ["the law of lights"], source: "ruling", summary: "A keeper who lets a light go dark for gain is drowned at the Spire's foot at the next low tide. No exceptions, not even for the Guild council.", sections: [] },
  ],
};

export const HALCYON = {
  world: { name: "Halcyon Drift", pitch: "Salvage crews on the edge of a dead star system.", depth: "compact", approval_mode: "review" },
  pages: [
    { type: "character", name: "Captain Oyelaran", aliases: ["Cap", "the Old Woman"], source: "invention", summary: "Captain of the salvage tug Patience. Sixty, unhurried, owes everyone.", sections: [{ heading: "Secret", body: "She scuttled her last ship for the insurance.", visibility: "secret" }] },
    { type: "character", name: "Tomas Reyes-Kahn", aliases: ["Tommy"], source: "invention", summary: "Patience's engineer. Talks to the reactor. It talks back.", sections: [] },
    { type: "place", name: "Patience", aliases: ["the tug"], source: "invention", summary: "A salvage tug older than her crew combined.", sections: [] },
    { type: "faction", name: "Meridian Salvage Authority", aliases: ["the Authority", "MSA"], source: "invention", summary: "Licenses every wreck in the Drift and takes forty percent.", sections: [] },
  ],
};
