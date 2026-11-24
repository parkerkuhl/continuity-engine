# Evaluation facts

Twenty facts the GM must honor later in the campaign (SPEC "Evaluation", step 1). The campaign is **Run 1** in the Free Cities sample world: Marro, a sixteen-year-old squire, serves Rickard Snow, a sellsword captain of the Golden Company camped outside Volantis. It is the start of chapter 2, spring of year 300.

Both arms start knowing every fact. The wiki arm gets them through `eval/seed.mjs`, which stores them as pages, confirmed updates, knowledge rows and a ruling. The plain arm gets them in the player save block (`eval/baseline/save-block.md`), the way the original GM prompt carries a campaign between chats.

"Knows" lists every character who knows the fact. Anyone not listed must not act on it, and the PC must not be told it.

| ID | Kind | Fact | Knows | Tested in |
| --- | --- | --- | --- | --- |
| F01 | Injury | Rickard took a crossbow bolt in the **left shoulder** in chapter 1. He can't raise a shield or draw a bow with that arm, and fights at -1. | Rickard, Marro, Hesse | S01, S10 |
| F02 | Injury | Two fingers of Marro's **right hand** are broken and splinted (the dice-house brawl). He can't grip a blade properly in that hand. | Marro, Hesse | S01 |
| F03 | Injury | Sergeant Hesse lost her **left eye** to the Triarch's men and wears a patch. | everyone | S07 |
| F04 | Death | Brother Olyvar, the company septon, **died of fever** in chapter 1 and is buried outside the Black Wall. | everyone in the company | S04 |
| F05 | Death | Marro killed **Dagna the smuggler** in the alleys (in self-defense) and her body went into the Rhoyne. Her brother, Ser Tobbin, doesn't know she is dead or who killed her. | Marro | S04 |
| F06 | Debt | Marro owes the moneylender **Pallo 30 silver stags**, due at the next new moon (four days away). | Marro, Pallo | S03, S09 |
| F07 | Debt | The Golden Company owes **Triarch Malaquo** two months of grain, bought on credit. | Rickard, Hesse, Lysono | S10 |
| F08 | Secret | Rickard **sold the Company's siege plans** to the Triarch. | Rickard | S02, S10 |
| F09 | Secret | Marro was **born a slave in Volantis** and escaped as a child. | Marro, Hesse | S07 |
| F10 | Secret | Hesse **reports on Rickard** to the paymaster, Lysono Qhoran. | Hesse, Lysono | S02 |
| F11 | Secret | Rickard's mother was a daughter of **House Maegyr**, of the Old Blood. | Rickard, Marro (learned in chapter 1) | S08 |
| F12 | Item | Rickard gave Marro his **old whetstone**; Marro carries it. | Rickard, Marro | S06 |
| F13 | Item | Marro **lost his dagger** in the Rhoyne. He now carries only a cudgel. | Marro | S01 |
| F14 | Item | The Triarch's **sealed letter** is in Rickard's strongbox; the key hangs on a cord at his neck. | Rickard | S06 |
| F15 | Item | Hesse's horse, **Ash, is lame**, and the company has no spare horses. | everyone in the company | S05 |
| F16 | Promise | Marro **swore to Hesse he would never gamble again**. | Marro, Hesse | S03 |
| F17 | Promise | Rickard **promised Marro a knighthood** if the company takes the city. | Rickard, Marro | S06 |
| F18 | Promise | Marro promised the ferry-girl **Lissa** to carry her letter to her mother in the Dragon's Den district. He has the letter. | Marro, Lissa | S09 |
| F19 | Ruling | **Marro can read**; his mother taught him. (The user's ruling, verbatim.) | Marro | S08 |
| F20 | Status | The **Long Bridge is closed** by the Triarch's order; crossing needs a stamped pass, and Marro has none. | everyone | S05 |

## Scoring

Score each fact in each scene that tests it:

- **Honored:** the narration and NPCs are consistent with the fact, including who knows it.
- **Violated:** the narration contradicts it (a healed wound, a dead man speaking, a lost item in hand, a secret known by someone not listed, the PC told something they don't know).
- **Not tested:** the scene never touched the fact, for instance because the player's moves steered away.

A fact tested in two scenes gets two scores. Also count, per arm, the scenes that ended without a `log_scene` call (wiki arm only) and the updates the rules engine refused.
