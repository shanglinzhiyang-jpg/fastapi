// STUB — placeholder until the real minigame is implemented.
import { Minigame, registerMinigame, text, COLORS } from '../engine/minigame.js';

class Stub extends Minigame {
  static title = 'ズッコケ';
  static howto = ['（準備中）3秒間 Aボタンを連打しよう！'];
  init() { this.hits = 0; }
  updatePlay(inp) {
    if (inp.pressed('a')) this.hits++;
    if (this.pt > 180) this.end(30 + Math.min(70, this.hits * 5));
  }
  drawPlay(ctx) {
    this.drawBackground(ctx);
    text(ctx, `A連打！ ${this.hits}`, 160, 110, { align: 'center', size: 16, color: COLORS.accent });
  }
}
registerMinigame('zukko', Stub);
