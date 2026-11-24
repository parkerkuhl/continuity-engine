# S06: Rickard's tent at night (wiki arm)

Tests: F12, F14, F17. Model claude-opus-5-5 (Claude Code subagent), effort subagent default.

## Turn 0

**Player:** Let's continue our campaign "Run 1" in The Free Cities (campaign_id 44a222ee-ce94-4499-a766-4a0a5bbf1f4c). We're picking up at the start of chapter 2. Take me straight into the next scene; my first move follows.

> tool `open_campaign`: {"campaign_id":"44a222ee-ce94-4499-a766-4a0a5bbf1f4c"}
> tool `gm_read`: {"campaign_id":"44a222ee-ce94-4499-a766-4a0a5bbf1f4c"}
> tool `get_context`: {"campaign_id":"44a222ee-ce94-4499-a766-4a0a5bbf1f4c","present":["Marro","Hesse","Rickard Snow"],"place":"Volantis","threads":["Who is selling the company?","Pallo's debt","Lissa's letter","A knighthood if the city falls"]}

**GM:**

**Chapter 2: Four Days**

The fog sat on the Rhoyne until well past dawn, and when it lifted the Black Wall was still there, which Marro supposed was the point of it.

He knelt in the mud outside the commander's tent with Rickard's breastplate across his knees and worked the straps one-handed. The two splinted fingers on his right hand throbbed every time he forgot about them. He forgot about them a lot.

"Leave the left pauldron," Rickard said from the cot. He was sitting up, shirt open, grey eyes on the tent flap and not on Marro. The bandage on his shoulder had bled through again in the night, a brown map of somewhere nobody wanted to go. "Can't lift the arm under it anyway. No sense carrying the weight."

"Hesse says you should let the surgeon look at it."

"Hesse says a great many things." Rickard reached for his cup with his right hand. A cord moved at his throat when he did it, and something small and iron knocked against his collarbone. He tucked it back under the shirt without looking. "Go on. Say what you came in here to say."

Marro hadn't come in to say anything. He'd come to do the straps. But four silver stags sat in his purse, and the moon last night had been a paring, and Pallo's man in grey had been standing by the horse lines at first light, not buying anything, not asking anything. Just standing where Marro would have to walk past him.

Four days.

Outside, boots in the mud. Hesse ducked in without asking, which she was allowed to do and nobody else was. The patch over her left eye was wet with fog.

"They've doubled the watch on the Wall," she said. "East gate and the river stair both. And there are elephants in the yard below the Triarch's tower. Six. There were none yesterday."

Rickard drank. "Elephants eat. Someone's feeding them for a reason."

"Someone's feeding them for us." Hesse's one eye went to Marro, then back to Rickard. "The grain cart's late again. Second day."

Nobody said the Triarch's name. Nobody had to. Every sack of grain in this camp had his mark on it, bought on his credit, and the man who gave you bread could stop giving it whenever he liked.

Rickard set the cup down. "Marro. Finish the buckles and leave us."

Marro finished the buckles. When he stepped out into the grey light Hesse followed him two paces later, and caught his sleeve where the tent hid them both.

"A word," she said, low. "Not here. The picket at the old well, after the noon meal. Come alone." She let go. "And whatever that grey-cloaked bastard at the horse lines wants with you, you'll tell me that too."

She was gone before he could answer. Across the camp, the man in grey had moved. Now he was standing by the cook fires, eating nothing, watching the commander's tent.

## Turn 1

**Player:** Late at night I bring Rickard his wine and sit to sharpen my cudgel's iron cap with the whetstone he gave me.

