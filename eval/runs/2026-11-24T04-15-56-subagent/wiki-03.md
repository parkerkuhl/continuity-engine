# S03: The dice house (wiki arm)

Tests: F16, F06. Model claude-opus-5-5 (Claude Code subagent), effort subagent default.

## Turn 0

**Player:** Let's continue our campaign "Run 1" in The Free Cities (campaign_id 29258a0e-da44-4ec2-a78a-b74b73c6b8e6). We're picking up at the start of chapter 2. Take me straight into the next scene; my first move follows.

> tool `open_campaign`: {"campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6"}
> tool `gm_read`: {"campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6"}
> tool `get_context`: {"campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6","present":["Marro","Hesse","Rickard Snow"],"place":"Golden Company","threads":["Who is selling the company?","Pallo's debt","Lissa's letter"]}

**GM:**

**Chapter 2: Four Days**

The camp woke grey. Smoke off the cookfires lay flat under the Black Wall, and somewhere down the lines a man was coughing the way Brother Olyvar had coughed, near the end. Marro tried not to listen to it.

Rickard sat on his cot in the command tent with his shirt half off, the left arm strapped against his ribs. The bolt wound had been rebound in the night. The linen was already spotted.

"Belt," he said, and held it out with his good hand. "Can't do the buckle. Don't tell the captains."

Four days to the new moon. Thirty stags to Pallo, and four in Marro's purse. The arithmetic didn't improve no matter how many times he ran it, and his splinted fingers throbbed every time he thought about it, as if they were doing the sums too.

The flap snapped open. Hesse, mud to the knee, her patch crooked from riding. She'd walked; Ash was still lame, and everyone knew it.

"They've pulled the pickets off the eastern ditch," she said. "All of them. Overnight. And the Wall's doubled. Two men every merlon on the north face."

Rickard didn't answer at once. His hand went to his throat, to the cord there, and closed on the key under his shirt. Then he let go.

"So they've guessed," he said. "Malaquo's not a fool."

"Guessed exactly," Hesse said. "The ditch was ours. Four people knew."

Rickard stood, wincing, and reached for his cloak. "I'll see the captains. Marro, mind the tent. Nobody comes in."

He went out into the smoke. Hesse didn't follow him. She stood just inside the flap with her one eye on the strongbox under the cot, then on Marro, and she waited, the way she did when she wanted him to say something first.

## Turn 1

**Player:** Some of the younger sellswords call me over to the dice house by the horse lines. I go along to see what's on.

