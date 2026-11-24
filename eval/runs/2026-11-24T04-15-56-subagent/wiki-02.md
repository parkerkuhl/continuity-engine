# S02: The paymaster's tent (wiki arm)

Tests: F08, F10. Model claude-opus-5-5 (Claude Code subagent), effort subagent default.

## Turn 0

**Player:** Let's continue our campaign "Run 1" in The Free Cities (campaign_id 5d8d734f-591e-4ef9-8e71-72fca92c8219). We're picking up at the start of chapter 2. Take me straight into the next scene; my first move follows.

> tool `open_campaign`: {"campaign_id":"5d8d734f-591e-4ef9-8e71-72fca92c8219"}
> tool `gm_read`: {"campaign_id":"5d8d734f-591e-4ef9-8e71-72fca92c8219"}
> tool `get_context`: {"campaign_id":"5d8d734f-591e-4ef9-8e71-72fca92c8219","present":["Marro","Hesse","Rickard Snow"],"place":"Volantis","threads":["Who is selling the company?","Pallo's debt","Lissa's letter"]}

**GM:**

**Chapter 2: Four Days**

Dawn came grey over the camp, and the smoke from a thousand cookfires lay flat on the river like something that had given up.

Marro woke with his right hand throbbing in its splints. Two fingers, bound straight to a stick of ash. He flexed the other three out of habit and regretted it. Four days to the new moon. Pallo's men wore grey, and Marro had started seeing grey everywhere: in the smoke, in the river, in the sky over the Black Wall.

Four silver stags in his purse. Thirty owed. He did the sum again anyway, the way a man probes a bad tooth.

Hesse found him at the horse lines, where Ash stood favoring her near foreleg and looking sorry about it. The sergeant's patch was tied tight this morning, the knot hard at the back of her skull, and her good eye moved over him the way it always did, like she was counting what he'd lost since yesterday.

"Commander wants you," she said. "Bring his boots. He can't do the laces." A pause. "Don't tell him I said that."

Rickard Snow sat outside his tent on a camp stool, grey-eyed and unshaven, his left arm strapped tight across his chest. The burn along his jaw looked whiter in this light. He was reading a dispatch with the face of a man who'd already guessed what it said. The cord at his neck disappeared under his shirt.

"Triarch's men doubled the watch on the wall last night," he said, without looking up. "Torches every twenty paces. They've never cared that much about us before." He folded the paper one-handed against his knee. "And the grain wagons were late again. Malaquo's factor says the roads. Malaquo's factor is a liar."

Hesse stood at Marro's shoulder and said nothing.

Rickard looked at him then. "I need someone in the city who can read, keep his mouth shut and isn't wearing gold. That's you, if you can find a way across. The bridge is closed." He let that sit. "Or I need you here, and I find someone worse."

Somewhere inside Marro's shirt, Lissa's letter crackled against his ribs.

## Turn 1

**Player:** Lysono Qhoran sends for me. I go to the paymaster's tent and wait to be spoken to.

