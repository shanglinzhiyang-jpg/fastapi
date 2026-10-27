// 季節の行事 (R15): a few calendar events of the year. Once a year, on the morning of the day, the phone brings a short line from the papers
// (a New Year greeting, the blossoms, Tanabata, the summer festivals, the autumn leaves, Christmas, the last day of the year).
// The cherry blossom morning also eases the stress a little. Nothing is mandatory, and each event counts as one message (the day cap still holds).
// The seasons read the game's own calendar (clock.js dateOf), so every era has them in their own months.
import { onMorning } from './life.js';
import { dateOf } from './clock.js';

// the event of a calendar date ({ month, rday }) or null. rday is the day of the month in the game's 3-day steps (1, 4, 7 … 28).
export function seasonalEvent(date) {
  if (!date) return null;
  const m = date.month, d = date.rday;
  if (m === 1 && d <= 7) return { id: 'newyear', from: 'ドット新聞 社会部', text: '新年あけましておめでとうございます。今年はどんな一年にしますか。', stress: 0 };
  if ((m === 3 && d >= 22) || (m === 4 && d <= 10)) return { id: 'sakura', from: 'ドット新聞 社会部', text: '桜が咲きはじめました。公園の花見は、春のいちばんの息抜きです。', stress: 3 };
  if (m === 7 && d === 7) return { id: 'tanabata', from: 'ドット新聞 社会部', text: '今日は七夕。短冊に書いた願いごとは、かなうといいですね。', stress: 0 };
  if (m === 7 && d >= 22) return { id: 'matsuri', from: 'ドット新聞 社会部', text: '夏祭りと花火大会のシーズンです。夜の街が、いつもより賑やかです。', stress: 0 };
  if (m === 11 && d >= 16) return { id: 'momiji', from: 'ドット新聞 社会部', text: '紅葉の便りが届きました。秋の夜の散歩に、いい季節です。', stress: 0 };
  if (m === 12 && d >= 22 && d <= 25) return { id: 'xmas', from: 'ドット芸能ニュース', text: 'クリスマスの夜は、テレビも街も特別番組ばかり。お笑いの番組も、いつもより多めです。', stress: 0 };
  if (m === 12 && d >= 28) return { id: 'oomisoka', from: 'ドット新聞 社会部', text: 'もうすぐ大晦日。今年の出来事をふり返ってみてはどうでしょう。', stress: 0 };
  return null;
}

// the year's key of an event (each event once a year; in the game's own years)
const yearKey = (date) => `${date.year}`;

onMorning((g) => {
  try {
    if (!g || !g.state || !g.state.profile) return;
    const d = dateOf(g);
    const ev = seasonalEvent(d);
    if (!ev) return;
    const st = g.state;
    st.seasonal = st.seasonal && typeof st.seasonal === 'object' ? st.seasonal : { done: {} };
    if (!st.seasonal.done || typeof st.seasonal.done !== 'object') st.seasonal.done = {};
    const key = `${ev.id}:${yearKey(d)}`;
    if (st.seasonal.done[key]) return;
    st.seasonal.done[key] = st.day;
    if (ev.stress && st.life) st.life.stress = Math.max(0, (Number(st.life.stress) || 0) - ev.stress);
    g.message({ from: ev.from, text: ev.text, kind: 'news', season: ev.id });
  } catch (e) { /* a season never blocks the morning */ }
});

// the events seen this year (for the 図鑑: five of them in one year)
export function seasonsSeen(g) {
  const done = (g && g.state && g.state.seasonal && g.state.seasonal.done) || {};
  const years = {};
  for (const k of Object.keys(done)) { const [id, y] = k.split(':'); years[y] = years[y] || new Set(); years[y].add(id); }
  return Math.max(0, ...Object.values(years).map((s) => s.size));
}
