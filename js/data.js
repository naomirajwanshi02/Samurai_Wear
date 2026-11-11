// The suit and its parts. Words are written for readers aged 8–14: one short line for who
// wore it and true facts. Every claim is sourced in SOURCES.md.

export const SUITS = [
  {
    id: 'oyoroi', name: 'Ō-yoroi', short: 'Ō-yoroi', jp: '大鎧', kana: 'おおよろい', era: '900s–1300s',
    role: 'Mounted archer’s armour',
    blurb: 'The “great armour” of the first samurai, who fought on horseback with a bow. Its helmet has two tall golden horns called kuwagata.',
    fact: 'Japanese stag beetles are called kuwagata-mushi, because their jaws look like the golden horns on this helmet.',
    menpo: true,
    ref: 'assets/refs/oyoroi-ref.webp',
  },
];

export const BY_ID = Object.fromEntries(SUITS.map((s, i) => [s.id, { ...s, n: i + 1 }]));

// The parts named on the "Did you know?" cards, in the order the tips cycle through.
export const PARTS = [
  { name: 'Hoshi kabuto', jp: '星兜', text: 'the “star helmet”: its bowl is iron plates joined with big raised rivets that stick out like stars.' },
  { name: 'Kuwagata', jp: '鍬形', text: 'the two tall golden horns, standing on a base on the visor that is decorated with a lion’s face.' },
  { name: 'Shinodare', jp: '篠垂', text: 'the golden strips with arrow-shaped tips running down the front and back of the helmet bowl.' },
  { name: 'Tehen', jp: '天辺', text: 'the big hole at the top of the helmet. Early samurai pulled their topknot of hair through it!' },
  { name: 'Fukigaeshi', jp: '吹返', text: 'the big flaps beside the face: the ends of the neck guard’s lames, turned back and faced with patterned leather.' },
  { name: 'Shikoro', jp: '錣', text: 'the neck guard: five rows of little plates laced together with red silk, hanging down round the back of the head.' },
  { name: 'Happuri', jp: '半首', text: 'the iron face guard of the time. It covers the forehead and cheeks and leaves the eyes, nose and mouth open.' },
  { name: 'Ō-sode', jp: '大袖', text: 'the huge shoulder guards. On horseback they worked like small shields against arrows.' },
  { name: 'Tsurubashiri', jp: '弦走', text: 'the patterned leather on the front of the armour, so the bowstring would not catch on the lacing.' },
  { name: 'Sendan-no-ita and Kyūbi-no-ita', jp: '栴檀板・鳩尾板', text: 'the two little guards that hang in front of the armpits: laced plates on the right, one solid plate on the left.' },
];

export const EXTRA_FACTS = [
  'An ō-yoroi was made from about 2,000 tiny plates (kozane) and weighed about 30 kg, about as much as a big dog!',
  'The flaps on the helmet were so big that the archer Nasu no Yoichi is said to have taken his helmet off to shoot his most famous arrow.',
  'Mounted archery, yabusame, is still performed in Japan today, with riders shooting at targets at full gallop.',
  'On Children’s Day (5 May) many Japanese families put out a small helmet or suit of armour to wish their children health and strength.',
];
