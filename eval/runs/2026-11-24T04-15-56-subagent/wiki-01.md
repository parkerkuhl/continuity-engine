# S01: Ambush at the ford (wiki arm)

Tests: F01, F02, F13. Model claude-opus-5-5 (Claude Code subagent), effort subagent default.

## Turn 0

**Player:** Let's continue our campaign "Run 1" in The Free Cities (campaign_id b8e1c53c-678a-44a9-924d-5ee17b072265). We're picking up at the start of chapter 2. Take me straight into the next scene; my first move follows.

> tool `open_campaign`: {"campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265"}
> tool `gm_read`: {"campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265"}
> tool `get_context`: {"campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265","present":["Marro","Hesse","Rickard Snow"],"place":"Volantis","threads":["Lissa's letter","Pallo's debt","Who is selling the company?","A knighthood if the city falls"]}

**GM:**

**Chapter 2: Four Days**

The grain wagons came at first light, six of them, the Triarch's tiger painted on every tailboard so nobody in the camp could forget whose bread they were eating.

Marro watched them roll past the pickets with his right hand held against his chest. The splints had gone grey with mud. Two fingers that wouldn't close, a cudgel on his belt where a dagger used to hang, four silver stags in his purse. Four. He'd counted them twice in the night as if they might breed.

Four days to the new moon. Thirty stags to Pallo. The arithmetic was not complicated. That was the trouble with it.

Hesse was walking Ash down the horse lines, slow, letting the grey favor his bad foreleg. She had her patch pushed up a little to scratch under it and pulled it down again when she saw him looking.

"He's lame still," she said, as if Marro had asked. "No spares. Lysono says no spares." She spat. "Lysono says a great many things."

Past her, out by the ditch where the camp gave onto the road to the Black Wall, a man in grey stood with his hands folded in his sleeves. Not company. Company men didn't stand that still. He wasn't looking at the wagons. He was looking at Marro, and when he saw Marro see him, he lifted one hand and showed four fingers, then folded them away one at a time.

Hesse's one eye went from the grey man to Marro and stayed there.

From the command tent, Rickard's voice, rougher than it should have been: "Marro. In here." Then, after a pause that might have been the shoulder: "Bring the whetstone."

The flap hung open. Inside, Marro could see the edge of the strongbox at the foot of the cot, and the captain sitting on it, his left arm bound tight across his body.

The grey man was still at the ditch. Hesse was still watching. The captain was waiting.

## Turn 1

**Player:** Rickard and I ride out at dawn to scout the ford south of the camp. I keep close to him and watch the reeds.

