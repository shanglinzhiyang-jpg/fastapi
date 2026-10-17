// Cooking at home: buy ingredients at the supermarket, cook them in your kitchen.
// cookMenu(g) is called by every home kitchen (see housing).

export async function cookMenu(g) {
  if (!g.canEat()) { await g.say('おなかいっぱいだ…。\nおなかが空いたらまた作ろう。'); return; }
  const i = await g.ask('キッチンだ。自炊する？（¥100・体力+15）', ['つくる', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(100)) { await g.say('食材を買うお金もない…'); return; }
  const got = g.eat(15, { silent: true, fill: 30 });
  g.sfx('good');
  await g.say('もやし炒めを作って食べた！' + (got > 0 ? `体力が${got}回復した。` : 'おなかが満たされた。'));
}
