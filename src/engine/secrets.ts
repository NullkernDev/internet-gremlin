export interface Secret {
  id: string;
  name: string;
  /** Shown once discovered. */
  description: string;
  /** Vague hint shown while still locked. */
  hint: string;
}

export const SECRETS: Secret[] = [
  { id: 'stare', name: 'The Stare', description: 'It looked directly at you. Through the screen.', hint: 'Sometimes it just… looks.' },
  { id: 'golden', name: 'Golden Gaze', description: 'A very rare golden-eye moment.', hint: 'Rare. Shiny. Eyes.' },
  { id: 'possum', name: 'Possum Mode', description: 'Poked it while asleep and it pretended not to notice.', hint: 'Wake a sleeping gremlin. Maybe.' },
  { id: 'jealous', name: 'Other Tabs', description: 'Came back after a while elsewhere. It noticed.', hint: 'Leave its tab for a bit.' },
  { id: 'nonsequitur', name: 'Non Sequitur', description: 'It said something deeply unexpected.', hint: 'Just keep it company.' },
  { id: 'marathon', name: 'Marathon', description: 'Celebrated a long, focused session.', hint: 'Stick around. Like, a while.' },
  { id: 'dance', name: 'Tiny Dance', description: 'Busted out a tiny dance.', hint: 'Happy gremlins move.' },
  { id: 'manager', name: 'Middle Management', description: 'Poked so much it threatened to become your manager.', hint: 'Poke. Poke. Poke…' },
  { id: 'handshake', name: 'Secret Handshake', description: 'Poke, poke, pet, poke.', hint: 'A ritual of four touches.' },
  { id: 'teleport', name: 'Blink', description: 'It glitched out and reappeared somewhere else.', hint: 'Keep an eye on it. Or don’t.' },
  { id: 'note', name: 'While You Were Out', description: 'It left you a sticky note after you were away.', hint: 'Walk away for a while.' },
  { id: 'shy', name: 'Shy', description: 'Ducked when your cursor rushed at it.', hint: 'Approach… quickly.' },
  { id: 'tornado', name: 'Tab Tornado', description: 'Switched tabs so fast it got dizzy.', hint: 'Tab, tab, tab, tab, tab.' },
  { id: 'washer', name: 'Spin Cycle', description: 'Dragged it around in circles.', hint: 'Take it for a spin.' },
  { id: 'midnight', name: 'Witching Hour', description: 'Kept it company after midnight.', hint: 'Late. Very late.' },
  { id: 'balloon', name: 'Balloon', description: 'Overfed it. It forgave you.', hint: 'Snacks. Many snacks.' },
  { id: 'speedrun', name: 'Speedrunner', description: 'Under 250 ms in the reaction game.', hint: 'Be fast. Inhumanly fast.' },
];

export const SECRET_IDS = new Set(SECRETS.map((s) => s.id));
