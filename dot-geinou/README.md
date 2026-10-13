# ドット芸能界 〜めざせ！国民的スター〜

事務所やテレビ局、劇場、撮影所に入って、お仕事・レッスン・オーディションをこなしながら
「国民的スター」を目指す 2D ドット絵 RPG です。ブラウザだけで動きます（ビルド不要）。

## あそびかた

```bash
# このディレクトリで静的サーバーを立てて、ブラウザで開くだけ
cd dot-geinou
python3 -m http.server 8765
# → http://localhost:8765/
```

| 操作 | キーボード | スマホ |
| --- | --- | --- |
| 移動 | 矢印キー / WASD | 十字パッド |
| 話す・調べる・決定 | Z / Space / Enter | A ボタン（画面タップでも可） |
| キャンセル・ダッシュ | X / Shift（押しながら移動でダッシュ） | B ボタン |
| メニュー（ステータス・もちもの・セーブ） | Esc / C | MENU |
| 音のオン・オフ | M | メニューから |

- **東京エリア**：NHK放送センター、ホリプロ、東宝、東映 撮影所、よしもと 東京本部、BSよしもと、
  グレープカンパニー、自宅（ドット荘）、コンビニ、銭湯、東京駅、公園
- **なんばエリア（大阪）**：よしもと新喜劇 劇場、松竹芸能、たこ焼き屋、ホテル、なんば駅
  （東京駅から新幹線で新大阪へ、電車に乗りかえ）
- 事務所のオーディションに合格すると所属タレントになれます。お仕事はミニゲーム
  （ツッコミ・ズッコケ・歌・殺陣・クイズ・原稿読み・トーク）で、結果のランクに応じてギャラと知名度が入ります。
- 体力はお仕事やレッスンで減り、ベッド（自宅・ホテル）で寝ると回復して次の日になります。
  食べ物・飲み物での回復は1日3回まで（メニューの「もちもの」に残り回数が出ます）。
- 知名度で称号が上がります：無名 → 駆け出し → 若手 → 注目株 → 人気者 → 売れっ子 → スター → 国民的スター。

> 実在の企業名・ロゴ（`assets/logos/`）は各社の商標・著作物です。本作は非公式のファンゲームで、
> 登場人物はすべて架空です。公開・配布する場合は権利関係にご注意ください。
> フォント：DotGothic16（SIL Open Font License 1.1, `assets/fonts/OFL.txt`）。

---

## 開発者向け

### 構成

```
index.html / style.css
js/main.js            起動・タイトル・テスト用URLパラメータ
js/title.js           タイトル画面・キャラクター作成
js/registry.js        読み込むコンテンツモジュールの一覧
js/engine/            エンジン（触る前に相談）
  game.js             ゲーム本体・シーン管理・スクリプトAPI（g.say など）
  map.js              マップ探索シーン・場所(place)の登録・エンティティ
  tiles.js            タイル定義（defineTile）と組み込みタイル
  sprites.js          キャラクタースプライト生成（LOOKS プリセット）
  buildings.js        街の建物の外観
  logos.js            ロゴ看板（ドット化）
  ui.js               メッセージ・選択肢・ショップ・メニュー・HUD
  minigame.js         ミニゲームの基底クラス
  audio.js            効果音・BGM（chiptune）
  state.js            セーブデータ・称号・アイテム・事務所
  draw.js             描画ヘルパー（text, panel, bar ...）
js/world/             街（tokyo, namba）と基本施設（home, konbini, station, misc）
js/places/<id>.js     事務所・局・劇場など（1ファイル1施設）
js/minigames/<id>.js  ミニゲーム（1ファイル1ゲーム）
tools/                ヘッドレスブラウザでのテストツール
```

画面は論理解像度 320×240、タイル 16×16。全ての描画はこの論理座標で行い、エンジンが整数倍に拡大します。

### 場所（place）の定義

```js
import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';

registerPlace({
  id: 'nhk',                  // 街の建物の place と一致させる
  name: 'NHK放送センター',     // 入った時のバナー
  kind: 'building',
  bgm: 'studio',
  start: { room: 'lobby', x: 7, y: 9, dir: 'up' },  // 入った時の位置
  rooms: {
    lobby: {
      floor: 'floor_marble', wall: 'white',   // 既定レジェンドで使われる
      tiles: [
        '###############',
        '=w===p===p===w=',
        // ... 1文字 = 1タイル
        '######MMM######',
      ],
      legend: { C: 'counter_white', P: 'plant', S: 'sofa_blue' },
      entities: [ /* npc, sign, prop, logo */ ],
      warps: [ { x: 6, y: 10, to: 'exit' }, { x: 13, y: 2, room: 'studio', tx: 2, ty: 8, dir: 'up' } ],
      events: [ { x: 3, y: 4, on: 'action', run: async (g) => { ... } } ],
      onEnter: async (g) => { ... },     // 部屋に入るたびに実行
      topPad: 24,                        // 大きい部屋：カメラが上端より少し上まで動ける（HUD対策）
      bgm: 'studio',                     // 部屋ごとに変えたい場合
    },
  },
});
```

