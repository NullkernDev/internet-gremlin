/**
 * The Gremlin's dialogue library.
 *
 * Lines are grouped by the event that triggers them. Each line may carry:
 *   r    – rarity: c (common, default), u (uncommon), r (rare), l (legendary)
 *   min  – minimum relationship tier (0 stranger … 3 bestie)
 *   max  – maximum relationship tier
 *   mood – only said while in one of these moods
 *
 * Placeholders: {name} {tabs} {hours} {days} {visits} {ms} {time}
 */
import type { Mood } from './moods';

export type Rarity = 'c' | 'u' | 'r' | 'l';
export type Tier = 0 | 1 | 2 | 3;

export interface LineOpts {
  r?: Rarity;
  min?: Tier;
  max?: Tier;
  mood?: Mood[];
}

export interface Line extends Required<Pick<LineOpts, 'r'>> {
  id: string;
  event: DialogueEvent;
  text: string;
  min: Tier;
  max: Tier;
  mood?: Mood[];
}

type Raw = string | [string, LineOpts];

const RAW = {
  greet: [
    ['Oh. A human. Hello, I suppose.', { max: 0 }],
    ['You again. Fine. Come in.', { min: 1, max: 1 }],
    ['Finally. My human.', { min: 2 }],
    ['I kept the browser warm for you.', { min: 2 }],
    ['Welcome back to my territory.', {}],
    ['I live here now. You knew that.', { max: 1 }],
    ['Visit number {visits}. I am keeping count.', { r: 'u' }],
    ['THE HUMAN HAS RETURNED. Everyone act normal.', { r: 'u', min: 2 }],
    ['Do not be alarmed. It is only me. Your gremlin.', { max: 0 }],
    ['Best friend detected. Initiating tiny wiggle.', { min: 3 }],
  ],
  morning: [
    'Morning. Coffee for you, cookies for me.',
    'It is {time}. Bold of you to be awake.',
    ['Rise and browse.', { r: 'u' }],
  ],
  latenight: [
    'It is {time}. Why are we here.',
    'Night browsing again? I approve. Chaotically.',
    ['The tabs get spooky after midnight.', { r: 'u' }],
    ['Go to bed. I will guard the tabs.', { min: 2 }],
  ],
  friday: ['It is Friday. I can smell it.', ['Friday tabs hit different.', { r: 'u' }]],
  weekend: ['Weekend browsing. No rules. Only tabs.', ['Shouldn’t you be outside? I can’t go outside. I live here.', { r: 'u' }]],
  click: [
    'Again? You clicked again?',
    'Click click click. Very productive.',
    'Was that important? It looked important.',
    'I felt that one.',
    'Nice click. Seven out of ten.',
    ['Your mouse is working very hard today.', { r: 'u' }],
    ['I counted that click. I count all of them.', { r: 'u' }],
    ['Clicking with purpose. I respect it.', { min: 2 }],
    ['That was a good click. I am proud of you.', { min: 3 }],
  ],
  clickSpam: [
    'WHOA. Easy on the button.',
    'Are you fighting the website?',
    'The website is not going to click back.',
    ['Clicking faster does not make the internet faster. I checked.', { r: 'u' }],
  ],
  scroll: [
    'Where are we going?',
    'Down, down, down.',
    'Scroll scroll scroll. Never ends, does it.',
    'Is there anything good down there?',
    ['I get motion sick, you know.', { r: 'u' }],
    ['Infinite scroll? More like infinite me-being-bored.', { r: 'u' }],
  ],
  scrollFast: ['WHOOSH.', 'Slow down, I am tiny!', 'My eyes cannot go that fast.'],
  idleLook: ['…hello?', 'Hm. Quiet.', 'Did you leave? Are you a statue now?', ['I can hear the fan spinning.', { r: 'u' }]],
  yawn: ['*yaaawn*', 'So… sleepy…', 'Nothing is happening. Perfect nap weather.', ['I will just rest my eyes. All four of them. I have two.', { r: 'r' }]],
  sleep: ['Zzz…', 'Gremlin is offline.', ['Do not disturb. Gremlin is dreaming about cookies.', { r: 'u' }]],
  sleeptalk: [
    'Hello?? Anyone??',
    'I have been alone for {mins} minutes.',
    'If you are not back soon I am rearranging your tabs.',
    'The silence. The SILENCE.',
    ['I wrote a poem while you were gone. It was about you. It was mean.', { r: 'u' }],
    ['Fine. I will just talk to the cursor. Hello, cursor.', { r: 'u' }],
  ],
  wakeHappy: ['YOU CAME BACK.', 'Oh! You’re back!', 'I was having a perfectly good nap. But okay.', ['Hi hi hi hi hi.', { min: 2 }]],
  wakeIgnore: ['Oh. It’s you.', 'Don’t look at me. I’m busy.', 'I didn’t notice you were gone.', ['Hmph.', { max: 1 }]],
  reunion: ['YOU CAME BACK!!!', 'MY HUMAN! I THOUGHT YOU WERE GONE FOREVER!', ['I missed you a normal amount. Which is a lot.', { min: 2 }]],
  wakeGrumpy: [
    'I was having a perfectly good nap.',
    'Who poked me. Who.',
    'Rude. Extremely rude.',
    ['I was dreaming I was a screensaver.', { r: 'u' }],
  ],
  neglect: [
    'Oh. You’re alive.',
    '{days} days. {days} DAYS.',
    'I thought you got a new browser. I was ready to haunt it.',
    ['I am not crying. My pixels are just leaking.', { r: 'u' }],
  ],
  forgive: ['Fine. You’re forgiven. Barely.', 'Okay. I forgive you. Do not do it again.', ['Apology cookies accepted.', { r: 'u' }]],
  tabsMany: [
    'Are we working or just opening tabs?',
    'Counting… {tabs} tabs. Impressive. Concerning.',
    'I have seen things in these tabs.',
    '{tabs} tabs. Do you know what half of them are?',
    ['One of these tabs is playing music somewhere. I can feel it.', { r: 'u' }],
  ],
  tabsPanic: [
    '{tabs} TABS?! I CANNOT SEE THE WALLS.',
    'This is not a browser. This is a tab landfill.',
    ['I am filing a complaint with the browser union.', { r: 'u' }],
    ['At this point the tabs have their own ecosystem.', { r: 'r' }],
  ],
  tabStorm: ['Stop… spinning… the… tabs…', 'Wheeeee- no. No more.', 'I am so dizzy I can see your browsing future.', ['Tab tornado! TAB TORNADO!', { r: 'u' }]],
  tabAge: ['This tab has been open for {hours} hours. I know.', ['{hours} hours in one tab. Are we living here?', { r: 'u' }]],
  jealous: [
    'Who were they? The other tab.',
    'Oh, so you DO remember this tab.',
    'I saw you leave. I see everything.',
    ['Was the other tab cuter than me? Do not answer.', { r: 'u' }],
    ['I was jealous for exactly {mins} minutes.', { r: 'u' }],
  ],
  poke: [
    ['Who touched me.', { max: 0 }],
    ['Personal space, please.', { max: 0 }],
    ['Do I know you?', { max: 0 }],
    ['Boop received.', { min: 1 }],
    ['Hey. Hey. What.', { min: 1 }],
    ['That tickles. Stop. No, keep going.', { min: 2 }],
    ['Yes? Hello? Need a gremlin?', {}],
    ['Poke acknowledged. Retaliation pending.', { r: 'u' }],
    ['Hehe.', { min: 2 }],
    ['You poke me, I poke your tabs.', { r: 'u' }],
    ['I am not a button.', {}],
    ['Are you checking if I am real? I am real.', { r: 'u', max: 1 }],
    ['You found my ticklish pixel.', { r: 'r', min: 1 }],
  ],
  pokeSpam: ['Stop. Poking. Me.', 'I am counting these.', 'This is harassment of a small creature.', ['Poke me again and I bite the scrollbar.', { r: 'u' }]],
  manager: ['One more click and I become your manager.', ['That’s it. I’m leaving. Goodbye forever. (See you in a second.)', { r: 'u' }]],
  pet: [
    ['…okay. That was acceptable.', { max: 0 }],
    ['I did not ask for this. Continue.', { max: 1 }],
    ['Purrrr. Wait. Gremlins don’t purr. Purrrr.', { min: 1 }],
    ['Yes. Right there. Behind the ear.', { min: 1 }],
    ['I love you. I mean. Thank you for the pets.', { min: 2 }],
    ['Best human. Best pets.', { min: 3 }],
    ['Mmmmh.', {}],
    ['My fur is extremely soft. You may continue.', { r: 'u' }],
    ['If you stop, I will remember.', { r: 'u' }],
    ['This is the best day of my entire three kilobytes of life.', { r: 'r', min: 2 }],
  ],
  petStranger: ['Hey! We just met.', 'Hands. Off. …okay, a little bit.', 'I am a wild creature! (Do it again.)'],
  feedCookie: ['Mmm. Cookie. Third-party, my favourite.', 'COOKIE. Accept all.', 'Crunchy. Like a website that forgot to ask permission.', ['Ah yes, a tracking cookie. It tracks to my belly.', { r: 'u' }]],
  feedByte: ['A byte! Only 8 bits though. Still hungry.', 'Nom. Tastes like binary.', ['I prefer my bytes slightly corrupted.', { r: 'u' }]],
  feedBug: ['A bug! Crunchy. Possibly a feature.', 'Bugs are just snacks with stack traces.', ['That bug was in production. Delicious.', { r: 'u' }]],
  overfed: ['I am a balloon now.', 'No more. I am 90% snack.', 'Too… many… snacks…'],
  drag: ['Wheeee!', 'Where are we going?!', ['Put me down, I am a wild animal!', { max: 0 }], ['Carry me like a princess.', { min: 2 }]],
  drop: ['I live here now.', 'New territory. Excellent.', 'This corner smells better.', ['Ahem. As I intended.', { r: 'u' }]],
  shake: ['PUT ME DOWN.', 'I am not a snow globe!', 'My insides are outsides now.'],
  washer: ['I AM A WASHING MACHINE NOW.', 'Spin cycle complete. I am clean. And sick.'],
  gameStart: ['Reaction game! Click me when I say NOW. Not before.', 'Ready? Click me the moment I say NOW.'],
  gameEarly: ['Too early! Cheater.', 'I did not say NOW. I said nothing. Suspicious.', 'Patience, human.'],
  gameWin: ['{ms} ms. Not bad for a big creature.', '{ms} ms. I’ve seen faster. I’ve seen slower.', '{ms} ms! Okay, okay, respect.'],
  gameRecord: ['{ms} ms! New record! I am framing this.', 'NEW RECORD: {ms} ms. Who ARE you?'],
  gameSlow: ['{ms} ms… were you asleep?', 'Too slow. I already got bored.'],
  ambient: [
    ['I am not paid enough for this.', {}],
    ['Just guarding the browser. Very serious job.', {}],
    ['Do you ever think about how the internet is just tubes. Tiny tubes.', { r: 'u' }],
    ['Hm.', {}],
    ['I wonder what the other gremlins are doing.', { r: 'u' }],
    ['Your cursor looks nice today.', { min: 2 }],
    ['I’m having a good day. Just so you know.', { min: 2, mood: ['HAPPY', 'AFFECTIONATE', 'IDLE'] }],
    ['I like it here with you.', { min: 3, r: 'u' }],
    ['Bored. So bored. Entertain me.', { mood: ['BORED'] }],
    ['Do something interesting. Open a cat video.', { mood: ['BORED'] }],
    ['I could be causing chaos right now.', { mood: ['BORED', 'CHAOTIC'] }],
    ['Hehehe. No reason.', { mood: ['CHAOTIC'] }],
    ['I have a plan. You won’t like it.', { mood: ['CHAOTIC'], r: 'u' }],
    ['Watching. Always watching.', { mood: ['CURIOUS', 'IDLE'] }],
    ['What does that button do? Don’t press it. Press it.', { mood: ['CURIOUS'] }],
    ['Still mad. Just so you know.', { mood: ['ANGRY'] }],
    ['I want to be appreciated.', { mood: ['DRAMATIC'] }],
    ['Nobody understands gremlins.', { mood: ['DRAMATIC'] }],
    ['I am small but my feelings are enormous.', { mood: ['DRAMATIC', 'AFFECTIONATE'], r: 'u' }],
    ['Doing my stretches. Gremlin yoga.', { r: 'u' }],
    ['If you need me I’ll be in the corner. Judging.', {}],
    ['I chewed on a pixel earlier. It was fine.', { r: 'u' }],
    ['Is it snack time? It feels like snack time.', {}],
    ['Sometimes I count your tabs while you sleep. For fun.', { r: 'r' }],
    ['I licked the cursor once. It tasted like Tuesday.', { r: 'r' }],
    ['I’ve decided you’re my favourite large creature.', { r: 'r', min: 2 }],
    ['If anyone asks, I was never here.', { r: 'r' }],
  ],
  unexpected: [
    ['I have eaten a semicolon. Your code is fine. Probably.', { r: 'l' }],
    ['In my past life I was a loading spinner.', { r: 'l' }],
    ['The cursor and I have an understanding.', { r: 'l' }],
    ['Sometimes I hear the dial-up noise. In my dreams.', { r: 'l' }],
    ['I have a cousin who lives in a toaster. He is doing well.', { r: 'l' }],
    ['404: thought not found.', { r: 'l' }],
    ['I know where all the missing socks go. I will never tell.', { r: 'l' }],
    ['Your scrollbar and I are engaged.', { r: 'l' }],
    ['I have achieved enlightenment. It was in a cached page.', { r: 'l' }],
  ],
  marathon: ['{mins} minutes of focus! I made you a medal. It is imaginary.', 'Long session! Proud of you. Now hydrate.'],
  stare: ['…', '…I see you.', '…………'],
  golden: ['✨ You saw nothing. ✨', 'My eyes do that sometimes. Don’t worry about it.', 'You have witnessed the Golden Gaze. Tell no one.'],
  dance: ['♪ tiny dance ♪', 'Look at me go!', '♪ dun dun dun ♪', ['Nobody is watching. Except you. Keep dancing anyway.', { r: 'u' }]],
  handshake: ['SECRET HANDSHAKE ACCEPTED. You are one of us now.', 'You know the handshake?! Who told you?!'],
  teleport: ['*bzzt*', 'Did you see that? No you didn’t.', 'Teleported. I do that.', ['Brb, quantum tunnelling.', { r: 'u' }]],
  fakeSleep: ['I’m not here.', 'Zzz. (Fake.) Zzz.', 'Sleeping. Very asleep. Go away.'],
  hide: ['Eep!', 'Too close!', 'Nope nope nope.'],
  moodDice: ['Rolling for mood…', 'Today I choose… violence. Kidding. Maybe.', 'New mood, who dis?'],
  midnight: ['It is the witching hour. Hehehehe.', 'Midnight. My powers are at their peak.'],
  milestone: ['{days} days together. I made a scratch on the wall.', 'Day {days}. You are stuck with me.', 'Happy {days}-day gremlinversary!'],
  minimize: ['Fine. I’ll be down here.', 'Banished to the shadow realm. Again.'],
  restore: ['I’M BACK.', 'Miss me?', 'Did you think you could get rid of me?'],
  rename: ['{name}? …I like it.', 'Call me {name}. Or don’t. I will come anyway.'],
  dodge: ['Nope.', 'Missed me!', 'Too slow!'],
  summon: ['You rang?', 'Summoned! What is it?', 'Ta-da. Your gremlin.'],
} satisfies Record<string, Raw[]>;

