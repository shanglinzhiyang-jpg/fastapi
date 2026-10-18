// Crime, money trouble and justice (裁判所・刑務所・警察): CONTRACT written by the lead;
// the justice-core pass implements it. Other modules may rely on every name below.
//
// ---------------------------------------------------------------- principles
// - Japan's reality, shown seriously: crimes have real legal names, statutes and penalty
//   ranges (verify; era-aware: 懲役・禁錮 merged into 拘禁刑 from 2025-06 → reiwa uses 拘禁刑),
//   detection chances, and the real procedure: 逮捕 (48h) → 送検 (24h) → 勾留 (10+10日) →
//   起訴/不起訴/略式起訴 → 公判 → 判決 (罰金・執行猶予・実刑) → 控訴/上告 → 刑務所 (刑務作業, 仮釈放).
//   Consequences: 前科, agency contract ends, TV/regular shows dropped, politicians lose office
//   (禁錮以上 / 公職選挙法・政治資金規正法 → 公民権停止), fans and reputation fall.
// - No real-world how-to detail: crimes are abstract choices with outcomes.
// - Terrorism and assassination are NEVER player actions: they exist only as events by
//   fictional antagonists (threats, foiled plots, crisis response) — see darkside.js.
// - Money trouble: 消費者金融 (legal: 上限金利 15-20%, 総量規制 年収の1/3), 闇金 (illegal: トイチ,
//   harassment), 自己破産 (裁判所: 破産手続 → 免責; effects), 個人再生, 任意整理.
// - Smoking/drinking: 20+ only (younger = 補導 / 違反); 路上喫煙 fines in some districts.
//
// ---------------------------------------------------------------- state (g.state.justice)
// {
//   v: 1,
//   status: 'free'|'detained'|'trial'|'prison'|'probation',
//   record: [{ crime, day, outcome: 'fine'|'suspended'|'prison'|'acquitted'|'not_indicted', years?, fine? }],
//   heat: { [crimeId]: { n, day } },          // undetected offences that may still surface
//   custody: null | { crime, since: day, stage },
//   prison: null | { until: day, place: 'keimusho', work: n, parole: day|null },
//   probationUntil: day|null,
//   civicBanUntil: day|null,                  // 公民権停止 (cannot vote/run)
//   loans: [{ lender: 'shohisha'|'yamikin'|'bank', principal, rate, due: day, missed: n }],
//   bankrupt: null | { filed: day, discharged: bool, until: day },
//   smoker: 0..100,                           // habit level
//   flags: {},
// }
//
// ---------------------------------------------------------------- registries (exports)
// CRIMES { [id]: { name, law (罪名と条文), penalty (era-aware text + numbers), detect (base chance), severity 1..5,
//          political?: bool, civicBan?: bool } }
//   ids at least: shoplifting (窃盗), robbery (強盗), fare_evasion (鉄道営業法違反/詐欺), assault (暴行・傷害),
//   tax_evasion (所得税法違反), slush_fund (政治資金規正法違反・不記載), bribery_take (収賄), bribery_give (贈賄),
//   vote_buying (公職選挙法違反・買収), door_to_door (戸別訪問), underage_smoking (補導), street_smoking (路上喫煙・過料),
//   antisocial_ties (暴排条例・反社との交際 — not a crime for citizens in all cases; career sanctions), drunk (泥酔・迷惑行為),
//   loan_shark_use? (borrowing from 闇金 is not a crime for the borrower — model as trouble, not a crime)
//
// ---------------------------------------------------------------- g.* API (installJustice(Game.prototype))
// jus()                               -> g.state.justice (created on demand)
// commitCrime(id, ctx)                -> async; asks nothing; decides detection now or later (heat); returns { caught, report }
// arrest(id, ctx)                     -> async; the full procedure with scenes (警察署 → 検察 → 裁判所 → 刑務所 places)
// trial(caseObj)                      -> async; courtroom flow (起訴状朗読, 証拠, 被告人質問, 弁護, 判決); the player
//                                       chooses 認める/否認/反省 etc.; a lawyer (国選/私選) affects the outcome
// serveSentence()                     -> prison loop: days pass, 刑務作業, behaviour → 仮釈放
// hasRecord(), isFree(), civicBanned()
// fine(amount, reason)                -> pays or turns into 労役場留置 when unpaid
// borrow(lender, amount) / repay(loanIndex, amount) / loanTick(g)  (interest, harassment events for 闇金)
// fileBankruptcy()                    -> async court procedure; clears debts, sets restrictions
// smoke() / canSmokeHere(place)       -> stress relief, health cost, legality checks
// onJustice(event, fn)                -> hooks: 'arrested','convicted','released','acquitted','bankrupt'
// justiceTick(g)                      -> onMorning: heat surfacing (investigations), loans, prison days, probation end
//
// Places (police/検察/裁判所/刑務所) and the underworld town call only these.

export const JUSTICE_CONTRACT_VERSION = 1;
