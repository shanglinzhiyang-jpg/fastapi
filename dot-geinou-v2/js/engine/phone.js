// The phone (menu → スマホ): messages, contacts, schedule, money, plus apps
// registered with registerPhoneApp (life.js).
//
// openPhone(g) is the entry point; replying to an invite or an offer happens here.

import { fmtMoney } from './util.js';
import { PEOPLE, HEARTS, HANGOUTS, REGULARS, PHONE_APPS, WEEKDAYS, heartIndex, weekdayOf } from './life.js';
import { audio } from './audio.js';

const KIND_TAG = { chat: '', invite: '【おさそい】', offer: '【オファー】', bill: '【家計】', fan: '【ファン】', news: '【おしらせ】' };

export async function openPhone(g) {
  audio.sfx('cursor');
  let last = 0;
  for (;;) {
    const apps = [
      { id: 'messages', name: 'メッセージ', badge: () => g.unread(), open: messagesApp },
      { id: 'contacts', name: '連絡先', open: contactsApp },
      { id: 'schedule', name: '予定', open: scheduleApp },
      { id: 'money', name: '家計', badge: () => (g.state.rent.debt ? 1 : 0), open: moneyApp },
      ...Object.values(PHONE_APPS).sort((a, b) => a.order - b.order),
    ];
    const items = apps.map((a) => {
      const n = a.badge ? a.badge(g) : 0;
      return { label: a.name, right: n ? `●${n}` : '' };
    });
    items.push({ label: 'とじる' });
    const i = await g.list({ title: `スマホ　${g.dayLabel()}`, items, x: 200, y: 40, w: 240, index: last, px: true });
    if (i < 0 || i >= apps.length) return;
    last = i;
    await apps[i].open(g);
  }
}

function msgLabel(m) {
  const body = m.text.replace(/\n/g, ' ');
  return `${m.read ? '' : '●'}${KIND_TAG[m.kind] || ''}${m.from}：${body.length > 14 ? body.slice(0, 14) + '…' : body}`;
}

export async function messagesApp(g) {
  let last = 0;
  for (;;) {
    const box = g.state.phone.inbox;
    if (!box.length) { await g.say('メッセージはまだない。'); return; }
    const i = await g.list({ title: 'メッセージ', items: box.map((m) => ({ label: msgLabel(m), right: `${m.day}日目` })), x: 40, y: 40, w: 560, index: last, px: true });
    if (i < 0) return;
    last = i;
    await readMessage(g, box[i]);
  }
}

// Shows one message and handles its reply (invite / offer).
export async function readMessage(g, m) {
  m.read = true;
  const def = m.person && PEOPLE[m.person];
  const opts = { name: m.from, look: def ? def.look : undefined };
  if (m.kind === 'invite' && !m.answered) {
    if (m.day !== g.state.day) {
      await g.say(m.text, opts);
      await g.say('（このおさそいの日は、もう過ぎてしまった…）');
      m.answered = 'expired';
      return;
    }
    const spot = HANGOUTS[m.spot];
    const i = await g.ask(m.text, ['行く！', 'ごめん、また今度'], { ...opts, cancel: 1 });
    if (i === 0) {
      const ok = await g.hangout(m.person, m.spot);
      if (ok) m.answered = 'yes';
      else await g.say(`${spot ? spot.name : 'おでかけ'}は、また今度にしよう。`);
    } else {
      m.answered = 'no';
      await g.say(['了解！また誘うね〜。'], opts);
    }
    return;
  }
  if (m.kind === 'offer' && m.regular && !m.answered) {
    const r = REGULARS[m.regular];
    if (!r) { await g.say(m.text, opts); return; }
    const i = await g.ask(`${m.text}\n（毎週${WEEKDAYS[r.weekday]}曜：${r.title}／ギャラ ${fmtMoney(r.pay)}）`, ['引き受ける', 'おことわりする'], { ...opts, cancel: 1 });
    if (i === 0) {
      g.joinRegular(m.regular);
      m.answered = 'yes';
      audio.sfx('fanfare');
      await g.say(`『${r.title}』のレギュラーになった！\n毎週${WEEKDAYS[r.weekday]}曜日に、収録に行こう。`);
    } else {
      m.answered = 'no';
      const s = g.state.regulars[m.regular];
      if (!s) g.state.regulars[m.regular] = { declined: g.state.day, dropped: true, doneWeek: 0, missed: 0, count: 0 };
      await g.say('今回はおことわりした。');
    }
    return;
  }
  await g.say(m.text, opts);
}