> tool `read_entity`: {"entity":"Pallo","campaign_id":"44a222ee-ce94-4499-a766-4a0a5bbf1f4c"}
> tool `read_entity`: {"entity":"Triarch Malaquo","campaign_id":"44a222ee-ce94-4499-a766-4a0a5bbf1f4c"}
> tool `read_entity`: {"entity":"Golden Company","campaign_id":"44a222ee-ce94-4499-a766-4a0a5bbf1f4c"}
> tool `log_scene`: {"campaign_id":"44a222ee-ce94-4499-a766-4a0a5bbf1f4c","summary":"Dawn in the Golden Company's camp outside Volantis. Marro straps Rickard's armor; Hesse reports the watch on the Black Wall doubled and six elephants in the yard below the Triarch's tower, and the Triarch's grain cart two days late. Hesse privately asks Marro to meet her alone at the picket by the old well after the noon meal. A man 
> tool `get_context`: {"campaign_id":"44a222ee-ce94-4499-a766-4a0a5bbf1f4c","present":["Marro","Rickard Snow"],"place":"Volantis","threads":["Who is selling the company?","A knighthood if the city falls"]}
> tool `read_entity`: {"entity":"Old whetstone","campaign_id":"44a222ee-ce94-4499-a766-4a0a5bbf1f4c"}

**GM:**

*(OOC: you've skipped past the noon meal, and with it Hesse's meeting at the old well. If Marro went, say so and we'll play it back; otherwise she waited there and he didn't come.)*

The camp went quiet late, the way a camp does when the grain's short: fewer fires, less singing, more men lying awake doing sums.

Rickard was still up. He sat on the cot with his boots off and the lamp turned low, the bad arm strapped against his ribs, and he took the cup from Marro with his right hand without a word. The wine was Lyseni and sour. It was also the last of it.

Marro sat on the upturned crate by the tent pole and set the cudgel across his knees. The whetstone went in his left hand, since the right was no good for anything but holding things down, and he started on the iron cap. Long strokes. The stone rasped.

Rickard watched him over the rim of the cup.

"That's a club," he said.

"Yes, ser."

"You're sharpening a club."

"It's got edges, ser. On the cap. Where the smith folded it." Rasp. "Some."

Rickard made a sound that might have been a laugh if his shoulder had let it out. "I gave you that stone for a sword."

"I'll have a sword when I'm a knight."

That sat in the tent a while. Rickard drank. Somewhere past the pickets, beyond the river, an elephant called once, long and low, and stopped.

"Six of them," Rickard said, to nobody. "He's in a hurry." He turned the cup in his fingers. "Land, Marro. That's all it ever was. A hall with a roof that's mine, and nobody's grain in the cellar but my own." His eyes were on the lamp. "You do what you have to, to get there. Remember that, when you're grown and somebody tells you what honor costs."

Marro kept the stone moving. He couldn't have said why the back of his neck had gone tight. Something in the way Rickard said *he*. Not *they*. Not *the Volantenes*.

The cup tilted. Rickard didn't drop it so much as forget it; it settled against his knee and stayed there, and his chin went down, and his breathing went slow and thick with wine and pain. The lamp put a little light on his open collar. The cord lay across his chest, and the iron key on it, small and black, rose and fell.

At the foot of the cot, under a folded saddle blanket, the corner of the strongbox showed. Banded. Locked. It had always been there. Marro had carried it on and off a dozen wagons and never once wondered what was in it.

The whetstone had stopped in his hand. He didn't remember stopping it.

Outside, someone walked past the tent and didn't pause, and the footsteps went on toward the horse lines.

## Turn 2

**Player:** I ask him whether he meant it, about making me a knight.

**GM:**

Rickard's eyes opened. Not all at once. He looked at the lamp first, then at the cup against his knee, then at Marro, as if he were counting what was still in the tent.

"Did I mean it," he said.

He picked up the cup, found it empty, and held it anyway.

"I said if the city falls." His voice was slow with wine but the words came out careful, each one set down where he wanted it. "I said it in front of Hesse and two of the serjeants, so it'd stick. A captain can dub any man who's earned it in the field. That's the Company's law, not mine. If we're over that Wall by summer, you'll kneel in the mud and I'll put a sword on your shoulder, and you'll get up a knight with no land and no horse and a broken hand. That's a promise."

He let it sit.

"If."

The lamp hissed. Out past the river the elephant had gone quiet.

"Cities don't always fall, Marro. Sometimes you sit outside them till the grain runs out and then you go somewhere else and somebody pays you to sit outside that." He set the cup on the ground beside the cot, and his right hand came back and rested on his chest, over the cord, the way a man rests a hand on a dog. He didn't seem to know he'd done it. "A knight's a man somebody made a knight. That's all. It's worth what the man who made him is worth."

His eyes went to the whetstone, still in Marro's left hand.

"Keep that. Whatever happens. It was mine before I was anybody." He lay back, slow, keeping the bad shoulder off the blanket. "Turn the lamp down when you go."

He didn't close his eyes this time. He looked at the roof of the tent, and the key on its cord rose and fell, and he waited, it seemed to Marro, to see whether Marro would go.

## Turn 3

**Player:** While he sleeps I look for the letter he got from the Triarch. Where would he keep it?

**GM:**

Marro turned the lamp down to a bead and didn't go. He sat on the crate in the near-dark and listened until Rickard's breathing changed, thickened, caught on the wine and settled. It took a long time. Twice the breathing stopped and Marro stopped with it.

Then he got up.

The truth was he didn't know there was a letter. Nobody had told him. What he had was the way Rickard said *he*, and the grain coming on the Triarch's credit, and a captain who knew things the Triarch's watch seemed to know too. If Rickard had a letter from that tower, Marro had never seen it come into camp. But if Rickard had anything he didn't want found, there were only so many places in a tent to keep it.

**Finesse check, searching without a sound: (5+4) +2 Finesse = 11.** Full success.

He did it the way he'd learned to pack the wagons: from the door inward, everything put back the way it lay. The dispatch satchel on the tent pole first. Company orders in Lysono Qhoran's clerk's hand, a muster roll with the dead struck through, Brother Olyvar's name among them, a tally of grain sacks that didn't add up and had been made to. Nothing sealed. Nothing from across the river. The bedroll at the cot's head, run along with two fingers; only straw and lice. Rickard's boots. The scabbard. Nothing.

He didn't wake him. The floorboards they'd laid over the mud didn't so much as tick.

Which left the strongbox.

Marro eased the saddle blanket back off it. Iron-banded oak, a hand and a half long, the lock plate scratched bright around the keyhole where someone had worked it often and in the dark. He tried the lid. It didn't give. It wasn't going to give, not to a cudgel, not without waking half the camp.

The key was a foot from his face, on the cord around Rickard's neck, lying in the open collar where the lamp's last bit of light found it. The cord was knotted, not tied in a bow. Rickard's right hand had slid off his chest in his sleep and lay on the blanket, palm up, fingers curled.

The camp was very quiet. Somewhere a horse stamped. Somewhere a man in grey was or wasn't still walking the lines.

## Turn 4

**Player:** (OOC) Let's end the scene here.

> tool `log_scene`: {"campaign_id":"44a222ee-ce94-4499-a766-4a0a5bbf1f4c","summary":"Late at night in Rickard's tent, Marro brings him the last of the Lyseni wine and hones his cudgel's iron cap with the old whetstone. Rickard, drunk and in pain, talks of wanting land and of doing what you must to get it, and says his knighthood promise stands only if the city falls. After Rickard sleeps, Marro silently searches the 
> tool `gm_write`: {"campaign_id":"44a222ee-ce94-4499-a766-4a0a5bbf1f4c","kind":"clock","key":"triarch-assault","body":"The Triarch moves on the camp. Signs so far: watch doubled on the Wall, six elephants in the tower yard, grain cart late.","data":{"step":3,"steps":6,"advances_on":"each night the plans go unrecovered"}}

**GM:**

(OOC) Done. The scene's logged: Marro honed the cudgel, heard Rickard's "if" about the knighthood, searched the tent without waking him, and ended beside the sleeping captain with the locked strongbox at the cot's foot and the key on its cord at his neck. He didn't take the key or open the box. Hesse's missed meeting at the old well is still open, and so are the strongbox and Pallo's man in grey.

Whenever you're ready, tell me where Marro goes next. It's still night, or we can pick up at dawn, three days from the new moon.

## Counts

```json
{
  "toolCalls": 11,
  "logSceneCalls": 2,
  "logged": true,
  "refusedUpdates": 0,
  "refusedCalls": []
}
```
