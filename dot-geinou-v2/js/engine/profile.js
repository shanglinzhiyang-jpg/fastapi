// Player profile chosen at the start: full name, gender, age, hometown, personality,
// era and family. Shared data for the character creator (title.js), the era display
// (era handling in util.js / game.js), the family (js/world/family.js) and the notebook.
//
// g.state.profile = {
//   familyName: '山田', givenName: '太郎',      // 氏名 (state.name is what people call you: givenName by default)
//   gender: 'm' | 'f' | 'x',                    // 男性 / 女性 / ないしょ
//   age: 20,                                     // AGE_MIN..AGE_MAX at the start (+1 every YEAR_DAYS days)
//   hometown: 'osaka',                           // PREFECTURES key
//   personality: 'akarui',                       // PERSONALITIES key
//   era: 'reiwa',                                // ERAS key
//   family: [ { id: 'fam_mother', rel: 'mother', name: '山田 花子', alive: true, cause: null }, ... ],
// }
// Old saves without a profile get defaultProfile(state) (see state.js loadGame).

export const AGE_MIN = 15;
export const AGE_MAX = 40;
export const YEAR_DAYS = 120; // in-game days per birthday (no calendar seasons; just a counter)

export const GENDERS = {
  m: { name: '男性', child: '息子', kid: 'ぼく' },
  f: { name: '女性', child: '娘', kid: 'わたし' },
  x: { name: 'ないしょ', child: '子', kid: 'わたし' },
};

// region: for dialect / specialties. kansai: family talks in Kansai-ben.
// gift: a hometown specialty the family sends (item id is registered by family.js as
// 'furusato_<key>'); keep names generic (no brands).
export const REGIONS = {
  hokkaido: { name: '北海道', dialect: 'hokkaido', gift: { key: 'potato', name: 'じゃがいも', heal: 15 } },
  tohoku: { name: '東北', dialect: 'tohoku', gift: { key: 'apple', name: 'りんご', heal: 12 } },
  kanto: { name: '関東', dialect: 'standard', gift: { key: 'senbei', name: 'おせんべい', heal: 10 } },
  chubu: { name: '中部', dialect: 'chubu', gift: { key: 'tea', name: 'お茶っ葉', heal: 8 } },
  kansai: { name: '関西', dialect: 'kansai', gift: { key: 'okonomi', name: 'お好み焼きセット', heal: 25 } },
  chugoku: { name: '中国', dialect: 'chugoku', gift: { key: 'momo', name: '白桃', heal: 12 } },
  shikoku: { name: '四国', dialect: 'shikoku', gift: { key: 'udon', name: 'うどん', heal: 25 } },
  kyushu: { name: '九州・沖縄', dialect: 'kyushu', gift: { key: 'mentai', name: 'めんたいこ', heal: 18 } },
};

const P = (name, region, extra = {}) => ({ name, region, ...extra });
// 47 prefectures. The order is the usual north-to-south order.
export const PREFECTURES = {
  hokkaido: P('北海道', 'hokkaido'),
  aomori: P('青森県', 'tohoku'), iwate: P('岩手県', 'tohoku'), miyagi: P('宮城県', 'tohoku'), akita: P('秋田県', 'tohoku'),
  yamagata: P('山形県', 'tohoku'), fukushima: P('福島県', 'tohoku'),
  ibaraki: P('茨城県', 'kanto'), tochigi: P('栃木県', 'kanto'), gunma: P('群馬県', 'kanto'), saitama: P('埼玉県', 'kanto'),
  chiba: P('千葉県', 'kanto'), tokyo: P('東京都', 'kanto', { near: true }), kanagawa: P('神奈川県', 'kanto', { near: true }),
  niigata: P('新潟県', 'chubu'), toyama: P('富山県', 'chubu'), ishikawa: P('石川県', 'chubu'), fukui: P('福井県', 'chubu'),
  yamanashi: P('山梨県', 'chubu'), nagano: P('長野県', 'chubu'), gifu: P('岐阜県', 'chubu'), shizuoka: P('静岡県', 'chubu'),
  aichi: P('愛知県', 'chubu'),
  mie: P('三重県', 'kansai'), shiga: P('滋賀県', 'kansai'), kyoto: P('京都府', 'kansai'), osaka: P('大阪府', 'kansai'),
  hyogo: P('兵庫県', 'kansai'), nara: P('奈良県', 'kansai'), wakayama: P('和歌山県', 'kansai'),
  tottori: P('鳥取県', 'chugoku'), shimane: P('島根県', 'chugoku'), okayama: P('岡山県', 'chugoku'),
  hiroshima: P('広島県', 'chugoku'), yamaguchi: P('山口県', 'chugoku'),
  tokushima: P('徳島県', 'shikoku'), kagawa: P('香川県', 'shikoku'), ehime: P('愛媛県', 'shikoku'), kochi: P('高知県', 'shikoku'),
  fukuoka: P('福岡県', 'kyushu'), saga: P('佐賀県', 'kyushu'), nagasaki: P('長崎県', 'kyushu'), kumamoto: P('熊本県', 'kyushu'),
  oita: P('大分県', 'kyushu'), miyazaki: P('宮崎県', 'kyushu'), kagoshima: P('鹿児島県', 'kyushu'), okinawa: P('沖縄県', 'kyushu'),
};
export const prefecture = (id) => PREFECTURES[id] || PREFECTURES.tokyo;
export const regionOf = (id) => REGIONS[prefecture(id).region];