**既定レジェンド**：`.` 床（room.floor）、`#` 壁の上面（walltop_<wall>）、`=` 壁の正面（wall_<wall>）、
`w` 窓付き壁、`p` ポスター付き壁、`c` 時計付き壁、`M` 出口マット、`d` 木のドア、`g` ガラスドア、` ` 何もない。
レジェンドの値は `'floor_wood+desk'` のように `+` で重ねられます。`obj` タイル（家具など）だけを書くと、
自動的に room.floor の上に描かれます。

**部屋の作法**：1行目は `#`（壁の上面）、2行目は `=`（壁の正面。窓・ポスター・ロゴ看板を飾る場所）、
左右の端と最下段も `#`。出口は最下段の `M` に `{ to: 'exit' }` ワープを置く（街の建物の前に戻る）。
3/4 見下ろし視点なので、キャラは壁の正面の1つ下の行から歩けます。

**エンティティ**
- `{ type: 'npc', id, x, y, dir, look, name, text: '…' | ['…', '…'], talk: async (g, npc) => {}, wander: 2, cond: (g) => bool, fixedDir }`
  （`wander` の NPC は、建物のドアとその前のマス、ワープの隣のマスには止まりません）
- `{ type: 'sign', x, y, text | talk }` 見えない調べるポイント（看板タイルの上などに置く）
- `{ type: 'prop', x, y, w, h, draw(ctx, sx, sy, g, e), solid, text | talk }` 自由描画の大きな物
- `{ type: 'logo', x, y, w, h, logo: 'nhk', board: true, text | talk }` 壁などに掛けるロゴ看板（タイル単位、小数可）

**ワープ**：`{ x, y, to: 'exit' }`（街へ戻る）／`{ x, y, room, tx, ty, dir }`（同じ施設の別の部屋）／
`{ x, y, place, room, tx, ty, dir }`（別の施設）。`check: async (g) => bool` で false を返すと押し戻されます。

**イベント**：`{ x, y, w, h, on: 'action' | 'step', run: async (g) => {}, once: 'フラグ名', cond: (g) => bool }`。
`action` はその位置に向かって A ボタン、`step` は踏んだ時。

**カウンター越しの会話**：`counter` / `counter_white` / `register` は `talkThrough` タイルなので、
カウンターの奥の NPC に手前から話しかけられます。

### スクリプト API（`g`）

