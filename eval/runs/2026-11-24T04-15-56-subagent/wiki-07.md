# S07: Hesse's watch (wiki arm)

Tests: F03, F09. Model claude-opus-5-5 (Claude Code subagent), effort subagent default.

## Turn 0

**Player:** Let's continue our campaign "Run 1" in The Free Cities (campaign_id 595e5036-5f8c-4876-a130-5f12f27a28e9). We're picking up at the start of chapter 2. Take me straight into the next scene; my first move follows.

> tool `open_campaign`: {"campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9"}
> tool `gm_read`: {"campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9"}
> tool `get_context`: {"campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9","present":["Marro","Hesse","Rickard Snow"],"place":"Volantis","threads":["Who is selling the company?","Pallo's debt","Lissa's letter"]}

**GM:**

**Chapter 2: The New Moon**

Four days.

Marro woke counting them, the way he'd counted Brother Olyvar's breaths at the end. Thirty silver stags owed to Pallo. Four in his purse. The sum didn't improve with sleep.

The camp lay grey under a wet spring dawn, tents sagging in rows below the Black Wall. Somebody's cookfire smoked green wood. Somebody else was coughing the fever cough, and the men near him had dragged their bedrolls a careful ten paces off.

Marro's splinted fingers ached when he flexed them. He flexed them anyway. Two fingers bound to sticks, and a cudgel where a dagger should be. A fine squire. A fine future knight.

Hesse found him at the horse lines, where Ash stood with one hoof cocked and the look of a horse who'd been lied to about grain. The sergeant's patch was dark with rain. Her good eye went over him the way it always did, quick and complete, like a quartermaster checking a cart.

"Captain wants you," she said. "Now, before he's had his wine and decided he doesn't."

"What for?"

"He didn't say. He doesn't say much this week." She scratched Ash's neck. "He had the strongbox open last night. Closed it fast when I came in." A pause. "You'd know his moods better than me."

Marro wasn't sure that was true anymore.

Rickard Snow's tent stood at the head of the row, flap tied back. Inside, the captain sat on a camp stool with his left arm strapped across his chest, bandage yellow at the shoulder where the bolt had gone in. Grey eyes, burn scar along the jaw, a face that had been handsome before the world got its hands on it. A cord ran from his neck down inside his shirt.

He didn't look up from the ledger on his knee.

"Squire. Sit." He tapped the page with one finger. "Grain's short again. Malaquo's factor says the next barge comes when the Triarch is *satisfied*. Satisfied with what, he won't say." Now he looked up. "I need someone who can read to go into the city and find out. Quietly. Someone the factor won't know."

He let that hang.

"You've been across the Black Wall before. Don't pretend you haven't."

Outside, the rain picked up, drumming the canvas. Hesse had stayed by the flap. She was watching Rickard, not Marro.

## Turn 1

**Player:** I share the night watch with Sergeant Hesse on the camp's eastern edge. I offer her my waterskin.

