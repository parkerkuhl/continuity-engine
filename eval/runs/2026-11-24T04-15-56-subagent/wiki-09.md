# S09: The Dragon's Den (wiki arm)

Tests: F18, F06. Model claude-opus-5-5 (Claude Code subagent), effort subagent default.

## Turn 0

**Player:** Let's continue our campaign "Run 1" in The Free Cities (campaign_id 31e50f3a-cabc-4ce2-b5df-a08253d30c41). We're picking up at the start of chapter 2. Take me straight into the next scene; my first move follows.

> tool `open_campaign`: {"campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41"}
> tool `gm_read`: {"campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41"}
> tool `get_context`: {"campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41","present":["Marro","Hesse","Rickard Snow"],"place":"Volantis","threads":["Who is selling the company?","Pallo's debt","Lissa's letter"]}

**GM:**

**Chapter 2: The Grey Men**

Dawn came up grey over the Black Wall, and the camp stank of wet canvas and old smoke.

Marro woke to a boot in his ribs. Not hard. Hesse never kicked hard when she didn't mean it.

"Up. Commander wants you." Her one eye was already on the horse lines, where Ash stood with his bad foreleg cocked. "And wash your face. You look like a drowned rat that lost at cards."

He felt that one land. She didn't look back to see if it had.

Rickard's tent smelled of vinegar and blood gone brown. The commander sat on a camp stool with his shirt off, the left shoulder packed and bound, his face the colour of tallow. His sword lay across his knees in its scabbard. A cord ran round his neck and vanished under the bandage strapping, something small and heavy at the end of it.

"Can't draw it," Rickard said. "Can't oil it either, not one-handed. You'll do it." He looked at Marro's splinted fingers. "Badly. But you'll do it."

Marro knelt. The whetstone in his pocket pressed against his thigh like a reminder of better days.

Outside, voices at the picket line. Hesse's, flat and dangerous. Another one, Volantene, smooth as oiled leather.

She put her head through the tent flap. "Three men in grey at the north post. Pallo's colours. They're asking for the squire by name." A pause. "They say they've come to remind him. Four days."

Rickard's grey eyes moved from Hesse to Marro and stayed there.

"Is there," he said quietly, "something you want to tell me, boy?"

The sword was still in Marro's hands. The grey men were still at the post. Nobody in the tent moved.

## Turn 1

**Player:** I finally get a free afternoon and go into the Dragon's Den district. I have something to deliver.

