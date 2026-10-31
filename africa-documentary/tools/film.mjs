// Shot list, narration and on-screen cards for
// "AFRICA: THE UNTOLD STORY – FROM ANCIENT KINGDOMS TO A NEW GENERATION".
// tools/build.mjs turns this into index.html + compositions/*.html.
//
// Beat fields:
//   shot   { src, from:[scale,x%,y%], to:[scale,x%,y%], pos }  still image with a camera move
//   ground "pattern"|"black"                                     a drawn ground instead of an image
//   enter  "dissolve" | "cut" | "dip"                            how the beat arrives
//   lead   seconds before the first narration phrase
//   vo     [[id, text], …]                                       narration phrases (one TTS clip each)
//   tail   seconds held after the last phrase
//   min    minimum beat length; "fill" takes what is left of the 60 s chapter
//   presenter true                                               an on-camera presenter shot (avatar goes here)
//   cards  on-screen typography, timed against the beat or a phrase

export const CHAPTER = 60;

export const scenes = [
  {
    id: "ch1",
    beats: [
      {
        id: "sun",
        shot: { src: "assets/img/savannah-sunset.jpg", from: [1.0, 0, 0], to: [1.14, 4, 1] },
        enter: "dip",
        lead: 5.0,
        vo: [
          ["a1", "Before the world knew its modern borders,"],
          ["a2", "before the rise of many civilizations,"],
          ["a3", "there was Africa."],
        ],
        tail: 2.6,
        cards: [
          { kind: "chapter", at: 1.0, dur: 3.6, num: "Chapter I", title: "The Beginning" },
          { kind: "bigword", phrase: "a3", offset: 0.55, untilEnd: true, text: "AFRICA" },
        ],
      },
      {
        id: "story",
        shot: { src: "assets/img/storyteller-fire.jpg", from: [1.08, 0, 2], to: [1.0, 0, 0], pos: "50% 45%" },
        enter: "dissolve",
        lead: 0.4,
        vo: [
          ["a4", "A continent of extraordinary beginnings,"],
          ["a5", "ancient wisdom,"],
        ],
        tail: 0.8,
      },
      {
        id: "elder",
        shot: { src: "assets/img/elder-cap.jpg", from: [1.0, -2, 0], to: [1.08, 1, 0], pos: "50% 30%" },
        enter: "dissolve",
        lead: 0.3,
        vo: [["a6", "rich cultures and remarkable people."]],
        tail: 1.4,
        min: 5,
      },
      {
        id: "host1",
        presenter: true,
        shot: { src: "assets/img/presenter-crop.jpg", from: [1.0, 0, 0], to: [1.06, 0, 1], pos: "50% 30%" },
        enter: "cut",
        lead: 1.0,
        vo: [
          ["a7", "Africa is not simply a place on the map."],
          ["a8", "It is one of humanity's oldest homes,"],
          ["a9", "and its story is one the world must never forget."],
        ],
        tail: 1.6,
      },
      {
        id: "title",
        shot: { src: "assets/img/thumbnail.png", from: [1.0, 0, 0], to: [1.05, -1, 0] },
        enter: "dissolve",
        min: 10,
      },
      {
        id: "herd",
        shot: { src: "assets/img/savannah-sunset.jpg", from: [1.3, 8, 6], to: [1.18, -6, 6], pos: "50% 70%" },
        enter: "dissolve",
        min: "fill",
      },
    ],
  },
  {
    id: "ch2",
    beats: [
      {
        id: "kush",
        shot: { src: "assets/img/kush-procession.jpg", from: [1.12, 3, 2], to: [1.0, 0, 0] },
        enter: "dip",
        lead: 5.0,
        vo: [
          ["b1", "Across centuries, Africa built powerful kingdoms"],
          ["b2", "and thriving civilizations."],
        ],
        tail: 3.6,
        cards: [
          { kind: "chapter", at: 0.8, dur: 3.6, num: "Chapter II", title: "The Great Kingdoms" },
          { kind: "lower", after: "b2", offset: 0.2, dur: 3.2, name: "Kingdom of Kush", sub: "Nubia · c. 1070 BC – AD 350" },
        ],
      },
      {
        id: "mali",
        shot: { src: "assets/img/timbuktu-market.jpg", from: [1.0, 0, 0], to: [1.1, -3, -1] },
        enter: "dissolve",
        lead: 0.4,
        vo: [["b3", "From the wealth of Mali under Mansa Musa"]],
        tail: 1.6,
        min: 6,
        cards: [{ kind: "lower", phrase: "b3", offset: 0.6, untilEnd: true, name: "Mali Empire", sub: "Mansa Musa · reigned c. 1312 – 1337" }],
      },
      {
        id: "benin",
        ground: "pattern",
        enter: "cut",
        lead: 0.3,
        vo: [["b4", "to the artistic achievements of Benin,"]],
        min: 5,
        cards: [{ kind: "kingdom", phrase: "b4", offset: 0.9, untilEnd: true, name: "Kingdom of Benin", dates: "c. 1180 – 1897", note: "Celebrated for its bronze and ivory art" }],
      },
      {
        id: "egypt",
        ground: "pattern",
        enter: "cut",
        lead: 0.3,
        vo: [["b5", "from the ancient monuments of Egypt,"]],
        min: 5,
        cards: [{ kind: "kingdom", phrase: "b5", offset: 0.9, untilEnd: true, name: "Ancient Egypt", dates: "c. 3100 – 30 BC", note: "Pyramids, temples and one of the first writing systems" }],
      },
      {
        id: "zimbabwe",
        ground: "pattern",
        enter: "cut",
        lead: 0.3,
        vo: [["b6", "to the impressive stone structures of Great Zimbabwe,"]],
        min: 5,
        cards: [{ kind: "kingdom", phrase: "b6", offset: 1.4, untilEnd: true, name: "Great Zimbabwe", dates: "c. 1100 – 1450", note: "Granite walls raised without mortar" }],
      },
      {
        id: "throne",
        shot: { src: "assets/img/mansa-musa-throne.jpg", from: [1.0, 0, 0], to: [1.1, 0, 3], pos: "50% 35%" },
        enter: "dissolve",
        lead: 0.6,
        vo: [["b7", "African societies developed systems of trade, education, governance,"]],
        tail: 1.4,
        min: 7,
        cards: [{ kind: "words", phrase: "b7", words: [["Trade", 0.55], ["Education", 0.72], ["Governance", 0.9]] }],
      },
      {
        id: "host2",
        presenter: true,
        shot: { src: "assets/img/presenter-crop.jpg", from: [1.06, 0, 1], to: [1.0, 0, 0], pos: "50% 30%" },
        enter: "cut",
        lead: 0.5,
        vo: [["b8", "architecture and culture that shaped history."]],
        tail: 1.4,
        min: 6,
      },
      {
        id: "songhai",
        shot: { src: "assets/img/mali-cavalry.jpg", from: [1.0, 0, 0], to: [1.16, -4, 4], pos: "50% 40%" },
        enter: "dissolve",
        min: "fill",
        cards: [{ kind: "lower", at: 1.4, dur: 5.0, name: "Songhai Empire", sub: "Gao · c. 1464 – 1591" }],
      },
    ],
  },
  {
    id: "ch3",
    beats: [
      {
        id: "arrival",
        shot: { src: "assets/img/colonial-encounter.jpg", from: [1.0, 0, 0], to: [1.08, -2, 0] },
        enter: "dip",
        lead: 5.0,
        vo: [["c1", "But Africa's journey was not without suffering."]],
        tail: 1.2,
        cards: [{ kind: "chapter", at: 0.8, dur: 3.6, num: "Chapter III", title: "The Struggle for Freedom" }],
      },
      {
        id: "berlin",
        shot: { src: "assets/img/colonial-encounter.jpg", from: [1.35, -14, -4], to: [1.45, -16, -5] },
        enter: "cut",
        lead: 0.3,
        vo: [
          ["c2", "Colonialism disrupted communities,"],
          ["c3", "divided territories and exploited resources."],
        ],
        tail: 1.6,
        min: 7,
        cards: [{ kind: "lower", phrase: "c3", offset: 0.0, untilEnd: true, name: "The Berlin Conference · 1884–85", sub: "European powers divide Africa among themselves" }],
      },
      {
        id: "zulu",
        shot: { src: "assets/img/zulu-warriors.jpg", from: [1.12, 0, 0], to: [1.0, 0, 0] },
        enter: "dip",
        lead: 0.6,
        vo: [["c4", "Yet African people resisted."]],
        tail: 2.2,
        min: 6,
        cards: [{ kind: "lower", phrase: "c4", offset: 1.2, untilEnd: true, name: "Zulu Kingdom", sub: "Victory at Isandlwana · 1879" }],
      },
      {
        id: "agojie",
        shot: { src: "assets/img/agojie-line.jpg", from: [1.0, 2, 0], to: [1.1, -3, 0], pos: "50% 60%" },
        enter: "dissolve",
        lead: 0.4,
        vo: [
          ["c5", "Across the continent, courageous leaders and ordinary citizens"],
          ["c6", "fought for dignity, freedom and self-determination."],
        ],
        tail: 1.4,
        cards: [{ kind: "lower", phrase: "c5", offset: 1.0, untilEnd: true, name: "The Agojie of Dahomey", sub: "Women soldiers who fought French forces · 1890s" }],
      },
      {
        id: "independence",
        ground: "pattern",
        enter: "cut",
        min: 11,
        cards: [
          { kind: "stat", at: 0.5, dur: 4.8, big: "1957", line: "Ghana", note: "First sub-Saharan colony to win independence" },
          { kind: "stat", at: 5.6, untilEnd: true, big: "1960", line: "The Year of Africa", note: "Seventeen African nations win independence" },
        ],
      },
      {
        id: "host3",
        presenter: true,
        shot: { src: "assets/img/presenter-crop.jpg", from: [1.0, 0, 0], to: [1.07, 0, 1], pos: "50% 30%" },
        enter: "cut",
        lead: 0.8,
        vo: [["c7", "Their sacrifices helped shape the independent nations we know today."]],
        tail: 1.6,
        min: 8,
      },
      {
        id: "march",
        shot: { src: "assets/img/zulu-warriors.jpg", from: [1.25, -8, -2], to: [1.4, -8, -3] },
        enter: "dissolve",
        min: "fill",
      },
    ],
  },
  {
    id: "ch4",
    beats: [
      {
        id: "identity",
        shot: { src: "assets/img/elder-cap.jpg", from: [1.15, 6, 0], to: [1.02, 0, 0], pos: "50% 30%" },
        enter: "dip",
        lead: 5.0,
        vo: [["d1", "Despite its challenges, Africa has never lost its identity or ambition."]],
        tail: 1.2,
        cards: [{ kind: "chapter", at: 0.8, dur: 3.6, num: "Chapter IV", title: "Culture & Transformation" }],
      },
      {
        id: "culture",
        ground: "pattern",
        enter: "cut",
        lead: 0.4,
        vo: [
          ["d2", "Its music, languages, traditions, creativity and entrepreneurial spirit"],
          ["d3", "continue to influence the world."],
        ],
        tail: 1.4,
        cards: [
          { kind: "words", phrase: "d2", stack: true, words: [["Music", 0.08], ["Languages", 0.22], ["Traditions", 0.4], ["Creativity", 0.58], ["Enterprise", 0.82]] },
        ],
      },
      {
        id: "host4",
        presenter: true,
        shot: { src: "assets/img/presenter-crop.jpg", from: [1.05, 0, 1], to: [1.0, 0, 0], pos: "50% 30%" },
        enter: "cut",
        lead: 0.6,
        vo: [["d4", "Today, a new generation of Africans is building businesses,"]],
        tail: 1.0,
        min: 7,
      },
      {
        id: "dakar",
        shot: { src: "assets/img/senegal-city.jpg", from: [1.0, 0, 0], to: [1.12, 2, -2] },
        enter: "dissolve",
        lead: 0.4,
        vo: [
          ["d5", "advancing technology, transforming industries"],
          ["d6", "and creating opportunities beyond borders."],
        ],
        tail: 1.6,
        min: 10,
      },
      {
        id: "generation",
        shot: { src: "assets/img/baobab-city.jpg", from: [1.3, -10, 4], to: [1.22, -6, 2] },
        enter: "dissolve",
        min: 7,
        cards: [{ kind: "bigword", at: 1.2, untilEnd: true, text: "RISING" }],
      },
      {
        id: "youth",
        ground: "pattern",
        enter: "cut",
        min: "fill",
        cards: [
          { kind: "stat", at: 0.4, dur: 6.2, big: "60%", line: "Under the age of 25", note: "Africa is the world's youngest continent" },
          { kind: "stat", at: 7.0, untilEnd: true, big: "2,000+", line: "Languages", note: "Spoken across fifty-four countries" },
        ],
      },
    ],
  },
  {
    id: "ch5",
    beats: [
      {
        id: "baobab",
        shot: { src: "assets/img/baobab-city.jpg", from: [1.0, 0, 0], to: [1.12, 0, 2] },
        enter: "dip",
        lead: 5.0,
        vo: [["e1", "The future of Africa will not be written by its challenges,"]],
        tail: 0.6,
        cards: [{ kind: "chapter", at: 0.8, dur: 3.6, num: "Chapter V", title: "The Future of Africa" }],
      },
      {
        id: "skyline",
        shot: { src: "assets/img/senegal-city.jpg", from: [1.2, 0, 6], to: [1.08, 0, 0], pos: "50% 30%" },
        enter: "dissolve",
        lead: 0.2,
        vo: [["e2", "but by the vision, courage and determination of its people."]],
        tail: 1.0,
        min: 6,
      },
      {
        id: "host5",
        presenter: true,
        shot: { src: "assets/img/presenter-crop.jpg", from: [1.0, 0, 0], to: [1.06, 0, 1], pos: "50% 30%" },
        enter: "cut",
        lead: 0.6,
        vo: [
          ["e3", "Its greatest resource is not only what lies beneath its soil,"],
          ["e4", "but the intelligence, creativity and potential of its people."],
        ],
        tail: 1.2,
      },
      {
        id: "horizon",
        shot: { src: "assets/img/savannah-sunset.jpg", from: [1.0, 0, 0], to: [1.12, -3, 0] },
        enter: "dissolve",
        lead: 0.4,
        vo: [
          ["e5", "Africa has a story rooted in greatness,"],
          ["e6", "shaped by resilience"],
          ["e7", "and driven by possibility."],
        ],
        tail: 1.0,
        min: 11,
      },
      {
        id: "host6",
        presenter: true,
        shot: { src: "assets/img/presenter-crop.jpg", from: [1.12, 0, 2], to: [1.0, 0, 0], pos: "50% 30%" },
        enter: "dissolve",
        lead: 0.6,
        vo: [["e8", "And the next chapter is ours to write."]],
        tail: 2.0,
      },
      {
        id: "end",
        ground: "black",
        enter: "dip",
        min: "fill",
        cards: [{ kind: "final", at: 0.6 }],
      },
    ],
  },
];