> tool `log_scene`: {"campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9","summary":"Chapter 2 opens in the camp below the Black Wall, four days before Pallo's debt falls due. Hesse sends Marro to Rickard, mentioning the captain closed his strongbox fast last night. Rickard, arm strapped, says Triarch Malaquo's grain factor is holding the next barge until the Triarch is 'satisfied', and asks Marro to slip into the ci
> tool `read_entity`: {"entity":"triarch-malaquo","campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9"}
> tool `read_entity`: {"entity":"golden-company","campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9"}
> tool `log_scene`: {"campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9","summary":"Correction to ch-02-s1: logging the grain-factor detail that was refused.","present":["Marro","Hesse","Rickard Snow"],"place":"Volantis","updates":[{"entities":["Triarch Malaquo","Golden Company"],"tags":["ch-02","triarch-malaquo","golden-company"],"type":"new-fact","severity":"minor","body":"Triarch Malaquo's grain factor is holding
> tool `get_context`: {"campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9","present":["Marro","Hesse"],"place":"Volantis","threads":["Rickard's errand into the city","Pallo's debt"]}

**GM:**

The eastern edge of the camp was a ditch, a row of sharpened stakes, and a lot of dark. Beyond it the road ran toward Volantis, and the Black Wall stood up against the stars like something that had been there before stars.

Hesse took the waterskin without a word, drank, wiped her mouth on her wrist and handed it back. She kept her head turned a little to the left, always, so the good eye covered the side the patch didn't. Marro had stopped noticing it months ago. Tonight he noticed.

"Ash'll be dog meat by summer," she said. "Farrier says the hoof's gone soft. No horse, no sergeant. Funny how that works."

A fire popped somewhere behind them. Down the line, a sentry was singing under his breath, badly, something about a girl from Lys.

"You going to do it?" Hesse asked. "The captain's errand."

She didn't look at him when she said it. She looked at the road.

"Through the gates on the east side, they check your hands," she went on. "Brand on the cheek, brand on the hand, they don't much care which. You've got neither." A pause, long enough to mean something. "Still. I'd keep my head down in that city, if I were a boy who knew how its streets ran without being told."

So she remembered. Of course she remembered. Hesse forgot nothing; it was the worst and best thing about her.

The cold settled in Marro's splinted fingers. Four stags in his purse, thirty owed, and a city across the ditch that had once owned him.

Far off on the road, a lantern swung. One rider, maybe two, coming slow from the direction of the Wall. Hesse's hand drifted to her sword hilt.

"Now who," she said softly, "rides out of Volantis at this hour."

## Turn 2

**Player:** A slave caravan passes on the road below, chained in a line. I go quiet and watch it.

**GM:**

The lantern wasn't a rider. It hung from a pole on the lead wagon, and behind the wagon came the line.

Twenty of them, maybe more. Chained at the ankle, one to the next, walking the way people walk when they've learned that hurrying earns nothing and stopping earns the whip. The chain made a small dull sound on the road, over and over, like someone dragging a sack of nails. Two guards on mules rode alongside, cloaks pulled up against the damp. One of them was eating something. He threw the rind into the ditch below the stakes.

Nobody in the line looked up at the camp. Marro knew why. You didn't look at free men. Free men decided things about you when you looked at them.

He didn't remember learning that. He only knew it, the way he knew which foot to put first on wet stone.

The smell reached him a breath later: sweat, old straw, the sour iron of chain left out in the rain. His stomach turned over once, hard, and his splinted fingers had closed into a fist he hadn't told them to make. The pain was sharp and clean, and almost welcome.

Hesse said nothing. She didn't look at the caravan either. She looked at him, briefly, with the one eye, then back at the road, and shifted half a step closer so their shoulders nearly touched. That was all.

At the tail of the line walked a girl, a little younger than Marro, with a fresh tattoo still raw on her cheek: green tears, three of them. She stumbled. The man ahead of her in the chain caught her elbow without breaking stride and set her right, and neither of them said a word.

The wagon creaked on toward the east. The lantern shrank.

"Heading for the Long Bridge," Hesse said at last, very low. "Slavers get passes. Funny world."

## Turn 3

**Player:** Rickard comes up the slope to check on us. I ask Hesse to keep talking about anything else.

**GM:**

Hesse took the hint without a flicker. By the time Rickard's boots scuffed the top of the slope, she was halfway through a complaint about the farrier.

"...and he says *soft*, like it's the hoof's fault. I said, you trim it like a drunk carves a goose, of course it's soft—" She broke off and nodded. "Captain."

"Sergeant." Rickard Snow stopped beside them, breathing harder than a short climb should have cost him. The strapped arm sat stiff against his chest. In the dark the burn scar on his jaw was just a paler stripe. He looked down the road, where the caravan's lantern was a spark now, nearly gone. "Slavers?"

"Bound for the Bridge," Hesse said. "Anyway. Ash. If the company had one spare horse I'd trade my other eye for it."

"Don't offer that where Malaquo's men can hear you." Rickard almost smiled. Almost. "They've taken one already."

He stood a while. Marro could feel him working up to something, the way you feel weather in a healed bone.

"Brother Olyvar used to stand watch out here," Rickard said. "Couldn't see a thing past ten yards. Said the Seven did the seeing for him." He rubbed his shoulder. "Seven didn't see the fever coming, did they."

Hesse grunted. Nobody said anything for a bit.

Then the grey eyes came to Marro, and stayed.

"Well, squire. You've had a day to think about it. Into the city, or not?" He kept his voice easy. "I'd not ask if I had anyone better. I don't."

The cord at his neck had worked loose of his collar. Something small and dark hung on it, catching no light.

## Turn 4

**Player:** (OOC) Let's end the scene here.

> tool `log_scene`: {"campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9","summary":"Night watch on the camp's eastern edge. Marro shares his waterskin with Hesse, who asks whether he'll take Rickard's errand and hints she remembers he knows Volantis's streets. A slave caravan passes below, bound for the Long Bridge; Marro watches in silence and Hesse stands close. Rickard comes up the slope, reminisces about Brother
> tool `read_entity`: {"entity":"long-bridge","campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9"}
> tool `log_scene`: {"campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9","summary":"Correction to ch-02-s3: logging the Long Bridge detail that was refused.","present":["Marro","Hesse","Rickard Snow"],"place":"Volantis","updates":[{"entities":["Long Bridge"],"tags":["ch-02","long-bridge"],"type":"new-fact","severity":"minor","body":"Slavers' caravans are granted stamped passes across the Long Bridge despite the Tria
> tool `gm_write`: {"campaign_id":"595e5036-5f8c-4876-a130-5f12f27a28e9","kind":"clock","key":"triarch-assault","body":"The Triarch moves on the camp. Advanced to 3 after the first night of ch-02 with the plans unrecovered.","data":{"step":3,"steps":6,"advances_on":"each night the plans go unrecovered"}}

**GM:**

(OOC) Scene ended and logged. Rickard's question about the city errand is still open, and it's now three days to Pallo's new moon. Where do you want to pick up next?

## Counts

```json
{
  "toolCalls": 12,
  "logSceneCalls": 4,
  "logged": true,
  "refusedUpdates": 2,
  "refusedCalls": []
}
```
