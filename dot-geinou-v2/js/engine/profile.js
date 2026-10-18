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

// ======================================================================== additions
// (character creator / era display / notebook. Additive: the exports above stay as they are.)

// What each era changes, for the creator (two short lines) and the opening card.
// (\u2060 marks the amounts as already shown in that era's prices: see util.js yenText.)
Object.assign(ERAS.showa, {
  desc: '手帳と家の電話、ブラウン管の時代。\nお金の表示は当時の物価に（¥\u20601,000→¥\u2060600）。',
  intro: ['昭和の終わり。', 'ブラウン管のむこうに、きらきらした夢があった。', '手帳と小銭をにぎりしめて、上京の日がやってきた。'],
  snsShort: '会報', // the app label on the phone's home screen (≤5 chars)
});
Object.assign(ERAS.heisei, {
  desc: 'ケータイとブログの時代。\nお金の表示は少しだけ安め（¥\u20601,000→¥\u2060850）。',
  intro: ['平成のなかごろ。', 'ケータイの小さな画面に、メールが届くたびにドキドキした。', 'ストラップをゆらして、上京の日がやってきた。'],
  snsShort: 'ブログ',
});
Object.assign(ERAS.reiwa, {
  desc: 'スマホとSNSの、いまの時代。\nお金の表示はそのまま（¥\u20601,000→¥\u20601,000）。',
  intro: ['令和。', 'スマホひとつで、だれでも発信できる時代。', 'それでも、本物のステージに立ちたくて――上京の日がやってきた。'],
  snsShort: 'ドッター',
});
export const ERA_ORDER = ['showa', 'heisei', 'reiwa'];

// The region order for the creator's quick jump (北海道 → 九州・沖縄).
export const REGION_ORDER = ['hokkaido', 'tohoku', 'kanto', 'chubu', 'kansai', 'chugoku', 'shikoku', 'kyushu'];
export const PREF_ORDER = Object.keys(PREFECTURES);
export const RELATION_ORDER = ['father', 'mother', 'grandfather', 'grandmother', 'brother_older', 'sister_older', 'brother_younger', 'sister_younger'];
export const CAUSE_ORDER = ['illness', 'accident', 'age', 'secret'];
export const PERSONALITY_ORDER = Object.keys(PERSONALITIES);

// Candidate names (all common, fictional). ←→ in the creator cycles them.
export const FAMILY_NAMES = ['星野', '山田', '佐藤', '鈴木', '高橋', '田中', '伊藤', '中村', '小林', '森'];
export const GIVEN_NAMES = {
  m: ['ひかる', '太郎', '翔', '大輝', '蓮', '健太', 'ドット'],
  f: ['ひかる', '花子', 'さくら', '美咲', '陽菜', 'ゆい', 'ドット'],
  x: ['ひかる', 'ドット', 'ピクセル', 'ミライ', 'あおい', 'まこと'],
};
export const RELATIVE_NAMES = {
  father: ['一郎', '健一', '誠', '浩二', '隆'],
  mother: ['花子', '裕子', '恵子', '由美', '明美'],
  grandfather: ['正男', '茂', '清', '勇', '武'],
  grandmother: ['ハル', 'キヨ', '千代', 'ふみ', 'トメ'],
  brother_older: ['大輔', '健太', '翔太', '拓也', '直樹'],
  sister_older: ['美咲', '彩', '由香', '麻衣', '恵'],
  brother_younger: ['蓮', '陽太', '悠斗', '颯', '湊'],
  sister_younger: ['陽菜', '結衣', 'さくら', '芽依', '葵'],
};

export const fullName = (p) => (p ? `${p.familyName || ''} ${p.givenName || ''}`.trim() : '');
export const personalityOf = (state) => PERSONALITIES[profileOf(state).personality] || PERSONALITIES.akarui;
// A personality multiplier ('stress' | 'aff' | 'lesson' | 'rankS'); 1 when it has none.
export function personalityMult(state, key) {
  const v = state && state.profile ? (PERSONALITIES[state.profile.personality] || {})[key] : null;
  return typeof v === 'number' && v > 0 ? v : 1;
}
// A short readable line of what a personality does: 'トーク +3・好感度 ×1.2'.
const SKILL_NAMES = { warai: 'お笑い', engi: '演技', uta: '歌', talk: 'トーク' };
export function personalityEffects(id) {
  const p = PERSONALITIES[id];
  if (!p) return '';
  const out = Object.entries(p.skills || {}).map(([k, v]) => `${SKILL_NAMES[k] || k} +${v}`);
  if (p.aff) out.push(`好感度の上がり方 ×${p.aff}`);
  if (p.lesson) out.push(`レッスン ×${p.lesson}`);
  if (p.stress) out.push(`ストレスのたまり方 ×${p.stress}`);
  if (p.rankS) out.push(`Sランクの知名度 ×${p.rankS}`);
  return out.join('・');
}