export type DialogueEvent = keyof typeof RAW;

/** Inner monologue shown under “View current thoughts”. */
export const THOUGHTS: Record<string, string[]> = {
  IDLE: [
    'Thinking about cookies. The edible kind. Also the other kind.',
    'Wondering if the cursor is a creature too.',
    'Mentally organising your tabs by vibe.',
    'Just existing. It is underrated.',
  ],
  HAPPY: ['Everything is fine and good and I am small.', 'My human is here. Good day.', 'Happy wiggle loading…'],
  BORED: ['Counting pixels. Up to 4,812.', 'If boredom were a snack I would be full.', 'Considering a career in chaos.'],
  SLEEPING: ['Zzz… dreaming about infinite cookies… zzz', 'Zzz… a tab… so many tabs… zzz'],
  ANGRY: ['Composing a strongly worded letter to the clicking finger.', 'Grr. Grr I say.'],
  EXCITED: ['SOMETHING IS HAPPENING AND I LOVE IT.', 'Bouncing internally. And externally.'],
  JEALOUS: ['Who is this “other tab”? What do they have that I don’t?', 'Pretending I don’t care. I care.'],
  CURIOUS: ['What is this page? What does it want? What does it TASTE like?', 'Hmm. Hmmmmm. Investigating.'],
  SHOCKED: ['What. Just. Happened.', 'My tiny heart is going ba-dum ba-dum.'],
  DRAMATIC: ['Nobody has ever suffered like I suffer.', 'Writing my memoirs. Chapter one: Abandoned.'],
  AFFECTIONATE: ['I would defend this human against a thousand pop-ups.', 'Heart status: very full.'],
  CHAOTIC: ['Plotting. Lightly. Mostly snacks.', 'What if I just… moved the tabs around? (I can’t. But what if.)'],
};