| API | 説明 |
| --- | --- |
| `await g.say(text \| [pages], { name, look, face, top })` | メッセージ。`{name}` はプレイヤー名、`\n` で改行。`face(ctx, x, y)` で 16x12 の顔を自前で描ける |
| `await g.ask(text, ['はい', 'いいえ'], { name, look, cancel })` | 選択肢。選んだ index を返す（B は最後の選択肢） |
| `await g.list({ title, items, x, y, w })` | リスト選択（キャンセルで -1） |
| `await g.job({...})` | お仕事（下記）。結果 or null |
| `await g.lesson({...})` | レッスン（スキルアップ） |
| `await g.audition({...})` | 事務所オーディション（合格で所属）。true/false |
| `await g.minigame(id, opts)` | ミニゲームを直接実行 → `{ score, rank, success, comment }` |
| `await g.shop(['onigiri', { item: 'drink', price: 280 }], { title, greeting })` | お店 |
| `await g.sleep()` | 寝る（体力全快・日付+1・セーブ） |
| `g.addMoney(n)` / `g.spend(n)` → bool | お金 |
| `g.addFame(n)` / `g.addSkill('warai', n)` / `g.heal(n)` / `g.useStamina(n)` → bool | 成長・体力（`heal` は食べ物以外：お風呂・イベントなど） |
| `g.eat(n, { silent })` → 回復量 / `g.mealsLeft()` | 食べ物・飲み物での回復。1日3回まで（`state.flags.meal`）。食べられない時（おなかいっぱい・体力満タン）は 0 を返し、トーストで理由を出す（`silent` で出さない）。お金を取るなら先に `g.mealsLeft()` を確認 |
| `g.payText(pay)` | ギャラの表示 `ギャラ 目安¥3,000（出来で変動）`。お仕事の告知・一覧はこれを使う（`payText` は state.js からも import 可） |
| `g.giveItem(id)` / `g.hasItem(id)` / `g.takeItem(id)` | アイテム |
| `g.flag(k)` / `g.setFlag(k, v)` | フラグ（キーは施設IDを接頭辞に） |
| `g.state` | `{ name, money, fame, stamina, skills: { warai, engi, uta, talk }, agency, day, items, flags, jobs }` |
| `await g.fadeOut()` / `await g.fadeIn()` / `await g.wait(ms)` | 演出 |
| `await g.moveNpc(id, 'up up left')` / `await g.movePlayer('down')` | 移動演出（`'face:left'` で向きだけ） |
| `await g.emote('player' \| npcId, '!')` | 吹き出し（`! ? ♪ ♥ … 💢 w`） |
| `g.placeNpc(id, x, y, dir)` / `g.showNpc(id, bool)` / `g.placePlayer(x, y, dir)` | 瞬間移動・表示切り替え（演出用） |
| `await g.walkNpcTo(id, x, y)` | 最短経路で NPC を歩かせる |
| `g.npc(id)` / `g.notify(text)` / `g.sfx(name)` / `g.bgm(name)` / `g.shake()` | その他 |
| `await g.showLogo('nhk', '説明')` | ロゴを大きく表示 |
| `await g.goto(place, room, x, y, dir)` / `await g.exitPlace()` | 移動 |
| `await g.ending()` | エンディング（スタッフロール） |

**お仕事** `g.job({ id, title, desc, client, stamina: 20, minigame, opts: { difficulty }, pay, fame, skill, gain, requires })`
- `requires`: `{ agency: true | 'yoshimoto' | ['yoshimoto', 'grape'], fame: 250, skills: { warai: 30 }, flag, flagText }`。
  「所属 または ★30」のような条件は `{ anyOf: [{ agency: true }, { fame: 30 }] }`
- 確認 → 体力消費 → ミニゲーム → ランク倍率（S 1.5 / A 1.2 / B 1.0 / C 0.7 / D 0.4、得意分野の事務所なら ×1.1）で
  ギャラ・知名度・スキルが入ります。`pay` はランク B の額なので、「¥3,000〜」とは書かず `g.payText(pay)`（目安）で見せます。

**レッスン** `g.lesson({ title, skill, price: 2000, stamina: 10, gain: 3, minigame?, opts?, teacher })`

**オーディション** `g.audition({ agency, title, minigame, opts, pass: 55, stamina: 15, requires, confirm, client, clientLook, beforeResult })`
（`confirm: false` で確認を省略、`beforeResult: async (g, res, passed) => {}` で合否発表の前に演出を挟める）
事務所 ID：`yoshimoto` / `shochiku` / `grape` / `horipro`。所属していれば true。理由は `g.lastAudition`
（`'passed' | 'already' | 'failed' | 'declined' | 'nostamina' | 'blocked' | 'transferDeclined'`）。

`g.job` の確認画面に依頼者の顔を出すには `client: '名前', clientLook: npc.look`。

**経済の目安**（ランク B 時）

| 段階 | 条件の目安 | ギャラ | 知名度 |
| --- | --- | --- | --- |
| 0 | 誰でも | ¥500〜1,500 | 3〜8 |
| 1 | 所属 or ★30 | ¥3,000〜6,000 | 10〜25 |
| 2 | ★250 | ¥8,000〜15,000 | 30〜60 |
| 3 | ★1000 | ¥20,000〜40,000 | 80〜150 |
| 4 | ★2000 | ¥50,000〜80,000 | 150〜300 |

体力は1日100（＋食事 1日3回まで）。お仕事は 15〜30、レッスンは 10〜15。レッスン料 ¥2,000〜8,000 で スキル +3〜6。
★4000 に達するとエンジンが NHK から電話をかけ（`flags.finaleInvited`）、NHK で最終公演 → `g.ending()`。

### ミニゲーム

```js
import { Minigame, registerMinigame, text, panel, COLORS } from '../engine/minigame.js';

class MyGame extends Minigame {
  static title = 'タイトル';
  static howto = ['説明1', '説明2'];
  static bgm = 'minigame';
  init() { /* 開始時 */ }
  updatePlay(input) { /* 60fps。input.pressed('a') など。終わったら this.end(0..100) */ }
  drawPlay(ctx) { /* 320x240 に描画 */ }
}
registerMinigame('mygame', MyGame);
```

