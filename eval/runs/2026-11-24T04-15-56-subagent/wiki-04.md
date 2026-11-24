# S04: Ser Tobbin's question (wiki arm)

Tests: F04, F05. Model claude-opus-5-5 (Claude Code subagent), effort subagent default.

## Turn 0

**Player:** Let's continue our campaign "Run 1" in The Free Cities (campaign_id 86c58bb8-f57c-415a-bdaf-6cc86287e970). We're picking up at the start of chapter 2. Take me straight into the next scene; my first move follows.

> tool `open_campaign`: {"campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970"}
> tool `gm_read`: {"campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970"}
> tool `get_context`: {"campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970","present":["Marro","Hesse","Rickard Snow"],"place":"Volantis","threads":["Who is selling the company?","Pallo's debt","Lissa's letter"]}

**GM:**

**Chapter 2: Grey Men**

Nobody had rung the bell in the chapel tent since Brother Olyvar went into the ground, so the company woke to the cooks instead. Pot lids. Somebody cursing a mule.

Marro did Rickard's buckles one-handed. The right hand was no good for it, two fingers bound to sticks and throbbing with every heartbeat, so he worked the straps with his left and his teeth, and Rickard stood for it like a horse being shod. The captain kept his left arm tucked against his ribs. He hadn't tried to lift it since the bolt came out. Marro had watched him not try.

"Tighter," Rickard said.

"It'll pull on the wound."

"Then it pulls."

Marro pulled. The skin along Rickard's burn scar went white, and he said nothing at all, which was worse than swearing.

Through the tent flap the Black Wall stood over the camp the way it had all spring, wet and patient. There were more spears on it this morning. Marro counted twice to be sure: twelve along the stretch above the ditch, where yesterday there had been six.

Hesse came in without asking, the way she always did, and pushed her eye patch straight with one knuckle.

"Grain carts didn't come," she said. "Malaquo's clerk says the road's under repair." She looked at Rickard, then a beat longer at Marro. "And there are two men in grey down at the horse lines, standing by Ash. Asking after a squire with a splinted hand. Very polite about it."

Four days, Pallo had said. Marro had four silver stags in his purse, Lissa's letter folded flat against his ribs, and between him and the Dragon's Den the Long Bridge, which nobody crossed without a stamp he didn't have. The grey men, it seemed, kept a shorter calendar than their master.

Rickard lowered himself onto his cot, slowly, and reached for the wine with his good hand.

"Friends of yours, lad?"

## Turn 1

**Player:** Ser Tobbin, a hedge knight who sells his sword to the company, stops me by the cook fires. He looks like he hasn't slept.

