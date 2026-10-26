// 実在の政治家 (R14-P): 安倍晋三（自民党総裁）・鳩山由紀夫 / 菅直人 / 野田佳彦（民主党）. The four stand in the game's party slots by name, with their photos as they are.
//
// HOW: an NPC record of the slot (the leader of the party, the post holders) is overlaid with the person's name, face (look.photo), traits, age and 当選回数
// (n.real = key, n.orig = what it was, so 設定 can take them out again). The simulation (elections, cabinet, the AI agents) treats them as the NPCs they overlay.
// SEATING (what "適切な役職" means here): 自民党 — 安倍が総裁。民主党 — 鳩山が代表、菅が幹事長、野田が国会対策委員長（政権に入ると、菅は財務大臣、
//   野田は菅内閣の財務大臣）。民主党の代表は、鳩山 → 菅 → 野田の順で交代しやすい（代表選で後押しされる）。
// GUARD: these are real people. The game never attributes misconduct, gaffes, illness, death, defection or a new party to them (politics_ai_act.js skips them),
//   their interviews are a third-person summary of public record (never an invented quote, never the Claude mode), and the numbers describe style, not character.
// Facts (public record): 安倍 — 衆院初当選1993年、自民党幹事長2003〜04年、官房長官2005〜06年、総裁2006〜07年・2012〜20年、首相2006〜07年・2012〜20年（在職日数が最長）。
//   鳩山 — 衆院初当選1986年、工学博士（スタンフォード大学）、民主党代表1999〜2002年・2009〜10年、首相2009年9月〜2010年6月、「友愛」。
//   菅 — 衆院初当選1980年、厚生大臣1996年、民主党代表1998〜99年・2002〜04年・2010〜11年、副総理・財務大臣2009〜10年、首相2010年6月〜2011年9月。
//   野田 — 衆院初当選1993年、松下政経塾1期生、財務大臣2010〜11年、民主党代表2011〜12年、首相2011年9月〜2012年12月、「社会保障と税の一体改革」。