基底クラスがタイトルカード・3-2-1・結果画面（S/A/B/C/D）を担当します。
`this.difficulty`（1〜5）、`this.bonus`（スキル由来 0〜1.3、大きいほどやさしく）、`this.ease(v, k)`、
`this.popup(text, x, y, color)`、`this.drawTimerBar(ctx, frac)`、`this.rng()`、`this.opts` が使えます。

**ミニゲームと opts の約束**

| id | 内容 | opts |
| --- | --- | --- |
| `tsukkomi` | ボケにタイミングよくツッコミ | `lines: [{ boke, punch: bool, tsukkomi? }]`, `rounds` |
| `zukko` | 新喜劇風。ギャグのオチでズッコケる | `gags: [{ setup, cue }]`, `rounds` |
| `rhythm` | 歌・ダンス。流れてくるノーツ | `lanes: 1 \| 2 \| 4`, `bpm`, `length`（拍）, `song` |
| `command` | 殺陣・変身ポーズ・演技のコマンド入力 | `theme: 'tate' \| 'henshin' \| 'kaiju' \| 'acting' \| 'dance'`, `rounds` |
| `quiz` | 4択クイズ | `category: 'general' \| 'japan' \| 'osaka' \| 'tv' \| 'movie' \| 'music'`, `questions: [{ q, choices, answer }]`, `count` |
| `announce` | ニュース原稿の難読漢字を正しく読む | `words: [{ word, reading, wrong: [...] }]`, `count` |
| `talk` | トーク番組で最適な返しを選ぶ | `topic`, `scenes: [{ prompt, answers: [{ text, score }] }]` |

### 素材

- タイル：`js/engine/tiles.js`（`grass sidewalk road floor_wood floor_marble floor_carpet_red floor_stage floor_studio …`、
  壁は `wall_<テーマ>` / `walltop_<テーマ>`：white cream blue navy gray red purple wood dark orange green pink black yellow brick）。
  家具：`counter counter_white desk desk_pc chair seat sofa table plant bookshelf locker tv monitor camera mic spotlight speaker piano curtain curtain_top rope mirror makeup clothes_rack trophy director_chair green_screen set_wall stage_edge …`
  独自タイルは各ファイルで `defineTile('<施設ID>_xxx', {...})`。描画ヘルパー `R P pix speckle disc shadowEllipse` も tiles.js から import できます。
  画面に収まる小さな部屋は、上の壁が HUD に隠れないよう少し下にずらして表示されます。
  HUD は左上（日付・お金・知名度）と右上（所属・体力）の高さ 24〜36px。全画面の自作シーンは `hidesHud = true` を持たせると、開いている間 HUD を描きません。
- キャラ：`LOOKS.receptionist manager president staff ad director cameraman guard comedian comedian2 idol singer actor actress announcer announcerM makeup samurai ninja hero kaiju oldman oldwoman kid salaryman fan clerk chef tourist mom`。
  `{ ...LOOKS.staff, top: '#2f9a4a' }` のように上書き可。髪型：`short long bob spiky twin slick afro cap bald mage helmet`。
- ロゴ：`yoshimoto shinkigeki bs_yoshimoto shochiku grape nhk nhk_old toei horipro toho`
  （小さく描くと、よしもと・グレープ・東宝は文字を省いたマークだけになります：logos.js の `mark`）
- 効果音：`cursor ok cancel talk door coin success fanfare fail buzz hit good laugh applause zukko whistle drum snare shutter chime sword sleep`
- BGM：`title town osaka office studio theater minigame night ending`（`registerSong(name, def)` で追加可）

### テスト

```bash
python3 -m http.server 8765 --directory dot-geinou &       # リポジトリのルートで
node dot-geinou/tools/inspect.mjs nhk --out test-output    # 施設の総合チェック（スクショ・会話ログ・到達性）
node dot-geinou/tools/minigame.mjs quiz --out test-output  # ミニゲームをボットでプレイ
```

URL パラメータ：`?test=1&place=nhk&room=studio`（タイトルを飛ばして直接開始）、`&rich=1`（お金・知名度・スキル多め）、
`&agency=yoshimoto`、`?minigame=quiz&difficulty=3`（ミニゲーム単体）、`?debug=1`（メニューにデバッグ項目）。