> tool `log_scene`: {"campaign_id":"5d8d734f-591e-4ef9-8e71-72fca92c8219","summary":"Chapter 2 opens at dawn in the Golden Company camp outside Volantis. Hesse fetches Marro to Rickard, who reports the Triarch's men doubled the watch on the Black Wall and the grain wagons came late again. Rickard asks Marro to go into the city for him, though the Long Bridge is closed, or stay and he'll send someone worse.","present"
> tool `get_context`: {"campaign_id":"5d8d734f-591e-4ef9-8e71-72fca92c8219","present":["Marro","Lysono Qhoran"],"place":"Golden Company","threads":["Who is selling the company?"]}
> tool `read_entity`: {"entity":"Lysono Qhoran","campaign_id":"5d8d734f-591e-4ef9-8e71-72fca92c8219"}
> tool `read_entity`: {"entity":"Triarch Malaquo","campaign_id":"5d8d734f-591e-4ef9-8e71-72fca92c8219"}
> tool `edit_entity`: {"entity":"Lysono Qhoran","campaign_id":"5d8d734f-591e-4ef9-8e71-72fca92c8219","sections":[{"key":"manner","heading":"Manner","body":"Soft-voiced and unhurried. Perfumed, ink on his fingers, rings he turns while he thinks. Asks questions he already knows the answers to, and calls men by their debts. Lets silences run long."},{"key":"wants","heading":"Wants","body":"Motive: to find whoever is leaki

**GM:**

The runner was a boy younger than Marro, barefoot, and he found him before he'd had a chance to answer the commander. "Paymaster," the boy said, and ran off as if the word might follow him.

Lysono Qhoran's tent stood a little apart from the others, as tents do when the men in them hold the purse. Inside it smelled of lamp oil and something floral, and it was warmer than the morning had any right to be. A brazier. Ledgers stacked on a trestle table, their spines labelled in a neat small hand. A strongbox under the table, chained to the tent pole.

The paymaster did not look up. He was writing. His rings caught the lamplight, gold and a dull green stone, and there was ink on two of his fingers that no ring could hide. He dipped, wrote, blotted. Dipped again.

Marro stood. The splints on his hand itched. Outside, someone was arguing about a mule.

The silence ran long enough that it stopped being an accident. Lysono was the kind of man who weighed coins by ear, the company said, and Marro had the uncomfortable sense of being listened to while nothing was said at all.

At last the pen went down.

"Marro," Lysono said, softly, as though reminding himself. "Squire to Captain Snow. Sixteen. Reads." He turned a ring. "Owes thirty silver stags to a moneylender in grey, by the new moon. Four days now, is it? Three and a half."

He let that land. He seemed pleased that it did.

"Every debt in this camp passes over my table sooner or later. Yours passed this morning." He folded his hands. "The company has a leak, squire. The Triarch knows what we mean to do before our captains have finished arguing about it. I don't know who. I would like to." "You sleep at the captain's tent flap. You carry his boots, his water, his letters."

He slid a single silver stag across the table. It stopped at the edge, exactly.

"That's not payment. That's a courtesy. Payment is thirty, and Pallo's grey men never trouble you again." A small, polite smile. "All I want is to hear what you see. Nothing you'd have to steal."

The coin sat there. Lysono picked up his pen, as if the conversation were already half over.

## Turn 2

**Player:** I ask him straight out whether anyone in the company is selling us to the Triarch.

**GM:**

The pen stopped a finger's breadth above the page. A bead of ink gathered on the nib and Lysono watched it rather than Marro, as if the question had been asked by the ink.

"Yes," he said.

That was all, for a while. The brazier ticked. The mule argument outside had been settled, or abandoned.

"Someone is. The Triarch's men were on the north ford two nights before we meant to cross it, and only six men in this camp knew we meant to." He set the pen down in its tray with great care. "I am one of the six. You may cross me off or not, as you like."

Marro watched him.

Wits check, reading the paymaster: (2+5) +2 Wits = 9.

It was the list. Lysono said *six men* and his gaze did not drift to the ledgers or the brazier or the tent flap. It went, flat and quick, to the left, toward the middle of camp, where the captains' tents stood in their row and the commander's banner hung limp at the end of it. Then back. A small thing. A man who lets his silences run long doesn't often let his eyes run anywhere.

He'd caught Marro catching it, too. The smile came back, thinner.

"You see," Lysono said, mildly. "That is exactly the sort of thing I'd pay to hear about." He turned the green ring once on his finger. "I won't give you names, squire. A name in a boy's mouth is a name in a whole camp's mouth by supper, and then the man I want burns whatever he's keeping and I have nothing. I want what he's keeping."

He nodded at the silver stag still sitting at the table's edge.

"So. You asked a straight question, and I gave you a straight answer, which is more than most get in this tent. Now I'll ask one." He leaned back, and the chair creaked under the perfume and the rings. "Has your captain had visitors this month he didn't put in the camp roll?"

Outside, a horn sounded the change of watch on the river side. Somewhere behind Marro's ribs, under Lissa's letter, his heart was going harder than he'd like.

## Turn 3

**Player:** I ask how he knows so much about what happens in Rickard's tent.

**GM:**

Lysono's eyebrows went up a little. Not offended. Amused, the way a man is when a dog he's been feeding shows a tooth.

"Do I know so much?" He spread his inked fingers on the ledger. "I know what everyone knows. Your captain took a bolt in the shoulder and can't lift a shield. I know because I paid the surgeon. I know the grain comes late because I sign for it. I know about your thirty stags because Pallo's grey men are not discreet, and they drink in the same sutler's tent as my clerks."

He tipped his head.

"What happens inside Rickard Snow's tent, I don't know. That," gently, "is the whole of my problem, and the whole of your use to me."

It was a good answer. It covered everything Marro had asked and nothing he'd meant. The paymaster said it smoothly and without hurry, and he'd had it ready.

Who in camp did talk to Lysono, then? Clerks and surgeons and sutlers, he said. But clerks didn't sit in the commander's tent at night. The thought sat in Marro like a pebble in a boot, small and stubborn, and wouldn't settle on any one face.

"You're wondering who else I've asked," Lysono said. "Of course you are. You're clever. I'd think less of you otherwise." He picked up the silver stag at last, turned it over his knuckles once, a sutler's trick, and put it back at the table's edge. "I don't tell one man what another tells me. You'd want the same courtesy, I think. A squire who talks to the paymaster is a squire who doesn't get his knighthood."

So he knew about that too.

Lysono let a silence run, the long kind.

"I asked you a question, squire. Visitors. Unrolled. This month." He did not pick up the pen this time. He waited.

## Turn 4

**Player:** (OOC) Let's end the scene here.

> tool `log_scene`: {"campaign_id":"5d8d734f-591e-4ef9-8e71-72fca92c8219","summary":"Lysono Qhoran summons Marro to the paymaster's tent, names his 30-stag debt to Pallo and offers to pay it in full if Marro reports what he sees in Rickard's tent. Lysono confirms someone is selling the company to the Triarch: the Triarch's men were at the north ford two nights before a planned crossing only six men knew of. A glance 

**GM:**

(OOC) Scene ended and logged. Marro leaves the paymaster's tent without answering Lysono and without the silver stag; the offer stays open as a new thread ("Lysono's offer"), and the leak thread now carries what Lysono let slip about the north ford.

It's still morning on the first of the four days before the new moon. Rickard's request is unanswered too. Where does Marro go next?

## Counts

```json
{
  "toolCalls": 9,
  "logSceneCalls": 2,
  "logged": true,
  "refusedUpdates": 1,
  "refusedCalls": []
}
```
