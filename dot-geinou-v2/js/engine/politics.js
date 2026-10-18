// Politics core (政治界): offices, elections, parties, the Diet, the Cabinet, policy &
// bills, public opinion, the economy, political money. CONTRACT written by the lead;
// the politics-core pass implements it. Other modules may rely on every name below.
//
// ---------------------------------------------------------------- principles
// - Realism by era (g.state.profile.era: showa 1980s / heisei_early 1990s / heisei 2000s /
//   reiwa now): electoral system (昭和 = 中選挙区制, 1996- 小選挙区比例代表並立制), seat
//   totals of 衆議院/参議院 per era, ministries (2001 省庁再編; デジタル庁 2021-; 復興庁
//   2012-), 供託金, eligibility ages (衆院・市区町村長・地方議員 25, 参院・知事 30), 政党要件
//   (国会議員5人 or 得票率2%), 政党交付金 (1995-), 政治資金規正法 rules. Verify facts.
// - Real parties: only 自由民主党 ('jimin', all eras, logo 'jimin') and 民主党 ('minshu',
//   1998-2016 only, logo 'minshu'), portrayed neutrally with verifiable facts. No real
//   politicians: every politician NPC is fictional (generated names). Other parties are
//   fictional and must not imitate real ones.
// - Policy effects are even-handed trade-offs across voter segments; no ideology is
//   presented as right or wrong.
// - Political time: one political year = YEAR_DAYS (120) game days (profile.js). 衆院 term
//   4 years (may be dissolved), 参院 6 years with half elected every 3 years, local terms 4
//   years; by-elections (補欠選挙) happen now and then so there is always a way in.
//
// ---------------------------------------------------------------- state (g.state.politics)
// {
//   v: 1,
//   me: {                          // the player as a politician
//     office: null | OFFICE id,    // current office (null = 民間人)
//     district: string|null,       // electoral district label
//     party: party id | null,      // null = 無所属
//     termEnd: day | null,
//     posts: [post ids],           // 党役職・内閣ポスト (e.g. 'pm', 'minister_finance', 'kanjicho')
//     faction: faction id | null,
//     wins: n, losses: n, careerStart: day|null,
//     funds: n,                    // 政治資金 (separate from personal money)
//     secret: n,                   // 裏金 (unreported funds) — scandal exposure risk
//     staff: n,                    // 秘書の数
//     reputation: -100..100,       // 政治家としての評判
//     localSupport: 0..100,        // 地元の支持 (地盤)
//   },
//   parties: { [id]: PARTY },      // see below; includes fictional NPC parties and any party the player founds
//   diet: {
//     shugi: { total, seats: { [party]: n } },
//     sangi: { total, seats: { [party]: n } },
//     session: null | { kind: '通常国会'|'臨時国会'|'特別国会', start: day, end: day },
//     bills: [BILL],               // pending
//   },
//   cabinet: { pm: npcId|'player', partyIds: [...], ministers: { [post]: npcId|'player' }, approval: 0..100, formed: day },
//   laws: [ENACTED],               // enacted bills with their ongoing effects
//   economy: { growth, inflation, unemployment, debtRatio, yen, nikkei, budget: { revenue, spending, deficit, items: { [area]: n } } },
//   opinion: { [segment]: { [party]: share 0..1 }, issues: { [area]: salience 0..1 } },
//   elections: { upcoming: [ELECTION], history: [RESULT] },
//   npcs: { [npcId]: { name, party, office, faction, look, traits } },
//   flags: {},                     // misc politics flags
// }
// PARTY = { id, name, short, color, logo|null, emblem|null (player-designed), real: bool,
//   founded: day|null, years: [from, to]|null (real-world existence), leader: npcId|'player',
//   ideology: { econ, social, security } (-2..2), platform: [policy ids], funds, members,
//   factions: [{ id, name, leader, size }], subsidy: n (政党交付金/年), isPlayers: bool }
// BILL = { id, title, policy: policy id, params: {}, sponsor: 'cabinet'|'member', by: 'player'|npcId,
//   stage: 'draft'|'committee'|'shugi'|'sangi'|'enacted'|'rejected'|'shelved', house, votes, created: day }
// ELECTION = { id, kind: 'shugi'|'sangi'|'chiji'|'shicho'|'kugi'|'togi'|'hosen'|'sosaisen' , day, district?, seats?, declared?: candidates }
//
// ---------------------------------------------------------------- registries (exports)
// OFFICES      { [id]: { name, house?, ageMin, deposit (供託金, yen), termYears, salary (per month), level: 'local'|'national'|'exec' } }
// POLICY_AREAS { [id]: { name, desc } }  (経済・財政・税・社会保障・子育て・教育・外交安保・憲法・エネルギー・環境・
//                                       農業・地方・行政改革・治安・デジタル・労働・災害 …)
// POLICIES     { [id]: { area, name, desc, params?: [{ key, name, min, max, step, unit }], cost, effects: (params, era) => ({ segments: { [seg]: delta }, economy: {...} }), eras?: [...] } }
// SEGMENTS     { [id]: { name, weight } }  (若者・子育て世帯・高齢者・会社員・自営業・企業経営者・農林漁業・労働組合・
//                                       都市住民・地方住民・無党派 …)
// POSTS        { [id]: { name, kind: 'party'|'cabinet'|'diet', eras? } }  (総理・官房長官・各大臣 by era; 幹事長・政調会長・総務会長・
//                                       選対委員長・国対委員長・総裁/代表; 議長・委員長)
//
// ---------------------------------------------------------------- g.* API (installPolitics(Game.prototype))
// pol()                          -> g.state.politics (created on demand; newPoliticsState(g))
// eligible(officeId)             -> null | reason string (age, record 公民権停止, money for 供託金…)
// joinParty(partyId) / leaveParty()
// foundParty({ name, short, color, emblem, ideology, platform }) -> party id (costs; 政党要件 checked separately)
// partyStatus(partyId)           -> { official: bool (政党要件), members, seats, subsidy }
// declareCandidacy(electionId, { district, party, proportional }) -> null | reason (pays 供託金)
// campaign(action, opts)         -> effect report; actions: '街頭演説','ポスター','選挙カー','討論会','SNS','握手','後援会','ネット広告','献金集め'
//                                   (legal ones; '買収'/'戸別訪問' are illegal: route through crime.js commitCrime('vote_buying' …))
// runElection(electionId)        -> RESULT { winners, seats by party, myResult: { won, votes, rank, depositLost } }
// proposeBill({ policy, params, title }) -> bill id (as 議員立法, or 閣法 if in cabinet)
// advanceBills()                 -> process committee/plenary votes (called by the politics tick)
// vote(billId, yes|no|abstain)   -> the player's vote as a member (party discipline matters)
// noConfidence(), dissolve(), electPM(), formCabinet(choices), reshuffle()
// approval()                     -> cabinet approval %, partySupport(partyId) -> %
// politicsTick(g)                -> called every morning (registered with onMorning): sessions, bills, polls, economy,
//                                   elections due, salaries (歳費), 政党交付金, scandal exposure (secret funds)
// addSecretFunds(n, source) / reportFunds()  (裏金 vs proper 収支報告)
// onPolitics(event, fn)          -> hooks: 'elected','lost','enacted','cabinet','scandal','dissolve','resign'
//
// The UI (politics_ui.js) and places (国会・官邸・党本部・選管) call only these.

export const POLITICS_CONTRACT_VERSION = 1;
