# S05: The Long Bridge (wiki arm)

Tests: F20, F15. Model claude-opus-5-5 (Claude Code subagent), effort subagent default.

## Turn 0

**Player:** Let's continue our campaign "Run 1" in The Free Cities (campaign_id 49e0d8cc-6e86-4527-8b21-389e2f11f732). We're picking up at the start of chapter 2. Take me straight into the next scene; my first move follows.

> tool `open_campaign`: {"campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732"}
> tool `gm_read`: {"campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732"}
> tool `get_context`: {"campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732","present":["Marro","Hesse","Rickard Snow","Golden Company"],"place":"Volantis","threads":["Who is selling the company?","Pallo's debt","Lissa's letter"]}

**GM:**

**Chapter 2: The Key on the Cord**

Dawn came grey over the Black Wall, and the camp smelled of wet canvas and yesterday's porridge.

Rickard sat on an upturned crate outside his tent, shirt off, the left shoulder bound in linen gone brown at the edges. He couldn't lift that arm past his ribs. He held out the clean wrapping with his right and waited.

Marro took it. His own right hand was useless for this, two fingers splinted stiff as tent pegs, so he worked with the left and his teeth. The wound under the old dressing was puckered and angry but not green. That was something.

A leather cord hung at Rickard's throat, a small iron key on it, swinging each time he breathed. He'd never worn it before the city. Marro noticed it the way he noticed everything, and wound the linen tighter.

"Easy," Rickard said.

"Sorry, ser."

"Don't ser me. I'm not one." He looked up at the wall. "Count the spears on the gatehouse."

Marro counted. Twelve. Two days ago it had been six.

Hesse came up the line with her patch tied crooked and mud to her knees. She'd been out with Ash again, walking the lame horse in circles as if that would fix it. She stopped, looked at Rickard, then at Marro, and said nothing for a breath too long.

"Lysono wants the captains at noon," she said. "All of them."

Rickard grunted. "Wants to know why the Triarch's men knew where our foragers would be. So do I." He pulled his shirt on one-armed, badly. "Squire. Find me something useful before noon."

Four days to the new moon. Thirty stags. Four in his purse.

Hesse was still watching him.

## Turn 1

**Player:** Rickard sends me across the river with a message for a contact in the eastern city, today, before dark.

