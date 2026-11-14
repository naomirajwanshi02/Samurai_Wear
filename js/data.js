// The suit and its parts. Words are written for readers aged 8–14. Every claim is sourced in SOURCES.md.

export const SUITS = [
  {
    id: 'gusoku', name: 'Gusoku', short: 'Gusoku', jp: '具足', kana: 'ぐそく', era: 'c. 1650 · Edo period',
    role: 'The Met, New York',
    blurb: 'A samurai’s full armour from about 1650, now at the Metropolitan Museum of Art in New York. Its helmet is signed by the armourer Saotome Ietada.',
    fact: 'The museum lists “hair” among this armour’s materials: that is the white moustache on the iron face mask!',
    menpo: true,
    ref: 'assets/refs/gusoku-1650-ref.jpg',
  },
];

export const BY_ID = Object.fromEntries(SUITS.map((s, i) => [s.id, { ...s, n: i + 1 }]));

// The parts named on the "Did you know?" cards, in the order the tips cycle through.
export const PARTS = [
  { name: 'Kabuto', jp: '兜', text: 'the helmet. Its bowl is made of curved iron plates, lacquered black.' },
  { name: 'Kuwagata', jp: '鍬形', text: 'the wide golden crest on the front, shaped like a crescent with flared tips.' },
  { name: 'Menpō', jp: '面頬', text: 'the iron face mask. Fierce faces and big moustaches were meant to scare the enemy.' },
  { name: 'Fukigaeshi', jp: '吹返', text: 'the big flaps beside the face, here black with silver scrolls and gold studs.' },
  { name: 'Shikoro', jp: '錣', text: 'the neck guard: rows of plates spreading out like an umbrella over the shoulders.' },
  { name: 'Shinobi-no-o', jp: '忍緒', text: 'the silk cords that tie the helmet on, crossed and knotted under the chin.' },
  { name: 'Dō', jp: '胴', text: 'the body armour. This one has a brown panel on the chest with a silver dragon flying through clouds.' },
  { name: 'Sode', jp: '袖', text: 'the shoulder guards, made of rows of plates laced together with silk.' },
  { name: 'Kusazuri', jp: '草摺', text: 'the skirt of laced panels that protects the hips and thighs but still lets you walk.' },
  { name: 'Haidate', jp: '佩楯', text: 'the thigh guard under the skirt, covered in tiny plates, with a knee plate on each side.' },
];

export const EXTRA_FACTS = [
  'In the Edo period (1603–1868) Japan was mostly at peace, so armour like this was often worn for parades and ceremonies.',
  'The Saotome were a famous school of armourers, known for helmet bowls made of many ridged iron plates, often 62!',
  'On Children’s Day (5 May) many Japanese families put out a small helmet or suit of armour to wish their children health and strength.',
];
