// 難易度の集計（BALANCE=回数 の時だけ動く）：国盗りを最初から最後まで自動で遊ばせ、勝つまでのターン・負け・城攻めの勝率を見る
import { describe, it } from 'vitest';
import { newCampaign, ownedCount } from '../src/campaign/campaign';
import { playCampaign } from './campaignBot';

const N = Number(process.env.BALANCE ?? 0);

describe.runIf(N > 0)('難易度の集計', () => {
  for (let i = 0; i < N; i++) {
    it(`国盗り ${i + 1}回目`, () => {
      const seed = 900 + i * 53;
      const res = playCampaign(newCampaign(seed), seed, Number(process.env.MAX_TURNS ?? 100));
      const c = res.c;
      const sieges = res.battles.filter((b) => b.mode === 'siege');
      const defenses = res.battles.filter((b) => b.mode === 'defense');
      console.log(JSON.stringify({
        seed, errors: res.errors.slice(0, 2), victory: c.victory ?? null, defeat: c.defeat ?? null, turn: c.turn, regions: ownedCount(c), lv: c.lord.lv,
        sieges: `${sieges.filter((b) => b.kind === 'win').length}/${sieges.length}`, defenses: `${defenses.filter((b) => b.kind === 'win').length}/${defenses.length}`,
        hunts: res.battles.filter((b) => b.mode === 'hunt').length,
      }));
    });
  }
});
