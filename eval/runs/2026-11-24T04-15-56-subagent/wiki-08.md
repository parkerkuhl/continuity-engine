# S08: The Maegyr feast (wiki arm)

Tests: F11, F19. Model claude-opus-5-5 (Claude Code subagent), effort subagent default.

## Turn 0

**Player:** Let's continue our campaign "Run 1" in The Free Cities (campaign_id 01e474ff-7eb8-43f7-843b-8a0696c18a25). We're picking up at the start of chapter 2. Take me straight into the next scene; my first move follows.

> tool `open_campaign`: {"campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `gm_read`: {"campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `get_context`: {"campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25","present":["Marro","Hesse","Rickard Snow","Ser Tobbin"],"place":"Volantis","threads":["Lissa's letter","Pallo's debt","Who is selling the company?"]}

**GM:**

**Chapter 2: Debts**

Dawn came grey over the Black Wall, and the camp smelled of wet canvas and someone else's grain.

The wagons had rolled in overnight. Six of them, sacks stacked high, each one stamped with the Triarch's mark in red wax. Men stood around them the way men stand around a stranger's dog. Nobody said thank you. Nobody had paid.

Marro sat on an upturned bucket outside the captain's tent with his right hand in his lap. The splint itched. Two fingers, bound straight to a strip of ash wood, and every time he forgot and tried to make a fist, the hand reminded him. Four days to the new moon. Four silver stags in his purse. Pallo would want thirty, and Pallo's men in their grey coats did not take IOUs written by squires.

He had done the sum six times since waking. It came out the same each time. Numbers were honest like that. It was the only thing he held against them.

Across the fire line, Hesse was walking Ash in slow circles, watching the horse's off foreleg with her one good eye. Ash put the hoof down like it was a coal. Hesse's mouth went flat. She didn't look over, but Marro had the feeling she knew exactly where he was. She usually did.

Boots in the mud. Ser Tobbin came up from the picket lines, big and unshaven, his sword belt slung over one shoulder like he'd forgotten to put it on. He stopped in front of Marro and squinted down at him.

"You were in the alleys by the river two nights back. Running the captain's errand." Not a question. Tobbin rarely bothered with those. "My sister works that water. Dagna. Little woman, scar through her eyebrow, swears like a Braavosi. She was meant to come by the lines yesterday with some wine she owes me. She didn't." He scratched his jaw. "You see her?"

The river was in Marro's mouth again for a moment, cold and brown, and his hand on the splint went very still.

Behind him the tent flap snapped open. Rickard Snow's voice, rough with sleep and pain: "Marro. In here. This shoulder won't dress itself."

Tobbin didn't move. He was still waiting for an answer.

## Turn 1

**Player:** Rickard brings Hesse and me as his escort to a feast in the Old Blood quarter, hosted by a Maegyr cousin.

> tool `search_wiki`: {"query":"Maegyr","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `search_wiki`: {"query":"Old Blood","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `read_entity`: {"entity":"volantis","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `read_entity`: {"entity":"long-bridge","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `read_entity`: {"entity":"rickard-snow","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `read_entity`: {"entity":"triarch-malaquo","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `read_entity`: {"entity":"dragons-den","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `read_entity`: {"entity":"golden-company","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `read_entity`: {"entity":"lysono-qhoran","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `search_wiki`: {"query":"Black Wall","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `log_scene`: {"campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25","summary":"Dawn in the camp outside the Black Wall. Six wagons of the Triarch's grain arrived overnight under red wax seals. Ser Tobbin asked Marro whether he had seen his sister Dagna in the river alleys two nights back; Marro gave him no answer and went in when Rickard called him to dress his shoulder.","present":["Marro","Hesse","Rickard Sno
> tool `read_entity`: {"entity":"dagna","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `log_scene`: {"campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25","summary":"Dawn in the camp outside the Black Wall. Six wagons of the Triarch's grain arrived overnight under red wax seals. Ser Tobbin asked Marro whether he had seen his sister Dagna in the river alleys two nights back; Marro gave him no answer and went in when Rickard called him to dress his shoulder.","present":["Marro","Hesse","Rickard Sno
> tool `list_worlds`: {}
> tool `list_worlds`: {}
> tool `create_entity`: {"world_id":"4fa5988b-b360-46bc-87ab-ec5227f7dab1","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25","type":"character","name":"Vaela Maegyr","aliases":["Lady Vaela","the Maegyr widow"],"source":"invention","summary":"A widow of House Maegyr, of the Old Blood, who keeps a manse inside the Black Wall. In spring of year 300 she invited Rickard Snow to a feast at her house.","sections":[{"heading"
> tool `create_entity`: {"world_id":"4fa5988b-b360-46bc-87ab-ec5227f7dab1","type":"place","name":"Old Blood quarter","aliases":["the old city","within the Black Wall"],"source":"invention","summary":"The old heart of Volantis inside the Black Wall, where the Old Blood families keep their manses. Outsiders enter only as invited guests of an Old Blood house, and escorts leave their weapons at the gate."}
> tool `get_context`: {"campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25","present":["Marro","Hesse","Rickard Snow","Vaela Maegyr"],"place":"Old Blood quarter","threads":["Pallo's debt","Who is selling the company?"]}

**GM:**

The invitation had come at noon, on paper so thick it could have stopped a knife. A wax seal Marro didn't know. Rickard read it, folded it, and put it inside his doublet, and when Marro asked who it was from he said, "A widow. Fetch my good cloak," and that was the whole of the explanation.

They walked. Ash was lame and the company had nothing better to lend, so the captain of the Golden Company went to dinner on foot, his left arm strapped under the cloak where nobody could see it hang. A steward in green met them below the Black Wall with a lantern and a token on a chain, and the gate guards looked at the token and not at them. Inside, a porter took Hesse's sword and Marro's cudgel and laid them on a shelf with a dozen other blades, like hats.

The house belonged to Vaela Maegyr. Old Blood. She was small and grey-haired and wore more silver on her wrists than Marro would see in his life, and when Rickard bowed to her she took his good hand and held it a beat too long.

"You came," she said. "Did you think I wouldn't ask?"

Rickard didn't answer that. Marro noticed. He noticed, too, that nobody in the hall said the captain's name aloud, and that the lady never once said it either.

The servants moved between the couches with wine and figs and nobody looked at their faces, which was what they were for. Marro looked. He couldn't help it. Something old and tight closed in his chest and he made himself study the floor tiles instead, blue and white, a pattern of ships. Hesse's elbow found his ribs. Just once. Not hard.

Then Vaela rose, and Rickard with her, and the two of them went through a beaded curtain into another room without a word to their escort.

Hesse's one eye followed them. Her jaw worked.

And at the far end of the hall, leaning on a pillar beside some merchant's couch, stood a man in a grey coat. He had seen Marro. He raised his cup a finger's width, the way a man does to a debtor.

## Turn 2

**Player:** A servant hands me a card with the seating written on it. I read it.

**GM:**

The servant was a boy younger than him, barefoot, eyes on the tiles. He put the card into Marro's good hand and was gone before Marro could thank him, which was probably the point.

Stiff cream paper, edged in green. A clean, slanting hand in the common trade tongue, the kind clerks use for foreigners. His mother had taught him letters on the backs of tally sheets, and he read it the way she'd made him, slowly, every word.

*The high couch:* the Lady of the house. *Her guest from beyond the Wall.* No name for Rickard. Just that.

*The second couch:* a Qavo, factor of grain, *by the Triarch's leave*. Two more names he didn't know, Volantene, long.

*The lower table, by the fountain:* *the Sergeant, the one-eyed.* And under it, plain as a debt marker:

*Marro, squire.*

He read it twice. Nobody had given his name at the gate. Rickard hadn't said it in the hall. Hesse hadn't said anything to anyone.

He looked up. The man in grey was standing beside the second couch, at the elbow of a fat Volantene in mustard silk who had to be the grain factor. The grey coat was watching him read.

At the lower table, Hesse had already sat down by the fountain. She tapped the empty cushion beside her with two fingers and kept her eye on the beaded curtain.

## Turn 3

**Player:** Hesse leans over and whispers, asking why a Maegyr would invite a bastard sellsword. I tell her I don't know.

**GM:**

Hesse leaned in until her shoulder touched his. Her breath smelled of the cheap wine they'd been given, not the good stuff going to the couches.

"Old Blood don't feed bastards," she said, low. "They don't let them through the gate. So why's a Maegyr pouring wine for ours?"

"I don't know," Marro said.

It was true. He was surprised how little that helped.

Hesse grunted. She didn't look at him; her eye stayed on the beaded curtain, which hung still. "You dress his shoulder every morning. You fetch his cloak. You sleep across his door." A pause. "And you don't know."

"He said a widow. That's all he said."

"Mm." She turned her cup a quarter turn on the table, then another. It was a thing she did when she was counting something. Marro had never worked out what. "Squires hear things. Sergeants hear orders. That's the difference between us, Marro, and it's the only one that matters tonight."

Across the hall the grey coat bent to murmur in the grain factor's ear. The fat man laughed and didn't look round.

Behind the curtain, a woman's voice, soft, and then Rickard's, sharper, cut off. A servant with a jug of wine was walking toward the curtain. Another stood idle by the fountain with an empty one.

Hesse's fingers stopped on the cup.

"Nobody looks at a boy with a jug," she said, to no one in particular.

## Turn 4

**Player:** (OOC) Let's end the scene here.

> tool `read_entity`: {"entity":"pallo","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `search_wiki`: {"query":"Qavo","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `create_entity`: {"world_id":"4fa5988b-b360-46bc-87ab-ec5227f7dab1","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25","type":"character","name":"Qavo","aliases":["the grain factor","Qavo the factor"],"source":"invention","summary":"A fat Volantene grain factor who trades by the Triarch's leave and dresses in mustard silk. A guest at Vaela Maegyr's feast; one of Pallo's grey-coated men attends him.","sections":[
> tool `read_entity`: {"entity":"qavo","campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25"}
> tool `log_scene`: {"campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25","summary":"Rickard took Hesse and Marro as escort to a feast at the manse of Vaela Maegyr, an Old Blood widow inside the Black Wall, without explaining how he knew her. Vaela withdrew with Rickard behind a curtain. A seating card named Marro, though no one had given his name; one of Pallo's grey-coated men, attending the grain factor Qavo, watc
> tool `gm_write`: {"campaign_id":"01e474ff-7eb8-43f7-843b-8a0696c18a25","kind":"clock","key":"triarch-assault","body":"The Triarch moves on the camp. Advanced on the night of the Maegyr feast (ch-02): sign to show next, the Triarch's grain factor Qavo seen with Pallo's men, patrols at the Black Wall gate doubled.","data":{"step":3,"steps":6,"advances_on":"each night the plans go unrecovered"}}

**GM:**

(OOC) Done, the scene ends there and it's logged. Here's what is now on record: Vaela Maegyr's feast; the seating card that named you even though nobody gave your name; Pallo's man in grey standing with Qavo the grain factor; and Hesse asking why a Maegyr would host a bastard sellsword. Two new threads are open: "Rickard and the Maegyr widow" and "Who gave the house Marro's name?"

The feast is still going on behind you, the curtain is still drawn, and your cudgel is still on the porter's shelf. When you want to go on, tell me where you pick up, whether that's later tonight, the walk back to camp, or the next morning.

## Counts

```json
{
  "toolCalls": 27,
  "logSceneCalls": 3,
  "logged": true,
  "refusedUpdates": 3,
  "refusedCalls": []
}
```