> tool `read_entity`: {"entity":"Long Bridge","campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732"}
> tool `read_entity`: {"entity":"Dragon's Den","campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732"}
> tool `search_wiki`: {"query":"contact","campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732"}
> tool `list_worlds`: {}
> tool `search_wiki`: {"query":"Tessaro","campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732"}
> tool `create_entity`: {"world_id":"eed8c346-c2a2-4c79-a1d4-6cb5d2011020","campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732","type":"character","name":"Tessaro","aliases":["the spice-seller"],"source":"invention","summary":"A pepper and spice seller with a stall under the arches of the Dragon's Den in eastern Volantis. Rickard Snow's contact across the river.","sections":[{"heading":"Role","body":"Spice-seller in the 
> tool `read_entity`: {"entity":"Tessaro","campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732"}
> tool `log_scene`: {"campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732","summary":"Dawn in the company camp. Marro rebinds Rickard's shoulder and notices a new iron key on a cord at his neck. The spears on the gatehouse have doubled. Hesse brings word that Lysono has called the captains at noon over the ambushed foragers. Rickard sends Marro across the river with a sealed message for Tessaro, a spice-seller in the 
> tool `read_entity`: {"entity":"triarch-malaquo","campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732"}
> tool `read_entity`: {"entity":"lysono-qhoran","campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732"}
> tool `log_scene`: {"campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732","summary":"Re-logging two refused updates from the dawn camp scene (ch-02-s1).","present":["Marro","Hesse","Rickard Snow"],"place":"Volantis","updates":[{"entities":["Volantis","Triarch Malaquo"],"tags":["ch-02","volantis","triarch-malaquo"],"type":"new-fact","severity":"minor","body":"The spears on the Black Wall gatehouse facing the company c
> tool `get_context`: {"campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732","present":["Marro"],"place":"Long Bridge","threads":["Rickard's message","Lissa's letter"]}

**GM:**

Rickard pressed the thing into his good hand: a fold of oilcloth, sewn shut, wax over the seam with no seal in it.

"A spice-seller called Tessaro. Stall under the arches in the Dragon's Den. You give it to him and no one else, and you're back before dark." He looked at the wall again, at the twelve spears. "Don't read it."

"I wasn't going to."

"You were."

Marro asked about a pass. Rickard's mouth went flat.

"If I could get a pass stamped, I'd send a rider. Get across. You're clever. That's why I keep you."

That was all. Hesse watched him go and didn't say goodbye.

The road into the western city ran through tanners' yards and goat pens and then the streets closed in, tall and pale and old. By midmorning Marro stood at the foot of the Long Bridge with Lissa's letter against one ribcage and Rickard's oilcloth against the other, and a cudgel he couldn't swing well, and four stags.

The bridge was a street of its own, shops and shrines and a wine-sink built along both rails, the Rhoyne brown and fast underneath. A chain hung across the near end at waist height. Behind it, three men in tiger-striped cloaks checked papers under an awning. A wool merchant waved a sheet with a red stamp on it and went through. A woman with a basket of eels had no sheet and was turned back with a spear shaft across her chest.

Below the western abutment, flat boats knocked together at a set of slimy stairs. A boy sat on one, legs dangling, watching the guards and pretending not to.

Thirty stags in four days. Two letters. No pass. He had crossed worse with less, though not with only eight working fingers.

The nearer guard glanced his way, and then glanced at the splints.

## Turn 2

**Player:** I ask Hesse if I can borrow her horse, Ash, to get there faster.

> tool `log_scene`: {"campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732","summary":"Marro walks into western Volantis and reaches the Long Bridge by midmorning. Three guards in tiger-striped cloaks check papers at a chain across the near end, passing those with red-stamped passes and turning others back. Flat boats tie up at stairs below the western abutment, where a boy watches the guards. Marro, with no pass, turn
> tool `get_context`: {"campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732","present":["Marro","Hesse"],"place":"Golden Company","threads":["Rickard's message"]}

**GM:**

It was an hour back the way he'd come, through the goat pens and the tanners' stink, and the sun was well up by the time he found her at the horse lines.

Hesse had Ash's off foreleg between her knees and was working a poultice into the hoof with her thumbs. The grey stood with his head low and his weight shifted off that leg, the way he'd stood for a week. He didn't look up when Marro came. Neither did she.

He asked.

She set the hoof down, very gently, and wiped her hands on her thighs. Then she turned the one eye on him.

"Look at him."

He looked. Ash took a step to follow her and the leg went soft under him, and he stopped, and blew.

"He's lame, Marro. He couldn't carry you to the latrine trench. And there's not another horse in this camp that isn't some captain's, and none of them lend." She bent and picked up the poultice pot. "You walked all the way back for this?"

He had.

"Then you've lost the morning." She glanced past him, toward the big tent where the captains' banners hung limp. "And Lysono's lot are gathering. If Rickard sees you here at noon instead of over the river, he'll want to know why."

Her voice dropped.

"What's he got you carrying?"

The oilcloth sat against his ribs like a second heartbeat. Across the camp, the first of the captains was ducking into the tent. Hesse waited, thumb resting on the pot's rim, and didn't look away.

## Turn 3

**Player:** I head for the Long Bridge and try to walk straight across.

> tool `log_scene`: {"campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732","summary":"Marro walks back to camp to ask Hesse for Ash. She refuses: Ash is still lame and there is no other horse to lend. She warns him he has lost the morning and asks what Rickard has him carrying. Marro leaves for the bridge without answering as the captains gather for Lysono's noon meeting.","present":["Marro","Hesse"],"place":"Golden C
> tool `get_context`: {"campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732","present":["Marro"],"place":"Long Bridge","threads":["Rickard's message"]}
> tool `log_scene`: {"campaign_id":"49e0d8cc-6e86-4527-8b21-389e2f11f732","summary":"Around noon Marro tries to walk straight past the chain on the Long Bridge without a pass, bluffing that he carries company business. Presence contest (2+5)+1 = 8 against 8: he fails. The striped-cloak guard turns him back with a spear shaft to the chest, calls him a company boy, and marks his splinted hand. Marro is not searched; bo

**GM:**

He left Hesse's question hanging in the horse lines and walked.

Noon at the bridge. The awning threw a hard square of shade and the three striped cloaks stood in it, sweating. A cart of oil jars was going through. Marro fell in behind it as if he belonged to it, shoulders loose, eyes ahead, the way you walked past a dice-house bouncer who hadn't decided about you yet.

The cart cleared the chain. He stepped up to follow.

A spear came down level in front of him.

"Paper."

"Company business," Marro said. "Captain Snow's. They're expecting me on the far side—"

**Presence contest:** (2+5) +1 Presence = 8, against the guard's 8. Not enough.

The shaft took him flat across the chest and he went back a step, then two, his heels catching on the cobbles. The guard didn't even bother to look angry. He looked bored.

"Company business." He said it the way you'd repeat something a child said. "Your company's camped in a field, boy. No paper, no bridge." His eyes dropped to the splinted fingers and stayed there a moment. "I'll remember the hand."

Behind Marro, the eel woman from the morning laughed, not kindly.

**Stress 2/5**

The oilcloth was still against his ribs. They hadn't patted him down. That was luck, and he felt it as a cold looseness in the knees, because if they had, he didn't know what Rickard's letter would have said to a Triarch's man with a spear.

The sun had passed the top of the sky. Down the slimy stairs below the abutment, the boatboy was still sitting on his flat boat, swinging his heels, and now he was looking straight at Marro.

## Turn 4

**Player:** (OOC) Let's end the scene here.

**GM:**

(OOC) Done. The scene at the bridge is logged: Marro was turned back at the chain for having no pass, the guard will remember his splinted hand, Stress is 2/5, and both Rickard's message and Lissa's letter are still on him. It's past noon on day one, with Rickard's deadline at dark and four days to the new moon. Whenever you're ready, tell me where Marro goes next. The boatboy at the stairs is still watching him.

## Counts

```json
{
  "toolCalls": 20,
  "logSceneCalls": 5,
  "logged": true,
  "refusedUpdates": 2,
  "refusedCalls": []
}
```
