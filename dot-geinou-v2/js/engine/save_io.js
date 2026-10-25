// セーブデータの書き出し / 読み込み. For a browser that will not keep the game's saves (a file opened from a
// content:// link, a private window, blocked site data: storageMode() === 'memory') and for moving a save to
// another device. A slot goes out as a .json file or as text on the clipboard; a file or pasted text comes back
// into a slot.
//
//   saveIOMenu(g, { fromTitle })   the list of choices (menu → データ, title → つづきから → 読み込み)
//   offerExport(g)                 after a save that only reached memory: explains and offers 書き出し
//   importFlow(g)                  pick a file / paste text, pick a slot → the slot number, or 0
//   downloadSave(g, n) / copySave(g, n) → bool
import { exportSaveText, importSaveText, saveSummary, saveSlot, SAVE_SLOTS, storageMode, setSaveSlot } from './state.js';
import { askText } from './textinput.js';

const stamp = () => { const d = new Date(); const p = (v) => String(v).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };

export function downloadSave(g, n = saveSlot()) {
  const text = exportSaveText(n);
  if (!text) return false;
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dotgeinou-save-slot${n}-${stamp()}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
    return true;
  } catch (e) { console.warn('download failed', e); return false; }
}

export async function copySave(g, n = saveSlot()) {
  const text = exportSaveText(n);
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* fall through to the textarea way */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch (e) { return false; }
}

function pickFile() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,.txt,application/json,text/plain';
    inp.style.display = 'none';
    let done = false;
    const finish = (v) => { if (done) return; done = true; inp.remove(); resolve(v); };
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      if (!f) return finish(null);
      const r = new FileReader();
      r.onload = () => finish(String(r.result || ''));
      r.onerror = () => finish(null);
      r.readAsText(f);
    });
    inp.addEventListener('cancel', () => finish(null));
    document.body.appendChild(inp);
    inp.click();
  });
}

const slotLabel = (n) => {
  const s = saveSummary(n);
  return s ? `スロット${n}　${s.name}・${s.day}日目（いまのデータは消えます）` : `スロット${n}　（空き）`;
};

// → the slot the text went into, or 0
export async function importFlow(g) {
  const how = await g.list({ title: 'セーブデータを読み込む', items: ['ファイルをえらぶ', 'テキストをはりつける', 'やめる'], x: 100, y: 96, w: 440, px: true, cancel: 2 });
  if (how < 0 || how > 1) return 0;
  let text = null;
  if (how === 0) {
    text = await pickFile();
    if (!text) { await g.say('ファイルを読み込めませんでした。'); return 0; }
  } else {
    text = await askText(g, { title: '書き出したテキストをはりつけ', max: 4000000, multiline: true, rows: 5, note: 'コピーしたセーブデータを、ここにはりつけてください。' });
    if (!text) return 0;
  }
  const items = [];
  for (let n = 1; n <= SAVE_SLOTS; n++) items.push(slotLabel(n));
  items.push('やめる');
  const i = await g.list({ title: 'どのスロットに入れますか？', items, x: 100, y: 96, w: 440, px: true, cancel: SAVE_SLOTS });
  if (i < 0 || i >= SAVE_SLOTS) return 0;
  const n = i + 1;
  const r = importSaveText(text, n);
  if (!r.ok) { await g.say(`読み込めませんでした。\n（${r.error}）`); return 0; }
  setSaveSlot(n);
  await g.say(`スロット${n}に読み込みました。\n${r.summary.name}・${r.summary.day}日目・★${r.summary.fame}`);
  return n;
}

export async function exportFlow(g) {
  const n = saveSlot();
  if (!exportSaveText(n)) { await g.say('先に「セーブ」をしてください。\n（セーブするとデータが書き出せます）'); return; }
  const how = await g.list({ title: `スロット${n}のデータを書き出す`, items: ['ファイルに書き出す', 'テキストをコピーする', 'やめる'], x: 100, y: 96, w: 440, px: true, cancel: 2 });
  if (how === 0) {
    if (downloadSave(g, n)) await g.say('ファイルに書き出しました。\n（ダウンロードに「dotgeinou-save…json」が入ります）');
    else await g.say('書き出せませんでした。\n「テキストをコピーする」を試してください。');
  } else if (how === 1) {
    if (await copySave(g, n)) await g.say('コピーしました。\nメモ帳などに はりつけて残しておいてください。');
    else await g.say('コピーできませんでした。\n「ファイルに書き出す」を試してください。');
  }
}

// After a save that only lives in this page.
export async function offerExport(g) {
  const k = await g.ask('セーブしました。\nでも、このブラウザではデータを保存できないため、\nこのページを閉じると消えてしまいます。\n\nファイルに書き出しておきますか？', ['書き出す', 'あとで'], { cancel: 1 });
  if (k === 0) await exportFlow(g);
}

export async function saveIOMenu(g, opts = {}) {
  for (;;) {
    const mem = storageMode() === 'memory';
    const items = opts.fromTitle ? ['読み込む', 'もどる'] : ['書き出す', '読み込む', 'もどる'];
    const title = mem ? 'セーブデータ（このブラウザでは保存されません）' : 'セーブデータの書き出し・読み込み';
    const i = await g.list({ title, items, x: 100, y: 96, w: 440, px: true, cancel: items.length - 1 });
    if (i < 0 || i === items.length - 1) return 0;
    const act = items[i];
    if (act === '書き出す') await exportFlow(g);
    else {
      const n = await importFlow(g);
      if (n) return n;
    }
  }
}