export async function contactsApp(g) {
  let last = 0;
  for (;;) {
    const ids = Object.keys(g.state.people).filter((id) => PEOPLE[id] && g.state.people[id].contact);
    if (!ids.length) { await g.say('連絡先はまだだれもいない。\n（何度か話して仲良くなると、連絡先を交換できる）'); return; }
    const items = ids.map((id) => {
      const lv = heartIndex(g.aff(id));
      const tag = g.state.partner === id ? '【相方】' : g.state.people[id].special ? '【大切な人】' : '';
      return { label: `${tag}${PEOPLE[id].name}`, right: '♥'.repeat(lv) + '♡'.repeat(4 - lv) };
    });
    const i = await g.list({
      title: '連絡先', items, x: 40, y: 40, w: 400, index: last, px: true,
      describe: (k) => { const d = PEOPLE[ids[k]]; return `${HEARTS[heartIndex(g.aff(ids[k]))][1]}。${d.profile || ''}${d.where ? '\nよくいる場所：' + d.where : ''}`; },
    });
    if (i < 0) return;
    last = i;
    await callPerson(g, ids[i]);
  }
}

// Call someone: invite them out when you are friends (once a day each).
export async function callPerson(g, id) {
  const def = PEOPLE[id], p = g.person(id);
  const opts = { name: def.name, look: def.look };
  if (heartIndex(p.aff) < 2) { await g.say(['もしもし？…あ、どうも！', 'また現場で会ったら、よろしくね。'], opts); return; }
  if (p.hangDay === g.state.day) { await g.say(['今日はもう十分遊んだね！', 'またね〜。'], opts); return; }
  const spots = Object.values(HANGOUTS);
  const items = spots.map((s) => ({ label: s.name, right: s.price ? fmtMoney(s.price) : '無料' }));
  const k = await g.list({ title: `${def.name}をさそう`, items, x: 120, y: 60, w: 400, px: true, describe: (j) => `ストレス -${spots[j].stress}　体力 -${spots[j].stamina}` });
  if (k < 0) return;
  await g.say(['もしもし？…うん、行く行く！'], opts);
  await g.hangout(id, spots[k].id);
}

export async function scheduleApp(g) {
  const st = g.state;
  const lines = [];
  const daysToMon = (7 - weekdayOf(st.day)) % 7 || 7;
  lines.push(`今日は${g.dayLabel()}。`);
  lines.push(`次の家賃：${daysToMon}日後（月曜）${fmtMoney(g.housing().rent)}` + (st.rent.debt ? `\n未払い ${fmtMoney(st.rent.debt)}` : ''));
  const regs = Object.keys(st.regulars).filter((id) => REGULARS[id] && !st.regulars[id].dropped);
  if (regs.length) {
    for (const id of regs) {
      const r = REGULARS[id], s = st.regulars[id];
      const done = s.doneWeek >= g.week ? '（今週は収録済み）' : r.weekday === g.weekday ? '（今日！）' : '';
      lines.push(`毎週${WEEKDAYS[r.weekday]}曜『${r.title}』${done}`);
    }
  } else lines.push('レギュラー番組：なし');
  await g.say(lines.join('\n'));
}

export async function moneyApp(g) {
  const st = g.state;
  const h = g.housing();
  const info = `所持金 ${fmtMoney(st.money)}\n住まい：${h.name}（家賃 ${fmtMoney(h.rent)}／週）` + (st.rent.debt ? `\n未払いの家賃 ${fmtMoney(st.rent.debt)}` : '');
  if (!st.rent.debt) { await g.say(info); return; }
  const i = await g.ask(info + '\n未払いの家賃を払う？', ['払う', 'あとで'], { cancel: 1 });
  if (i !== 0) return;
  if (g.payDebt()) await g.say('家賃を払った。ほっとした…。');
  else await g.say('お金が足りない…。');
}
