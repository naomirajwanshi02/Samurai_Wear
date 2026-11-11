// The two suits and their parts. Words are written for readers aged 8–14: one short
// line for who wore it and one true fact. Every claim is sourced in SOURCES.md.

export const SUITS = [
  {
    id: 'tosei', name: 'Tōsei Gusoku', short: 'Tōsei', jp: '当世具足', kana: 'とうせいぐそく', era: '1500s–1800s',
    role: 'Foot-soldier era armour',
    blurb: '“Modern armour” from the age of the warring lords: an iron helmet bowl with rows of rivets, a wide neck guard and an iron face guard with a fierce red mouth.',
    fact: 'Many iron face guards (menpō) have a little hole or tube under the chin to let sweat drain out.',
    menpo: true,
    ref: 'assets/refs/tosei-ref.png',
  },
  {
    id: 'oyoroi', name: 'Ō-yoroi', short: 'Ō-yoroi', jp: '大鎧', kana: 'おおよろい', era: '900s–1300s',
    role: 'Mounted archer’s armour',
    blurb: 'The “great armour” of early samurai who fought on horseback with a bow. Its helmet has two tall golden horns called kuwagata.',
    fact: 'Japanese stag beetles are called kuwagata-mushi, because their jaws look like the golden horns on this helmet.',
    menpo: false,
    ref: 'assets/refs/oyoroi-ref.webp',
  },
];

export const BY_ID = Object.fromEntries(SUITS.map((s, i) => [s.id, { ...s, n: i + 1 }]));

// The parts named on the "Did you know?" cards, in the order the tips cycle through.
export const PARTS = [
  { name: 'Kabuto', jp: '兜', text: 'the helmet. Its round bowl (hachi) is made of curved iron plates riveted together.' },
  { name: 'Shikoro', jp: '錣', text: 'the neck guard: rows of lacquered plates laced together that hang round the back and sides of the head.' },
  { name: 'Fukigaeshi', jp: '吹返', text: 'the turned-back flaps beside the face. They stop a sword sliding down onto the neck laces.' },
  { name: 'Menpō', jp: '面頬', text: 'the iron face guard. Fierce faces and moustaches were meant to scare the enemy.' },
  { name: 'Odoshi', jp: '縅', text: 'the silk lacing that holds the plates together. Blue is kon-ito, red is aka-ito.' },
  { name: 'Sode', jp: '袖', text: 'the big shoulder guards. On horseback they worked like small shields against arrows.' },
  { name: 'Tehen', jp: '天辺', text: 'the small hole at the very top of the helmet bowl, finished with a gilt ring.' },
];

export const EXTRA_FACTS = [
  'On Children’s Day (5 May) many Japanese families put out a small helmet or suit of armour to wish their children health and strength.',
  'An ō-yoroi suit could weigh about 25–30 kg, about as much as a big dog!',
  'Mounted archery, yabusame, is still performed in Japan today, with riders shooting at targets at full gallop.',
];
