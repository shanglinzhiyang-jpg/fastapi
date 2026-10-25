// Driving minigame — data: the 減点 table, the stage list, the instructor's lines, vehicles by era.
// (pure module: no DOM, no game state.) API doc: test-output/api_driving.txt

export const KMH = 24; // km/h per (px / frame)
export const PASS = 70; // 合格点 (持ち点 100)
export const PASS_SECOND = 80; // 第二種 (stricter; the real exam is 90)

// id -> { what: 減点 text, pts, abort: 検定 stops here (即中止), say: the instructor's line }
export const DED = {
  wheel: { what: '脱輪', pts: 5, say: '脱輪です。落ち着いてコースに戻りましょう。' },
  kerb: { what: '縁石に乗り上げ', pts: 10, say: '縁石に乗り上げています。気をつけて。' },
  cone: { what: 'ポール接触', pts: 10, say: 'ポールに当たりました。車幅をよく見て。' },
  crash: { what: '接触事故', pts: 100, abort: true, assist: 20, say: '接触です！ ブレーキ！' },
  ped: { what: '歩行者に接触', pts: 100, abort: true, assist: 30, say: '人です！ ブレーキ！' },
  stopmark: { what: '停止位置不良', pts: 5, say: '停止線の手前できちんと止まりましょう。' },
  nostop: { what: '一時不停止', pts: 30, abort: true, assist: 30, say: '止まれの標識です！ 必ず一時停止。' },
  signal: { what: '信号無視', pts: 100, abort: true, assist: 30, say: '赤信号です！ 止まって！' },
  yield: { what: '歩行者妨害', pts: 30, say: '横断歩道の歩行者が先です。止まって待ちましょう。' },
  sigNone: { what: '合図不履行', pts: 10, say: '曲がる前に合図を出しましょう。' },
  sigLate: { what: '合図遅れ', pts: 5, say: '合図は早めに出しましょう。' },
  sigWrong: { what: '合図の向き違い', pts: 10, say: '合図の向きが違います。' },
  look: { what: '安全確認不足', pts: 5, say: '目で見て安全確認をしましょう（Bボタン）。' },
  startLook: { what: '発進時の安全確認不足', pts: 5, say: '発進の前に、周囲の安全確認をしましょう。' },
  speed: { what: '速度超過', pts: 5, say: '制限速度を守りましょう。' },
  speed2: { what: '速度超過（大）', pts: 15, say: 'スピードの出しすぎです！' },
  lane: { what: '通行区分違反', pts: 10, say: '道路の左側を走りましょう。' },
  roll: { what: '発進時のずり下がり', pts: 5, say: '後ろに下がりました。アクセルを早めに。' },
  roll2: { what: '発進時の大きなずり下がり', pts: 10, say: 'ずり下がりすぎです。' },
  stall: { what: 'エンスト', pts: 5, say: 'エンストです。もう一度、落ち着いて。' },
  railstop: { what: '踏切内で停止', pts: 30, abort: true, assist: 30, say: '踏切の中で止まってはいけません！' },
  railgo: { what: '踏切 通過違反', pts: 100, abort: true, assist: 30, say: '遮断機が下りています！ 止まって！' },
  time: { what: '時間超過', pts: 30, say: '時間がかかりすぎです。' },
  jerk: { what: '急ブレーキ', pts: 5, say: 'お客様に優しい運転を。ブレーキはやわらかく。' },
  jerk2: { what: '急な発進・急ハンドル', pts: 5, say: 'ハンドルは静かに回しましょう。' },
  fall: { what: '一本橋から落ちた', pts: 10, say: '落ちました。もう一度！ ゆっくり、遠くを見て。' },
  bridgeFast: { what: '一本橋 時間不足', pts: 5, say: '一本橋はゆっくり、7秒以上かけて渡ります。' },
  parkpos: { what: '駐車位置・角度不良', pts: 10, say: 'まっすぐ、縁石に寄せて止めましょう。' },
  reverseLook: { what: '後退時の安全確認不足', pts: 5, say: '後退の前に、後方の安全確認を。' },
  passenger: { what: 'お客様をお待たせ', pts: 10, say: '乗降場所に、静かに寄せて停止します。' },
  lost: { what: 'コース逸脱', pts: 10, say: 'コースに戻ります。' },
  avoid: { what: '路上駐車の避け方不良', pts: 10, say: '駐車車両は、合図と確認をして右側から避けます。' },
};