// Personality: a small, readable effect each (applied by the engine where noted).
//   skills: starting skill points; stress: multiplier on stress gained; aff: multiplier on
//   affinity gained; lesson: multiplier on lesson skill gain; rankS: extra fame on S ranks.
export const PERSONALITIES = {
  akarui: { name: '明るい', desc: 'だれとでもすぐ仲良くなれる。好感度が上がりやすい。', aff: 1.2, skills: { talk: 3 } },
  majime: { name: 'まじめ', desc: 'こつこつ努力家。レッスンの効果が少し高い。', lesson: 1.2, skills: { engi: 3 } },
  mypace: { name: 'マイペース', desc: '細かいことは気にしない。ストレスがたまりにくい。', stress: 0.8, skills: {} },
  makezu: { name: '負けず嫌い', desc: '本番に強い。Sランクで知名度がさらに上がる。', rankS: 1.2, skills: { warai: 2 } },
  hitomishiri: { name: '人見知り', desc: '打ち解けるまで時間がかかるが、歌に気持ちをこめられる。', aff: 0.85, skills: { uta: 5 } },
  ochoshi: { name: 'お調子者', desc: 'ノリで乗り切る。お笑いが得意だが、少し疲れやすい。', stress: 1.1, skills: { warai: 5 } },
};

// Era: the mood of the world. priceRate scales every displayed amount of money
// (internal numbers stay the same, so the balance is unchanged); device: what the phone
// is called; sns: the name of the social app; year: shown in the notebook.
export const ERAS = {
  showa: { name: '昭和', label: '昭和（1980年代）', year: '昭和末期', priceRate: 0.6, device: '手帳と電話', deviceShort: '手帳', sns: 'ファンクラブ会報', tv: 'ブラウン管' },
  heisei: { name: '平成', label: '平成（2000年代）', year: '平成なかごろ', priceRate: 0.85, device: 'ケータイ', deviceShort: 'ケータイ', sns: 'ブログ', tv: 'テレビ' },
  reiwa: { name: '令和', label: '令和（いま）', year: '令和', priceRate: 1, device: 'スマホ', deviceShort: 'スマホ', sns: 'ドッター', tv: 'テレビ' },
};
export const eraOf = (state) => ERAS[(state && state.profile && state.profile.era) || 'reiwa'] || ERAS.reiwa;

// Family relations the creator offers. max: how many of that relation you can have.
export const RELATIONS = {
  father: { name: '父', call: 'お父さん', max: 1, older: true },
  mother: { name: '母', call: 'お母さん', max: 1, older: true },
  grandfather: { name: '祖父', call: 'おじいちゃん', max: 1, older: true },
  grandmother: { name: '祖母', call: 'おばあちゃん', max: 1, older: true },
  brother_older: { name: '兄', call: 'お兄ちゃん', max: 2, older: true },
  sister_older: { name: '姉', call: 'お姉ちゃん', max: 2, older: true },
  brother_younger: { name: '弟', call: '弟', max: 2, older: false },
  sister_younger: { name: '妹', call: '妹', max: 2, older: false },
};

// For family members who have passed away (story background only; spoken of gently).
export const CAUSES = {
  illness: { name: '病気', text: '病気で' },
  accident: { name: '事故', text: '事故で' },
  age: { name: '老衰', text: '天寿をまっとうして' },
  secret: { name: 'ないしょ', text: '' },
};

export function defaultFamily(familyName = 'ドット') {
  return [
    { id: 'fam_father', rel: 'father', name: `${familyName} 一郎`, alive: true, cause: null },
    { id: 'fam_mother', rel: 'mother', name: `${familyName} 花子`, alive: true, cause: null },
  ];
}

export function defaultProfile(state = {}) {
  const given = state.name || 'ドット';
  return {
    familyName: 'ドット', givenName: given, gender: 'x', age: 20, hometown: 'tokyo',
    personality: 'akarui', era: 'reiwa', family: defaultFamily('ドット'),
  };
}

// Current age (birthdays every YEAR_DAYS days).
export function ageOf(state) {
  const p = state && state.profile;
  if (!p) return 20;
  return p.age + Math.floor(((state.day || 1) - 1) / YEAR_DAYS);
}