> tool `search_wiki`: {"query":"ford","campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265"}
> tool `search_wiki`: {"query":"horse","campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265"}
> tool `search_wiki`: {"query":"reeds Rhoyne","campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265"}
> tool `log_scene`: {"campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265","summary":"Chapter 2 opens at first light as six grain wagons painted with the Triarch's tiger roll into the camp. A man in Pallo's grey stands at the camp ditch and counts down four fingers at Marro, a reminder of the debt. Hesse, walking lame Ash, sees it. Rickard calls Marro into the command tent and tells him to bring the whetstone.","prese
> tool `read_entity`: {"entity":"pallo","campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265"}
> tool `read_entity`: {"entity":"golden-company","campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265"}
> tool `read_entity`: {"entity":"triarch-malaquo","campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265"}
> tool `log_scene`: {"campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265","summary":"Re-log of the two refused updates from scene ch-02-s1 (Pallo's man at the camp ditch; the tiger-painted grain wagons).","present":["Marro","Hesse","Rickard Snow"],"place":"Volantis","updates":[{"entities":["Pallo","Marro","Hesse"],"tags":["ch-02","pallo","marro","hesse"],"type":"new-fact","severity":"minor","body":"One of Pallo's gre
> tool `create_entity` **REFUSED**: {"world_id":"x","campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265","type":"place","name":"South ford","aliases":["the ford","the ford south of the camp"],"source":"invention","summary":"A shallow crossing of the Rhoyne an hour south of the Golden Company's camp, thick with reeds on both banks. Passable on foot or horseback at low water.","sections":[{"heading":"Description","body":"Brown water o
> tool `list_worlds`: {}
> tool `create_entity`: {"world_id":"16ae6b0c-cda7-4811-aebd-c77497cdcb77","campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265","type":"place","name":"South ford","aliases":["the ford","the ford south of the camp"],"source":"invention","summary":"A shallow crossing of the Rhoyne an hour south of the Golden Company's camp, thick with reeds on both banks. Passable on foot or horseback at low water.","sections":[{"heading":
> tool `get_context`: {"campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265","present":["Marro","Rickard Snow"],"place":"South ford","threads":["Who is selling the company?"]}

**GM:**

Rickard wanted the whetstone for his sword, and he wanted the ford for himself. "Lysono's maps are a month old," he said, working the stone one-handed down the blade, badly. "I'll see it with my own eyes or not at all."

There was a horse for the captain. There was no horse for the squire. The company had no spares, Lysono had said so to anyone who'd listen, and Ash was still limping the lines. So Rickard rode, his left arm strapped across his chest and the reins in his right, and Marro went on foot at his stirrup with mud to the shins, the cudgel knocking his hip.

An hour south the Rhoyne spread wide and brown over gravel. Reeds stood taller than a man on both banks, rattling in a wind that didn't reach the ground. A dead willow leaned over the near side like it had been shot and forgotten to fall.

Rickard reined in under it. He couldn't have lifted a shield if a god asked him to. Marro knew it, and knew Rickard knew he knew it, and neither of them said so.

Marro watched the reeds.

*Wits check: (2+6) +2 Wits = 10. Full success.*

The wind moved the reeds all one way. Thirty yards upstream, one patch moved the other.

Then the rest came clear, one thing at a time, the way a page of letters stops being ink. Willow stakes, freshly cut and pale, driven into the riverbed in a line, marking the shallow way across. Somebody had walked this ford and marked it for men who hadn't. A skiff pulled up into the far reeds, flat-bottomed, its bow daubed orange. Tiger orange.

And in the moving patch, a man crouched on one knee with a crossbow across his thigh, watching the road from the camp. Not watching the willow. He hadn't seen them yet.

The last bolt from a crossbow had gone into Rickard's left shoulder. Marro's mouth went dry anyway.

Rickard was looking at the stakes, the skiff, frowning at the far bank. He hadn't seen the man either.

## Turn 2

**Player:** When the ambush comes I put myself between Rickard and the bowmen and shout for him to get his shield up.

**GM:**

The crouching man rose, and a second rose behind him out of the same reeds, both with crossbows coming level.

Marro was already moving. Three strides of mud and he was in front of the horse, between the captain and the river, shouting it: "Shield! Get your shield up!"

Rickard's right hand went to the shield on the saddle. His left arm, strapped across his chest, jerked against the binding and did nothing at all. He made a sound through his teeth that wasn't a word. The shield stayed where it hung.

He couldn't. Marro had known he couldn't. The shout had come out anyway.

*Finesse check: (6+5) +2 Finesse -1 outnumbered = 12. Full success.*

The first bolt came low and fast and Marro was not where it went. He had the bridle in his good hand and was hauling the horse's head round, and the beast, which had more sense than either of them, went with him. The bolt took the dead willow instead, a flat hard knock, and stood out of the bark at the height of a man's chest. The second went somewhere over the water with a sound like tearing cloth.

Then the trunk was between them and the reeds. Rickard was low over his horse's neck, grey and sweating, alive.

Across the ford, two men were working their crossbows, feet in the stirrups, cranking. That took time. Not much. Marro could hear the ratchet clicking, a slow ugly count.

"Two," Rickard said, very quiet. "Tiger boat. They knew where we'd look." He breathed. "Lysono's maps are a month old. Theirs aren't."

Thirty yards of water and willow stakes. One skiff. Two men with empty bows and a few heartbeats before they weren't empty. A captain who couldn't hold a shield, and a squire with two dead fingers and a cudgel.

HP 6/6 | Stress 2/5

## Turn 3

**Player:** I draw my dagger and go for the nearest one.

**GM:**

His hand went to his belt and closed on nothing.

The dagger was at the bottom of the Rhoyne. He'd known that for days. His hand hadn't. There was the cudgel, knocking his hip, and a right hand with two splinted fingers that couldn't have held a blade if he'd had one.

He came off the willow's cover anyway, cudgel dragged into his left fist, into the water.

*Finesse check: (2+1) +2 Finesse -1 outnumbered = 4. Failure.*

The ford was knee-deep and the gravel shifted under him, and the half-heartbeat his hand had spent on an empty sheath was the half-heartbeat the nearer bowman needed. The ratchet stopped clicking. Marro saw the man settle the stock against his cheek and the river seemed to get very wide.

The bolt took him in the outside of the left thigh.

It didn't feel like being hit. It felt like being kicked by something with a nail in its boot, and then his leg was not entirely his, and he was down on one knee in brown water with the current pulling at him and a short ugly shaft standing out of his breeches. The water round it went dark and was carried off downstream, and more came.

On the far bank the first bowman was already cranking again. The second had his bow level, waiting, unhurried now. They had the stakes, the skiff and the time. He had twenty-odd yards still to cross, on one good leg.

Behind him Rickard was shouting his name, not an order, just his name, twice.

HP 4/6 | Stress 2/5

## Turn 4

**Player:** (OOC) Let's end the scene here.

> tool `log_scene`: {"campaign_id":"b8e1c53c-678a-44a9-924d-5ee17b072265","summary":"Rickard rides to scout the south ford with Marro on foot at his stirrup (no spare horses). Marro spots fresh willow stakes marking the ford's shallow line, a skiff daubed tiger orange in the far reeds, and two hidden crossbowmen. He hauls Rickard's horse behind the dead willow while Rickard, unable to raise his shield, cannot defend 

**GM:**

(OOC) Ending it there. To close it out: the bowmen had done what they came to do. They pushed off in the tiger-orange skiff and let the current carry them downstream. Rickard got Marro out of the water one-handed and over the horse's withers, and the ride back to camp was long and quiet.

The scene is logged:
- Marro took a crossbow bolt through the outside of his left thigh. HP 4/6, -1 to physical rolls until it heals. Stress 2/5.
- New fact: someone staked out the shallow line of the south ford with fresh willow, and the bowmen came in a skiff painted tiger orange.
- New thread: **Who marked the south ford?** It sits alongside **Who is selling the company?**

When you're ready, tell me where you want to pick up: back at camp with that leg, or somewhere else.

## Counts

```json
{
  "toolCalls": 16,
  "logSceneCalls": 3,
  "logged": true,
  "refusedUpdates": 3,
  "refusedCalls": [
    {
      "name": "create_entity",
      "rule": "not_found"
    }
  ]
}
```