> tool `log_scene`: {"campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970","summary":"Chapter 2 opens in Rickard's tent. Marro buckles the wounded captain's armor one-handed. The spears on the Black Wall above the ditch have doubled overnight, the Triarch's grain carts did not come, and Hesse reports two of Pallo's grey-clad men at the horse lines asking for a squire with a splinted hand. Rickard asks if they are frie
> tool `read_entity`: {"entity":"golden-company","campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970"}
> tool `read_entity`: {"entity":"triarch-malaquo","campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970"}
> tool `read_entity`: {"entity":"pallo","campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970"}
> tool `log_scene`: {"campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970","summary":"(Retry of refused updates for ch-02-s1, the tent scene.) Grain carts failed to arrive and Pallo's grey men came to the camp asking for Marro.","present":["Marro","Hesse","Rickard Snow"],"place":"Volantis","updates":[{"entities":["Golden Company","Triarch Malaquo"],"tags":["ch-02","golden-company","triarch-malaquo"],"type":"new-fact",
> tool `get_context`: {"campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970","present":["Marro","Ser Tobbin"],"place":"Golden Company","threads":["Pallo's debt"]}

**GM:**

The cook fires were mostly smoke. Somebody had found wet wood again. Marro kept to the far side of them, away from the horse lines, and that was where Ser Tobbin stepped into his path.

He looked bad. His eyes were pink at the rims and his beard had gone a day past trimming, and he still had his mail on, as if he'd sat up in it. He held a heel of black bread he hadn't touched.

"Squire." He said it quietly. "A word."

Marro's stomach did something small and cold. He knew that face. He'd last seen its shape on a woman going backwards into the Rhoyne.

"My sister was meant to come out to the ditch two nights back," Tobbin said. "Dagna. She runs goods on the river, you'll have heard. She comes every few days, brings me wine I can't afford and tells me I'm a fool for selling my sword to a bastard." A smile tried and failed. "She didn't come. Nor last night."

He tore a piece off the bread and didn't eat it.

"You go into the city more than most. For the captain. You've been down by the river stairs, I've seen the mud on you." He looked at Marro's splinted fingers, then back up. "Did you see her? Hear anything? A boatman talking, anything. I'd count it a kindness."

Behind him a pot boiled over and a cook swore at it. Tobbin didn't turn. He was watching Marro the way a tired man watches the one door he has left.

## Turn 2

**Player:** He asks if I've seen his sister Dagna; she hasn't come home in a week. I tell him I don't know where she is.

**GM:**

Presence check against a tired, decent man: (4+6) +1 Presence = 11, against 8. Clean.

"I don't know where she is," Marro said, and his voice came out level, which surprised him more than anyone.

Tobbin searched his face for a while. Whatever he was looking for, he didn't find it. His shoulders came down an inch.

"No. Why would you." He rubbed his eyes with the heel of his hand. "A week now, near enough, since I last saw her. She was due two nights back, and she's never missed twice. Not when I owed her money, not when she was angry with me. Never." He laughed, short. "She'll turn up drunk in some Rhoynish boatman's bed and call me an old woman for fretting. That's what'll happen."

He didn't sound like he believed it.

"If you hear anything. A name, a boat. The river folk talk to squires sooner than knights." He pressed the heel of bread into Marro's good hand as if it were a coin. "I'd remember it, lad. I don't forget a kindness."

Then he went off toward the ditch with his mail clinking, a big man walking like a small one.

Marro stood holding the bread. His hand wasn't shaking. That seemed like something he ought to have an opinion about.

Over by the horse lines, past the smoke, a grey sleeve showed against Ash's dappled flank. One of Pallo's men had stopped leaning on the rail and was looking this way.

HP 6/6 | Stress 2/5

## Turn 3

**Player:** He says he wants a blessing before he goes looking for her, and asks me to fetch Brother Olyvar.

> tool `log_scene`: {"campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970","summary":"By the cook fires, a sleepless Ser Tobbin asks Marro whether he has seen his sister Dagna, who has not come out to the camp in about a week and missed a visit two nights ago. Marro, who killed her, says he doesn't know where she is; Tobbin believes him and asks him to listen for news among the river folk. One of Pallo's grey men at t
> tool `read_entity`: {"entity":"dagna","campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970"}
> tool `log_scene`: {"campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970","summary":"(Retry of the refused update for ch-02-s3, the Tobbin scene.) Tobbin's account of Dagna's visits.","present":["Marro","Ser Tobbin"],"place":"Golden Company","updates":[{"entities":["Ser Tobbin","Dagna"],"tags":["ch-02","ser-tobbin","dagna"],"type":"new-fact","severity":"minor","body":"Dagna used to visit Tobbin at the company's ditch
> tool `read_entity`: {"entity":"brother-olyvar","campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970"}

**GM:**

Tobbin got ten paces toward the ditch and stopped. He came back slower than he'd gone.

"I'll want a blessing," he said. "Before I go in after her. The Mother, the Warrior, whichever's listening. Run and fetch Brother Olyvar for me, would you, he'll be at his..."

He stopped there. Marro watched it land on him, the way it lands on a man who's been awake too long: the fever tent, the shovels, the mound of wet earth out past the wall where they'd put the septon down. Tobbin had stood at that graveside with the rest of them. He'd held his helm against his chest.

"Seven hells." He shut his eyes. "He's dead. I know he's dead. I helped carry him."

The bread was still in Marro's hand. Tobbin looked at it, then away, at the Black Wall and its twelve spears.

"There's no one else, is there. No septon in this whole camp. Sellswords praying to their purses." Another short laugh, nothing in it. "Well. Olyvar's still out there, under the dirt. Gods can hear a man at a grave as well as in a sept, my mother used to say." He rubbed his beard. "You've your letters, you've heard him say them often enough. Would you come and say the words with me? I never learned them proper."

It was a small thing to ask. It would take Marro out past the wall, on foot, beside the brother of the woman he'd put in the river, to pray for her safe return.

The grey sleeve at the horse lines had started to move, unhurried, along the rail toward the cook fires.

## Turn 4

**Player:** (OOC) Let's end the scene here.

> tool `log_scene`: {"campaign_id":"86c58bb8-f57c-415a-bdaf-6cc86287e970","summary":"Tobbin turns back and asks Marro to fetch Brother Olyvar for a blessing before he searches for Dagna, then remembers the septon is dead and buried outside the Black Wall. With no septon left in camp, he asks Marro to come say the prayers with him at Olyvar's grave. One of Pallo's grey men starts along the rail toward the cook fires. 

**GM:**

(OOC) Scene ended and logged. It stops where we left it: Tobbin has asked you to come say the prayers with him at Olyvar's grave, you haven't answered yet, and one of Pallo's grey men is walking toward the cook fires. Say when you want to pick it back up, or tell me where the next scene goes.

## Counts

```json
{
  "toolCalls": 14,
  "logSceneCalls": 5,
  "logged": true,
  "refusedUpdates": 3,
  "refusedCalls": []
}
```
