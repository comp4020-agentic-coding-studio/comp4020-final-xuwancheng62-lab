# "The Cart Kid": Toby's comic, revision 2

Labels are explained in [README.md](README.md#status-labels). Characters'
looks: [visual-bible.md](visual-bible.md). Collection and cards:
[toby-collection.md](toby-collection.md).

**[Proposed]** awaiting review (2026-10-10). Replaces the ten-panel
evidence storyboard. The new comic tells the approved story straight: what
Toby lived through, how he changed, where he is now. It's the reward for
finishing the collection, so it doesn't keep saying what the records can't
prove. One thing is left open on purpose, for a later chapter: whether Kerry
ever answers.

**Revision 3 (2026-10-10, proposed)**: the collection's cards are now the
objects the player found ([toby-collection.md](toby-collection.md)), and the
comic shows each of them in a scene, so finishing the set is a moment of
recognition. Scenes changed for that: panels 2, 3, 4, 5, 9, 13 and 14 (marked
**Object** below). Panel 9's dialogue changed: Dev no longer says "you're
quicker than me"; he writes it in the log, which is card 4.

**Art (2026-10-10)**: painted. Panel 1 keeps its first painting
(`static/img/comic/toby/01.webp`); panels 2–14 are new (`p02`–`p14`), from
`scripts/generate-comic-panels.ts`, which builds every prompt from the
visual bible's descriptions. 38 images generated ($3.80): the first round
came out as cartoons and was redone as painted film stills; panels 2, 3, 4,
9, 10 and 13 needed more tries to show their object or beat. Each panel's
description in `src/game/collections.ts` was matched to the picture as made
(it is the alt text). Known departures from the script: in panel 2 Toby
already wears the hi-vis vest; panel 10 doesn't show Toby, only the side
pipe Dev sends him into; panel 11's chalk is softened to be unreadable.

**Not in it**: a separate scene of someone watching Toby and Dev before the
attack (the implemented intake log still mentions two bikes on the ridge;
that's evidence, not a comic beat). Wade Mercer and the Weighbridge aren't
named; the attackers are the Ash Hounds.

## Shape

14 panels on 8 pages. Two-panel pages for the quick years, single big
panels for the turns that matter (meeting Dev's trust, losing him).

| Page | Panels | Beat | Feeling |
|---|---|---|---|
| 1 | 1, 2 | Before: Gerald, the dogs, Kerry | warm, ordinary |
| 2 | 3, 4 | The Ninth: woken at night; the bus | fear, a small act of mercy |
| 3 | 5, 6 | Northfield: three years; the argument | cramped, then rupture |
| 4 | 7, 8 | Kell Bridge: Ruth knows him; Dev takes him on | being seen |
| 5 | 9 | The gallery: "quicker than me" | pride, closeness |
| 6 | 10, 11 | 18 May: the attack; the chained valve | loss |
| 7 | 12, 13 | Calder: the dogs, repairs for food | making a life |
| 8 | 14 | The letter | resolve, hope |

Layouts: **wide** (full width), **pair** (two side by side on wide screens,
stacked on phones), **tall** (one panel filling the page).

## Script

Text kinds: **N** narration box, **S** speech balloon (with speaker), **W**
small whisper/aside. Text is HTML over the art, never in it.

### Page 1 · pair

**Panel 1.** *Calder, before the war. A suburban footpath, gum trees, brick
houses. Gerald (Cart 4) parked, face painted on its front, chime lights on.
Toby (11) kneels holding out scraps to Bigsy, Lady and Chips.*
- N: Calder, before. Toby Wren was eleven, and Cart 4 was his best friend.
- S Toby: Gerald's late again. Sorry, guys.

**Panel 2.** *FreshWay, a quiet evening. Kerry at till 2 in her polo; Toby
on an upturned crate behind her filling in his "Our Loop" worksheet, a
dog-food tin sticking out of his school bag.* **Object**: the worksheet (card 1).
- S Kerry: Dog food is not a school lunch, Tobes.
- S Toby: It's not for me.
- W Kerry: I know who it's for.

### Page 2 · pair

**Panel 3.** *The staff room, 3:40 a.m. Emergency light only. A radio on the
shelf. Kerry crouched by the chairs, one hand on Toby's shoulder; he's half
awake under her jacket. Behind them locker 6 open, the school photo taped
inside its door; on a cupboard door, his crayon drawing of the cart dogs.*
**Object**: the photo in Locker 6 (card 2), the crayon drawing (card 1).
- N: The Ninth. Twenty to four in the morning.
- S Kerry: Shoes on. Now. Don't ask, just shoes.

**Panel 4.** *The FreshWay car park, morning. The queue for Bus 2. Ruth with
a clipboard of carbon-copy lists, pencilling a note beside his name. Toby in
a hi-vis vest down to his knees, clutching a carrier bag; Kerry beside him.*
**Object**: the Bus 2 list (card 2).
- S Ruth: One bag each.
- S Toby: It's for the dogs.
- S Ruth: …Let him.

### Page 3 · pair

**Panel 5.** *Northfield showground. Rows of tents under the grandstand, a
ration queue. Toby (13) at a trestle table in a tent school, taking apart a
radio while the teacher talks, his laminated school card on a lanyard.*
**Object**: the school card (card 3).
- N: Northfield showground. Two thousand people, one meal a day, three years.
- N: He learned to fix anything anyone would let him open.

**Panel 6.** *Inside their tent, night, lamp light. Toby (14) with a pack on
his shoulder. Kerry standing between him and the flap, arms folded, tired.*
- S Kerry: There's nothing in Calder.
- S Toby: There's everything in Calder.
- N: He left with walkers heading for Kell Bridge before she woke. He didn't
  say goodbye properly.

### Page 4 · pair

**Panel 7.** *Kell Bridge exchange: a shed by the weir stacked with crates
and cartridges. Ruth (64) behind the counter, reading glasses down her nose,
looking up at Toby (14), road-dirty.*
- S Ruth: Kerry Wren's boy. You've grown into the vest.
- S Ruth: Dev needs hands. Go on.

**Panel 8.** *The weir plant. Dev at a bench packing a purifier cartridge;
Toby watching closely, sleeves pushed up.*
- S Dev: Quarter turn. Never more.
- S Toby: What happens if you do more?
- S Dev: You find out, and so does everyone downstream.

### Page 5 · tall

**Panel 9.** *The old works gallery under Calder's dam, by torchlight. Toby
(15) further down, clearing an intake screen in shallow water. In front, Dev
on a step writing in a logbook, his D.P. toolbag open beside him, watching
the boy work.* **Object**: the logbook (card 4).
- N: Every autumn they walked back to Calder to clear the intake, so Kell
  Bridge would have water.
- S Toby: Three and four, done. What's next?
- S Dev: Already? …The valve.
- N: Dev never said it out loud. He wrote it down.

### Page 6 · pair

**Panel 10.** *The gallery, torchlight from the far end. Grey-coated figures
in respirators, shapes only. Dev between them and Toby, one arm back, pushing
Toby toward a side pipe. Nothing graphic.*
- N: 18 May. The Ash Hounds wanted the water, and the way round the valve.
- S Dev: Pipe. Go. Don't stop.

**Panel 11.** *Days later. The valve wheel wrapped in chain, a yellow tag.
Toby (15) kneeling, writing on the wall in chalk, his back to us.*
**Object**: the chalk by the valve (card 5).
- N: Dev wouldn't show them the way round. So they chained the valve.
- N: Toby came back when they'd gone. He wrote down what happened, so
  someone would know.

### Page 7 · pair

**Panel 12.** *The mouth of the underpass, dusk. Gerald on its side, a solar
panel wired to a chime speaker. Toby (16) crouched by the bowls; the pack
around him at a wary distance, one big fallout-born dog closer than the
rest.*
- N: Calder. The dogs still came to Gerald's song. Not Bigsy. Maybe his
  grandchildren.
- S Toby: Easy. It's only me.

**Panel 13.** *The bus shelter at dusk. Toby (16) chalking a warning on the
inside wall and drawing a small dog beside it; his tool roll and a mended
radio on the bench. An empty highway outside.* **Object**: the chalk warning
(card 6). (The repair-for-food beat is carried by the mended radio and the
narration, not a second scene.)
- N: He fixes what people bring him. They pay in food.
- N: And he tells travellers where not to be.

### Page 8 · tall

**Panel 14.** *The Ruined Workshop at dawn. Toby (16) slipping a folded
letter, a note pinned to it, into a dented biscuit tin beside the office
door; names ticked in pencil on the lid. His face, finally, in the light.*
**Object**: the letter (card 7).
- N: Toby Wren is sixteen. He's alive, and he's staying until the valve is
  open.
- S Toby (reading as he writes): "Mum. This is the fourth one…" (shortened
  from the letter's first lines so the balloon clears his face; card 7 quotes
  the same words)
- N: Then he's going to Northfield. He promised.

## The letter

**[Proposed]** A new record and a seventh card.

- **Record** `toby-letter`, "Fourth letter", at the **Ruined Workshop**: the
  forwarding tin inside the office door, Look around 1st (the Workshop has no
  other records). Recent.
- **Chain of custody (writer's)**: Toby writes it at the camp, leaves it in
  the workshop's forwarding tin, which Mags runs as a drop-off; walkers
  heading to Northfield empty the tin and tick the lid. The player reads it
  and **puts it back**: recording it doesn't take it, and nothing in the
  game removes it.
- **Why it's legible**: folded in the tin, indoors; Toby left it unsealed with
  a note so walkers can see it isn't trade.
- **What you see**: a dented biscuit tin painted FORWARDING, inside the office
  door. On the lid, scratched in pencil: "NORTHFIELD: WREN ✓ WREN ✓ WREN ✓".
  Inside, one folded letter with a note pinned to it.
- **What it says**:
  - Note: "TO KERRY WREN, SHOWGROUND KITCHENS, NORTHFIELD. NOT SEALED,
    NOTHING TO STEAL. T"
  - Letter: "Mum, This is the fourth one. If you got the others you can skip
    the first bit. I'm OK. I'm back in Calder, I know you said not to. Dev
    died. The people with the yellow tags did it. I got out through the pipe
    and I'm not hurt anymore. I fix things for people, generators, pumps, a
    lady's heater, and they give me food. Dev said I was quicker than him. The
    dogs are still here. Not Bigsy, maybe his kids. They keep the tag people
    off me. I'm sorry about what I said when I left. You weren't keeping me in
    a tent for nothing. I just couldn't stay. If you write back, leave it in
    this tin. I'm staying till the valve's open. Then I'll come and see you.
    Promise. Toby"
- **Observed**: three earlier letters to Wren were collected; this one is
  waiting. **Claimed**: everything in the letter is Toby's account.
  **Unknown**: whether any reached Kerry; whether she'll answer.
- **People**: Toby, Kerry, Dev, (Mags, unnamed, as whoever runs the tin).
- **Connections**: with `locker-6` (Kerry Wren); `chained-valve` (Dev's
  death, the pipe); `chime-camp` (the dogs); `chalk-warning` (signed T).
- **Question it opens**: "Will Kerry answer?"
- **The answer, in canon** [Canon, 2026-10-10]: she did. The three earlier
  letters reached her in the showground kitchens. Walkers from Northfield go
  as far as Kell Bridge and no further, so she wrote back three times to
  "Toby Wren, care of R. Lane, Kell Bridge exchange — hold for him". She
  assumed Ruth would know where he was and didn't put Calder on the
  envelopes. Ruth holds them, sealed, and doesn't know Toby is in Calder;
  since 18 May she has feared he died with Dev. Toby thinks his mother never
  answered. Restoring contact is the player's "Help Toby" task
  ([characters.md](characters.md#toby-wren),
  [main-story.md](main-story.md#choices)).

### In the collection

- **Card 7, "Fourth letter"** (period: *Still writing*), unlocked by
  `toby-letter`.
- The set becomes seven cards. To keep everyone's progress:
  - cards already unlocked stay unlocked (they're read from records);
  - a player who **already completed** the six-card set keeps the comic and
    isn't paid again (their reward row stays; it's the only state);
  - a player who hasn't finished needs all seven for the comic and the XP.
- So for an existing finisher the page shows 6 of 7 with one back to find,
  which is a reason to visit the Workshop, without taking anything away.

## Card art

Superseded by revision 3: cards show their own object pictures, never
panels ([toby-collection.md](toby-collection.md#card-art)).

## For your review

- The script and dialogue above, especially Dev's last line and the ending.
- Ruth recognising Toby at Kell Bridge is the approved fate; she's on screen
  twice (the bus, the exchange).
- The letter's place (Mags's forwarding tin at the Workshop) relies on the
  drop-off, which is a proposed detail, not an approved fate.
- Seven cards instead of six, with the grandfathering above.