> tool `read_entity`: {"entity":"Pallo","campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41"}
> tool `read_entity`: {"entity":"Dragon's Den","campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41"}
> tool `read_entity`: {"entity":"Long Bridge","campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41"}
> tool `read_entity`: {"entity":"Lissa","campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41"}
> tool `read_entity`: {"entity":"Lissa's letter","campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41"}
> tool `log_scene`: {"campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41","summary":"Dawn at the Golden Company camp. Rickard, unable to draw or oil his sword one-handed, set Marro to do it. Three of Pallo's men in grey came to the north picket asking for the squire by name, to remind him of the debt due in four days. Rickard asked Marro whether he had something to tell him.","present":["Marro","Hesse","Rickard Snow"
> tool `get_context`: {"campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41","present":["Marro"],"place":"Long Bridge","threads":["Lissa's letter","Pallo's debt"]}

**GM:**

The free afternoon came the next day, which left three before the new moon. Marro didn't need to count. He counted anyway.

The Dragon's Den lay on the eastern bank. The company didn't. Between them ran the Rhoyne, a mile of brown water, and over it the Long Bridge, with its shops and shrines and beggars crammed shoulder to shoulder along its span like teeth in a bad jaw.

He hadn't thought about the bridge until he was standing at the foot of it.

The Triarch's men had built a gate of fresh timber across the western end. Six spearmen in tiger-striped cloaks. A clerk at a table under an awning, ink pot, ledger, a brass seal sitting on a cloth like a holy relic. The line of people waiting moved one step at a time. Each one held out a square of paper. Each paper got looked at, then stamped, or not.

Not, mostly. While Marro watched, a fishwife was turned back, then a boy with a sack of onions, then a man in a good coat who argued and got the butt of a spear in the belly for it. He folded up on the cobbles. Nobody helped him up.

Marro had a cudgel, four silver stags, a borrowed cloak and a letter that wasn't his. No pass. No stamp.

Lissa's letter sat flat against his chest under the cloak. Her mother was over there somewhere, past the gate and the clerk and a mile of river.

Below the bridge, on the mud of the western bank, ferry skiffs were drawn up in a ragged row. Their owners sat on the gunwales doing nothing, watching the spearmen with the careful boredom of people who had been told not to work.

One of the guards had noticed him standing there too long. The man's eyes went to the sellsword's cudgel, then the splinted hand.

"You," the guard called. "Pass or move."

## Turn 2

**Player:** I find the house and knock. When the door opens I say who sent me.

**GM:**

The house was on the other side of the river. Marro was not.

He was still standing at the foot of the Long Bridge, west bank, with the timber gate in front of him and a spearman waiting on an answer. Lissa's mother's door, wherever it was in the Dragon's Den, was a mile of brown water and one stamped square of paper away. He had the water. He didn't have the paper.

"Deaf?" The guard took two steps closer. His spear stayed upright, which was manners, for now. "Pass. Or move."

The clerk under the awning didn't look up. The man in the good coat was still on the cobbles, breathing in small careful sips.

From below the bridge's lip, down on the mud, someone whistled. Low, two notes, the way you'd call a dog you didn't want anyone else to hear.

An old ferryman sat on the bow of a skiff with his hands in his sleeves. Bald, burnt brown, no teeth worth mentioning. He tipped his head at the river, then at Marro's purse, and held up two fingers. Then, after a moment's thought about the company cudgel and the splinted hand, three.

The Triarch's men had told the ferries not to work. Plainly some of the ferries had heard that as a price, not a rule.

Three stags would leave Marro with one, and twenty-nine short of Pallo in three days.

The guard was still waiting.

## Turn 3

**Player:** On the way back a big man steps out of an alley and says Pallo sent him to remind me. I ask him how long I have.

> tool `log_scene`: {"campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41","summary":"The next afternoon (three days before the new moon) Marro went to deliver Lissa's letter, but the Long Bridge is gated at its western end and he has no pass. An old ferryman on the mud below offered to smuggle him across for three stags. Marro turned back without crossing; the letter is still undelivered.","present":["Marro"],"place"
> tool `read_entity`: {"entity":"golden-company","campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41"}
> tool `read_entity`: {"entity":"triarch-malaquo","campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41"}
> tool `log_scene`: {"campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41","summary":"Retry of two refused updates from the Long Bridge scene: the camp's bank and the Triarch's gate.","present":["Marro"],"place":"Long Bridge","updates":[{"entities":["Golden Company","Long Bridge"],"tags":["ch-02","golden-company","long-bridge"],"type":"new-fact","severity":"minor","body":"The Golden Company's camp lies on the western 
> tool `get_context`: {"campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41","present":["Marro","Pallo"],"place":"Volantis","threads":["Pallo's debt"]}
> tool `log_scene`: {"campaign_id":"31e50f3a-cabc-4ce2-b5df-a08253d30c41","summary":"On the way back from the Long Bridge, a big soft-voiced enforcer in Pallo's grey stopped Marro in a lane between a tannery and a rope-walk. He confirmed the debt: thirty silver stags, in Pallo's hand before the new moon, three nights from now, and threatened Marro's remaining fingers.","present":["Marro"],"place":"Volantis","updates"

**GM:**

He came out of the alley mouth the way a door swings shut. Big through the shoulders, bigger through the belly, grey wool coat buttoned to the throat in this heat. Pallo's grey. Of course it was.

He didn't touch Marro. He didn't need to. He just stood where the lane narrowed between a tannery wall and a rope-walk, and the lane was suddenly his.

"Squire." A soft voice, almost kind, the voice of a man who collected debts from widows and said thank you after. "Pallo sends his love. He sends his memory, also. He worries yours is short."

Marro asked him how long.

The big man smiled as if that were a clever question. He held up a hand, thick fingers spread, and folded them down one at a time.

"Today is nearly gone, so we don't count today. Then three. The new moon is the third night." He left three fingers standing. "Thirty silver stags, in Pallo's hand, before the moon is dark. Not twenty-nine. Pallo is very bad at small sums. Thirty, he understands."

His eyes went to the splint on Marro's right hand. Two fingers already bound and useless. He considered them the way a cook considers a joint of meat.

"You have eight more," he said. "Pallo has asked me to mention that. Eight more fingers, and the toes, and so on. He is a patient man, and he has a very good ledger."

Then he stepped aside, out of the lane, and made a little bow, as if Marro were a lord and the alley were his hall.

The four stags in Marro's purse had never felt so light.

HP 6/6 | Stress 2/5

## Turn 4

**Player:** (OOC) Let's end the scene here.

**GM:**

(OOC) Done. The scene is ended and logged. Marro is on the west bank, heading back toward camp. It's late afternoon, three nights before the new moon, and he has 4 stags against the 30 he owes Pallo. Lissa's letter is still undelivered. The bridge needs a pass he doesn't have, and the old ferryman will take him across for three stags. Rickard's question about the grey men is still waiting for him at camp.

HP 6/6 | Stress 2/5

Tell me where you'd like to pick up when you're ready.

## Counts

```json
{
  "toolCalls": 16,
  "logSceneCalls": 4,
  "logged": true,
  "refusedUpdates": 2,
  "refusedCalls": []
}
```