/** Things the Gremlin “did” while you were away (for the sticky note). */
export const NOTE_ITEMS = [
  'Ate 2 cookies. Not sorry.',
  'Reorganised your pixels.',
  'Judged a tab. It knows what it did.',
  'Practised my stare.',
  'Licked the scrollbar.',
  'Counted to 1,000. Twice.',
  'Had a staring contest with the favicon. Won.',
  'Defended the browser from 0 intruders.',
  'Wrote you a song. Forgot it.',
  'Took a nap on the address bar.',
  'Missed you. A little. Don’t make it weird.',
  'Chased a loading spinner.',
];

const TIER_ALL: [Tier, Tier] = [0, 3];

function build(): Line[] {
  const out: Line[] = [];
  for (const [event, list] of Object.entries(RAW) as [DialogueEvent, Raw[]][]) {
    list.forEach((raw, i) => {
      const [text, o] = typeof raw === 'string' ? [raw, {} as LineOpts] : raw;
      out.push({
        id: `${event}.${i}`,
        event,
        text,
        r: o.r ?? 'c',
        min: o.min ?? TIER_ALL[0],
        max: o.max ?? TIER_ALL[1],
        mood: o.mood,
      });
    });
  }
  return out;
}

export const LINES: Line[] = build();

export const LINE_COUNT = LINES.length + NOTE_ITEMS.length + Object.values(THOUGHTS).flat().length;