export const REAL_ORDER = ['abe', 'hatoyama', 'kan', 'noda'];
export const REAL = {
  abe: {
    key: 'abe', name: '安倍 晋三', party: 'jimin', slot: 'leader', birth: 1954, first: 1993, photo: 'rp_abe', gender: 'm',
    tag: '保守・外交安保', style: { 発信力: 84, 政策力: 78, 調整力: 80, 党内基盤: 92, 決断力: 82 },
    traits: { charisma: 84, integrity: 70, ambition: 86 },
    ax: { econ: 40, power: 55, social: 78, world: 45, env: -15, nation: -20, tech: 30 },
    persona: '外交・安全保障に強い保守派。「美しい国」「戦後レジームからの脱却」を掲げ、第二次政権ではアベノミクスと日米同盟の強化を進めた。発信力があり、派閥と党内の信頼を土台に長期政権を築いた。',
    career: ['1993年 衆議院議員に初当選', '2003〜04年 自民党幹事長', '2005〜06年 内閣官房長官', '2006〜07年・2012〜20年 自民党総裁・内閣総理大臣'],
    note: '外交・安全保障と経済（アベノミクス）の発信で党を引っぱる総裁。',
  },
  hatoyama: {
    key: 'hatoyama', name: '鳩山 由紀夫', party: 'minshu', slot: 'leader', birth: 1947, first: 1986, photo: 'rp_hatoyama', gender: 'm',
    tag: '友愛・理想主義', style: { 発信力: 70, 政策力: 84, 調整力: 60, 党内基盤: 66, 決断力: 56 },
    traits: { charisma: 70, integrity: 70, ambition: 58 },
    ax: { econ: -25, power: -30, social: -40, world: -60, env: 60, nation: 10, tech: 20 },
    persona: '工学博士の理想主義者。「友愛」を掲げ、東アジア共同体構想や温室効果ガスの大幅な削減を打ち出した。構想を語る力が強みで、国際協調と地域への分権を重んじる。',
    career: ['1986年 衆議院議員に初当選', '1999〜2002年・2009〜10年 民主党代表', '2009〜10年 内閣総理大臣', '「友愛」「東アジア共同体」'],
    note: '友愛と国際協調を掲げる民主党の代表。',
  },
  kan: {
    key: 'kan', name: '菅 直人', party: 'minshu', slot: 'kanjicho', birth: 1946, first: 1980, photo: 'rp_kan', gender: 'm',
    tag: '市民派・論客', style: { 発信力: 78, 政策力: 80, 調整力: 58, 党内基盤: 60, 決断力: 78 },
    traits: { charisma: 78, integrity: 70, ambition: 80 },
    ax: { econ: -20, power: -20, social: -50, world: -30, env: 40, nation: 0, tech: 40 },
    persona: '市民運動出身の理系の論客。厚生大臣として薬害エイズの資料を調べ上げた経験から、官僚機構に切りこむ姿勢で知られる。「最小不幸社会」を掲げた。',
    career: ['1980年 衆議院議員に初当選', '1996年 厚生大臣', '1998〜99年・2002〜04年・2010〜11年 民主党代表', '2010〜11年 内閣総理大臣'],
    note: '市民派の論客。党の幹事長として代表を支える。',
  },
  noda: {
    key: 'noda', name: '野田 佳彦', party: 'minshu', slot: 'kokutai', birth: 1957, first: 1993, photo: 'rp_noda', gender: 'm',
    tag: '現実派・調整型', style: { 発信力: 74, 政策力: 72, 調整力: 86, 党内基盤: 68, 決断力: 72 },
    traits: { charisma: 74, integrity: 70, ambition: 66 },
    ax: { econ: 25, power: 0, social: -5, world: -10, env: 0, nation: -10, tech: 20 },
    persona: '松下政経塾の一期生で、街頭に立つ活動を重ねてきた現実派。財政規律を重んじ、「社会保障と税の一体改革」に取り組んだ。党内の融和（ノーサイド）を大切にする調整型。',
    career: ['1993年 衆議院議員に初当選', '2010〜11年 財務大臣', '2011〜12年 民主党代表・内閣総理大臣', '「社会保障と税の一体改革」'],
    note: '調整役の国会対策委員長。やがて党を率いる。',
  },
};
// the cabinet seats the three DPJ figures take when the party governs: { pm key: { post: key } }
export const REAL_CABINET = { hatoyama: { minister_finance: 'kan' }, kan: { minister_finance: 'noda' } };
export const DPJ_CHAIN = ['hatoyama', 'kan', 'noda'];

export const isReal = (n) => !!(n && n.real && REAL[n.real]);
export const realOf = (n) => (isReal(n) ? REAL[n.real] : null);
// age and 当選回数 at a year (a leader is at least 45 and has at least 6 terms: the game starts in any era)
export const realAge = (R, year) => Math.max(45, Math.min(80, year - R.birth));
export const realWins = (R, year) => Math.max(6, Math.floor((year - R.first) / 3.1) + 1);

// a third-person summary of public record for the 話を聞く screen (never a quote)
export function realSummary(R, topic, ctx = {}) {
  const role = ctx.role ? `現在は${ctx.role}。` : '';
  const pf = `${R.name.replace(' ', '')}（${R.tag}）`;
  switch (topic) {
    case 'goal': return `【人物メモ】${pf}。${role}${R.career[R.career.length - 1]}。${R.note}`;
    case 'party': return `【人物メモ】${pf}。${role}${R.note}`;
    case 'issue': return `【人物メモ】${pf}。${R.persona}`;
    case 'you': return `【人物メモ】${pf}。あなたへの印象は、これまでのつき合いから決まる（${ctx.att || 'まだ浅い'}）。`;
    default: return `【人物メモ】${pf}。${role}${R.persona}`;
  }
}