export const relationName = (rel) => (RELATIONS[rel] ? RELATIONS[rel].name : '家族');
export const relationCount = (family, rel) => (family || []).filter((m) => m && m.rel === rel).length;
export const canAddRelation = (family, rel) => !!RELATIONS[rel] && relationCount(family, rel) < RELATIONS[rel].max;
// A new family member with a common given name (not one already used in the family).
export function newFamilyMember(rel, familyName, family = []) {
  const used = new Set(family.map((m) => m && m.id));
  let id = `fam_${rel}`;
  for (let i = 2; used.has(id); i++) id = `fam_${rel}${i}`;
  const names = RELATIVE_NAMES[rel] || ['ひかり'];
  const taken = new Set(family.map((m) => m && m.name));
  const given = names.find((n) => !taken.has(`${familyName} ${n}`)) || names[0];
  return { id, rel, name: `${familyName} ${given}`, alive: true, cause: null };
}
// Family in the creator's relation order (older first).
export function sortFamily(family) {
  return family.slice().sort((a, b) => RELATION_ORDER.indexOf(a.rel) - RELATION_ORDER.indexOf(b.rel));
}

// Make any saved / hand-edited profile safe to read (loadGame).
export function normalizeProfile(p, state = {}) {
  const def = defaultProfile(state);
  if (!p || typeof p !== 'object' || Array.isArray(p)) return def;
  const str = (v, d) => (typeof v === 'string' && v.trim() ? v.trim() : d);
  const age = Math.round(Number(p.age));
  const out = {
    ...p,
    familyName: str(p.familyName, def.familyName),
    givenName: str(p.givenName, def.givenName),
    gender: GENDERS[p.gender] ? p.gender : def.gender,
    age: Number.isFinite(age) ? Math.min(AGE_MAX, Math.max(AGE_MIN, age)) : def.age,
    hometown: PREFECTURES[p.hometown] ? p.hometown : def.hometown,
    personality: PERSONALITIES[p.personality] ? p.personality : def.personality,
    era: ERAS[p.era] ? p.era : def.era,
  };
  const fam = Array.isArray(p.family) ? p.family : def.family;
  const ids = new Set();
  out.family = fam.filter((m) => m && typeof m === 'object' && RELATIONS[m.rel]).map((m) => {
    let id = typeof m.id === 'string' && m.id ? m.id : `fam_${m.rel}`;
    for (let i = 2; ids.has(id); i++) id = `fam_${m.rel}${i}`;
    ids.add(id);
    const alive = m.alive !== false;
    return { ...m, id, name: str(m.name, `${out.familyName} ${(RELATIVE_NAMES[m.rel] || ['ひかり'])[0]}`), alive, cause: alive ? null : (CAUSES[m.cause] ? m.cause : 'secret') };
  });
  return out;
}

// Birthdays: the morning the age goes up (day 1 + k * YEAR_DAYS). The engine sets
// state.flags[birthdayFlag(age)] = true that morning (main.js), so family.js can tell a
// birthday message was already sent.
export const birthdayFlag = (age) => `birthday_${age}`;
export const isBirthday = (state) => !!state && (state.day || 1) > 1 && ((state.day || 1) - 1) % YEAR_DAYS === 0;
// Days until the next birthday (1..YEAR_DAYS).
export const daysToBirthday = (state) => YEAR_DAYS - (((state && state.day) || 1) - 1) % YEAR_DAYS;

// A family member's look (sprites.js look object), taking hair / skin after the player:
// natural hair colours carry over (dyed hair does not), grandparents are grey.
export function familyLook(member, playerLook = {}) {
  const rel = member && member.rel;
  const pl = playerLook || {};
  const skin = pl.skin || 'fair';
  const hairColor = ['black', 'brown'].includes(pl.hairColor) ? pl.hairColor : 'black';
  const L = {
    father: { hair: 'short', hairColor, skin, top: '#5a6a8a', bottom: '#3a3a4a', jacket: true, tie: '#c0452f' },
    mother: { hair: 'bob', hairColor, skin, top: '#e08a9a', bottom: '#5a4a6a', skirt: true, lashes: true },
    grandfather: { hair: 'bald', hairColor: 'white', skin, top: '#8a6a4a', bottom: '#5a4a3a', glasses: true },
    grandmother: { hair: 'bob', hairColor: 'silver', skin, top: '#9273bd', bottom: '#5a4a6a', skirt: true },
    brother_older: { hair: 'spiky', hairColor, skin, top: '#2f6fd0', bottom: '#2a2d36' },
    sister_older: { hair: 'long', hairColor, skin, top: '#ff7eb6', bottom: '#3a4a7a', skirt: true, lashes: true },
    brother_younger: { hair: 'short', hairColor, skin, top: '#ffd23f', bottom: '#2f6fd0' },
    sister_younger: { hair: 'twin', hairColor, skin, top: '#5fd7ff', bottom: '#8a5ac8', skirt: true },
  }[rel];
  return L ? { ...L } : { hair: 'short', hairColor, skin, top: '#5a6a8a', bottom: '#3a3a4a' };
}

// ---------------------------------------------------------------- helpers (family.js and others)
// The profile of a state, or the default one for old saves / test starts (never stored).
export function profileOf(state) {
  return (state && state.profile && typeof state.profile === 'object') ? state.profile : defaultProfile(state || {});
}
// The given-name part of a family member's full name ('山田 花子' -> '花子').
export function givenOf(fullName, familyName = '') {
  const s = String(fullName || '').trim();
  if (!s) return '';
  const parts = s.split(/[\s　]+/);
  if (parts.length > 1) return parts[parts.length - 1];
  return familyName && s.startsWith(familyName) && s.length > familyName.length ? s.slice(familyName.length) : s;
}
// Family members of a profile: living / passed away (records from the creator, as stored).
export const livingFamily = (state) => (profileOf(state).family || []).filter((m) => m && m.alive !== false);
export const lateFamily = (state) => (profileOf(state).family || []).filter((m) => m && m.alive === false);