// one entry per stage: kind 'lesson' = 教習 (the instructor steps on the 補助ブレーキ), 'kentei' = 検定 (即中止)
export const STAGES = {
  lesson1: {
    title: '基本操作の教習', sub: '発進・停止・ハンドル・ブレーキ', kind: 'lesson', vehicle: 'car', time: 100, limit: 25, song: 'drv_yard',
    lines: ['発進 → 加速 → 停止線で停止 → カーブ → 停止、の順に走ります。', 'ゆっくり発進して、停止線の手前でぴたりと止めましょう。'],
  },
  crank: {
    title: 'クランク・S字の教習', sub: '狭い道で車幅をつかむ', kind: 'lesson', vehicle: 'car', time: 100, limit: 20, song: 'drv_yard',
    lines: ['S字カーブとクランクを、脱輪せずに通り抜けます。', '前輪の位置と、車の内側の振り出しをよく見て。'],
  },
  park: {
    title: '方向変換・縦列駐車の教習', sub: 'バックで車庫入れ・路側帯へ', kind: 'lesson', vehicle: 'car', time: 170, limit: 15, song: 'drv_yard', reverse: true,
    lines: ['①方向変換：奥の車庫にバックで入り、前進で出て戻る。', '②縦列駐車：2台の間にバックで入れる。', '停止中に ↓ を長押しすると後退（R）します。'],
  },
  hill: {
    title: '坂道発進・踏切の教習', sub: '坂の途中で止まって、すぐ発進', kind: 'lesson', vehicle: 'car', time: 105, limit: 25, song: 'drv_yard',
    lines: ['坂の途中で一度止まり、ずり下がらずに発進します。', '踏切は手前で一時停止して安全確認（B）してから渡ります。'],
  },
  kentei1: {
    title: '修了検定', sub: '所内コース（第1段階）', kind: 'kentei', vehicle: 'car', time: 200, limit: 30, song: 'drv_kentei',
    lines: ['一時不停止・信号無視・接触は、その場で検定中止です。', 'コースは指示に従って走ります。教官の声をよく聞いて。'],
  },
  road: {
    title: '路上教習', sub: '一般道路を走る（第2段階）', kind: 'lesson', vehicle: 'car', time: 240, limit: 40, song: 'drv_road',
    lines: ['信号・一時停止・横断歩道・右左折・路上駐車を避けて、コースを一周します。', '左側通行。曲がる前は合図と安全確認（A・B）を。'],
  },
  kentei2: {
    title: '卒業検定', sub: '路上コース（第2段階）', kind: 'kentei', vehicle: 'car', time: 260, limit: 40, song: 'drv_road',
    lines: ['合格すると、教習所を卒業できます（卒業証明書）。', '一時不停止・信号無視・接触は、その場で検定中止です。'],
  },
  second: {
    title: '第二種免許の技能教習', sub: '旅客を乗せる運転（厳しめ）', kind: 'kentei', vehicle: 'car', time: 270, limit: 40, song: 'drv_road', strict: 1.5, pass: PASS_SECOND, passenger: true,
    lines: ['お客様を乗せる想定です。減点が1.5倍、80点以上で合格。', '乗降場所に静かに寄せて停止。急ブレーキ・急ハンドルも減点です。'],
  },
  moto: {
    title: '二輪の教習', sub: '一本橋・スラローム', kind: 'lesson', vehicle: 'moto', time: 100, limit: 25, song: 'drv_yard',
    lines: ['一本橋は7秒以上かけてゆっくり渡り、落ちないように。', 'スラロームは、コーンの間を縫って走ります。'],
  },
};
export const STAGE_IDS = Object.keys(STAGES);

export const INSTRUCTOR = { name: '宮坂 教官', second: '三枝 教官' };

export const LINES = {
  start: ['シートベルトを締めて、安全確認をしてから発進しましょう。', 'エンジンをかけて、まわりを確認してから発進です。'],
  startMT: ['クラッチを踏み込んで…ゆっくり、つなぎましょう。'],
  good: ['いいですね、その調子。', '落ち着いて運転できています。', '車幅感覚がつかめてきましたね。'],
  rest: ['もう少しです、最後まで集中して。'],
  done: ['お疲れさまでした。ブレーキを踏んで、停止してください。'],
  fail: ['今日はここまで。しっかり復習しましょう。'],
  hint: {
    stop: 'この線の手前で止まります。ブレーキは早めに、やさしく。',
    turnL: '次は左折です。左の合図 → 確認 → ゆっくり曲がります。',
    turnR: '次は右折です。右の合図 → 確認 → 大回りしすぎずに。',
    rail: '踏切の手前で一時停止。左右の安全確認（B）をします。',
    hill: '坂の途中で止まります。ブレーキから足を離す前に、アクセルを。',
    signal: '信号が赤なら停止線の手前で止まります。',
    cross: '横断歩道に歩行者がいたら、止まって待ちます。',
    avoid: '前の路上駐車を避けます。右の合図と確認。',
    park1: '車庫の前を通り過ぎて止まり、バックで入れます（↓長押しで後退）。',
    park2: '前の車と並べて止め、バックで2台の間へ。',
    bridge: '一本橋は遠くを見て、ゆっくり。7秒以上かけて渡ります。',
    slalom: 'コーンの間を縫って進みます。',
    crank: 'クランクです。ゆっくり、前輪を角に合わせて。',
    scurve: 'S字カーブです。ハンドルは早めに少しずつ。',
    pickup: 'お客様が待っています。左端にやさしく寄せて停止。',
    drop: 'お客様の降車場所です。左に寄せて停止。',
    goal: 'ゴールです。停止線で止まりましょう。',
  },
};

// cars by era: showa = 4-door sedan, from heisei_early (1990s) still sedan-ish, reiwa = compact
export function carLook(era, year, stage) {
  if (stage === 'moto') return { kind: 'moto', body: '#c8372d', trim: '#f4f4f0' };
  if (stage === 'second') return { kind: era === 'reiwa' ? 'compact' : 'sedan', body: '#f4d23a', trim: '#1b1b22', taxi: true };
  const y = year || 2026;
  if (y < 1996) return { kind: 'sedan', body: '#e7e2d3', trim: '#4a4f66', school: true };
  if (y < 2010) return { kind: 'sedan', body: '#f1f1f4', trim: '#3a4a7a', school: true };
  return { kind: 'compact', body: '#f6f7fb', trim: '#2f6fd0', school: true };
}

export const ERA_YEAR = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
export const eraOf = (y) => (y < 1989 ? 'showa' : y < 2000 ? 'heisei_early' : y < 2019 ? 'heisei' : 'reiwa');