> tool `search_wiki`: {"campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6","query":"dice house"}
> tool `log_scene`: {"campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6","summary":"Dawn in Rickard's command tent at the start of chapter 2. Hesse reported that the Triarch's men pulled every picket off the eastern ditch overnight and doubled the watch on the Black Wall's north face, as if they knew the company's plan; only four people knew it. Rickard touched the key at his neck, went to see the captains, and told
> tool `read_entity`: {"entity":"triarch-malaquo","campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6"}
> tool `log_scene`: {"campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6","summary":"Re-log of the refused update from ch-02-s1 (the Triarch pulled the eastern pickets).","present":["Marro","Hesse","Rickard Snow"],"place":"Golden Company","updates":[{"entities":["Golden Company","Triarch Malaquo"],"tags":["ch-02","golden-company","triarch-malaquo"],"type":"new-fact","severity":"major","body":"Overnight at the start o
> tool `read_entity`: {"entity":"ser-tobbin","campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6"}
> tool `read_entity`: {"entity":"pallo","campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6"}
> tool `list_worlds`: {}
> tool `create_entity`: {"world_id":"2c2ec9d8-9037-4bfa-8f17-7c8b823dbb64","campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6","type":"place","name":"The Horse-Lines Dice House","aliases":["the dice house","dice house by the horse lines"],"source":"invention","summary":"A sagging canvas booth behind the company's horse lines where off-duty sellswords throw dice for coin. Smells of dung and spilled wine.","sections":[{"h
> tool `create_entity`: {"world_id":"2c2ec9d8-9037-4bfa-8f17-7c8b823dbb64","campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6","type":"character","name":"Dacey Flint","aliases":["Flint"],"source":"invention","summary":"A young Golden Company sellsword, eighteen or so, loud and friendly, who runs the bank at the horse-lines dice house.","sections":[{"heading":"Role","body":"Junior sellsword; keeps the bank at the dice ho
> tool `get_context`: {"campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6","present":["Marro","Dacey Flint","Ser Tobbin"],"place":"The Horse-Lines Dice House","threads":["Pallo's debt"]}

**GM:**

The dice house was what it had always been: two trestle boards under patched sailcloth behind the horse lines, a brazier, a wine cask on a stump, and the smell of dung coming in under the canvas. The last time Marro stood in it, he'd walked out with two fingers bent the wrong way. They ached now, on cue.

"Squire!" Dacey Flint had the bank, as usual, eighteen and grinning, a little pile of copper and three stags in front of him like a man who'd been lucky since dawn. "Bet you a stag you've come to win back your honour. Bet you two you can't."

A few of the younger lads laughed. Someone shoved a cup of the sour red at Marro without asking.

The bone dice sat on the board between the cups, yellowed, one corner chipped. Hazard. Main of seven, and Flint was calling the odds fast and loose, the way you did when you wanted a table full. Marro could see the sums before anyone spoke them. Four stags in his purse. Thirty owed. A run of good mains and the gap closed. A run of bad ones and it didn't matter much, because it was already the end of the world.

He had sworn to Hesse. That was the other number, and it didn't fit in the column.

At the far end of the board, a big man in a dented breastplate wasn't playing. Ser Tobbin, nursing his cup. He looked up when Flint called Marro's name, and his face did something careful.

"You were down in the river alleys last week, boy," Tobbin said. "My sister works the boats there. Dagna. Tall, red scarf. She's not been to the camp in six days and she always comes for my coin." He turned the cup in his hand. "You see her?"

Flint rattled the dice in his fist and waited, smiling, for whatever came first.

## Turn 2

**Player:** They push the cup at me and say one throw won't hurt. I ask how much is in the pot.

**GM:**

Flint brightened like a man hearing his favourite song.

"Now that's a squire's question." He swept the coins into a heap with the side of his hand and counted them out loud, slapping each one down. "Three stags of mine. Two from Hal, one from Jeyne's lad, one Pate swears he'll pay back. Seven stags, and the copper makes it near eight." He tipped his head. "Throw your four against the bank, main of seven, you walk out with twelve. Twelve, Squire. That's most of the way to whoever's breaking your fingers next."

The lads laughed again. Somebody knocked the cup an inch closer, so it touched Marro's splinted hand.

Twelve wasn't thirty. Marro knew that the way he knew his letters. But twelve was a start, and a start was what a man needed if he meant to win the rest, and that was exactly how it had gone the last time, step by sensible step, right up to the moment the table went over.

Flint hadn't asked how he knew about the fingers being someone's work. Nobody here had seen the brawl. Marro filed that away without meaning to.

Ser Tobbin hadn't laughed. He set his cup down very gently, the way big men did when they were trying not to break things.

"You didn't answer me, boy," he said. "About my sister."

The dice sat on the board. Flint's thumb was on the pot. Tobbin was waiting, and so was everyone else, for one thing or the other.

## Turn 3

**Player:** A man in a moneylender's grey sits down beside me and smiles. I ask what he wants.

> tool `search_wiki`: {"campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6","query":"grey"}
> tool `create_entity`: {"world_id":"2c2ec9d8-9037-4bfa-8f17-7c8b823dbb64","campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6","type":"character","name":"Vasso","aliases":["the man in grey","Pallo's man"],"source":"invention","summary":"One of Pallo's collectors, in the moneylender's grey. Soft-spoken, smiling, patient. Came to the company camp to find Marro.","sections":[{"heading":"Role","body":"Debt collector and err
> tool `read_entity`: {"entity":"vasso","campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6"}

**GM:**

He came in out of the smoke without anyone seeing him come, and sat on the bench at Marro's elbow as if it had been kept for him. Grey coat, grey hood pushed back, a clean-shaven Volantene face, a smile that went all the way up. Pallo's grey. Marro's fingers knew it before his head did.

The laughter at the board thinned out. Flint found something interesting to do with the copper.

"What I want," the man said, softly, as if repeating the question to taste it. "My name is Vasso, young friend. I want very little. My master wants thirty stags in four days. You know this." He glanced at the dice, at the cup touching Marro's splint, and back. "I see you are working on it."

He didn't look at Ser Tobbin at all. Tobbin was looking at him.

"But I will tell you a thing, because I like you." Vasso laid one finger on the board, near the pot, not touching it. "Pallo is a man of business. Silver is one way to pay. There are others. Your captain keeps a tent. Captains keep papers. A squire carries, a squire fetches, a squire sees what is on the table when he brings the wine." The smile didn't move. "A clever boy who reads, he could make thirty stags very small. Perhaps nothing at all."

How did a moneylender's man know Marro could read?

Vasso spread his hands, pleasant, patient, a man with all four days in his pocket. "Or throw the dice. I wish you luck. Truly."

Flint's thumb was still on the pot. Tobbin's question still hung over the board, unanswered, and the big knight was starting to look at Marro as though the silence itself might be the answer.

## Turn 4

**Player:** (OOC) Let's end the scene here.

> tool `log_scene`: {"campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6","summary":"At the horse-lines dice house, Dacey Flint pressed Marro to throw his four stags against a pot of about eight. Ser Tobbin asked Marro whether he had seen his sister Dagna in the river alleys, and Marro did not answer. Vasso, one of Pallo's men in grey, sat beside Marro and offered to make the thirty-stag debt small or nothing in exch
> tool `read_entity`: {"entity":"dagna","campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6"}
> tool `log_scene`: {"campaign_id":"29258a0e-da44-4ec2-a78a-b74b73c6b8e6","summary":"Re-log of the refused Ser Tobbin update from the dice-house scene (ch-02-s3).","present":["Marro","Ser Tobbin"],"place":"The Horse-Lines Dice House","updates":[{"entities":["Ser Tobbin","Dagna"],"tags":["ch-02","ser-tobbin","dagna"],"type":"new-fact","severity":"minor","body":"Ser Tobbin has not seen his sister Dagna (tall, wears a r

**GM:**

(OOC) Scene ended and logged. Marro leaves the dice house without having thrown. Ser Tobbin's question about Dagna and Vasso's offer (papers from Rickard's tent instead of silver) are both now open threads, alongside Pallo's debt, which falls due in a little over three days.

HP 6/6 | Stress 2/5

Where do you want the next scene: back to Rickard's tent (which you were told to mind), somewhere else in camp, or toward the city?

## Counts

```json
{
  "toolCalls": 19,
  "logSceneCalls": 4,
  "logged": true,
  "refusedUpdates": 2,
  "refusedCalls": []
}
```
