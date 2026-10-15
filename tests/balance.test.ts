// 難易度の集計（BALANCE=回数 の時だけ動く）：国盗りを最初から最後まで自動で遊ばせ、勝つまでの季節・負け・合戦の勝率を見る
import { describe, it } from 'vitest';
import { newCampaign, ownedCount } from '../src/campaign/campaign';
import { LORD } from '../src/content/generals';
import { playCampaign } from './campaignBot';

const N = Number(process.env.BALANCE ?? 0);

describe.runIf(N > 0)('難易度の集計', () => {
  for (let i = 0; i < N; i++) {
    it(`国盗り ${i + 1}回目`, () => {
      const seed = 900 + i * 53;
      const res = playCampaign(newCampaign(seed), seed, Number(process.env.MAX_TURNS ?? 100));
      const c = res.c;
      const of = (m: string) => res.battles.filter((b) => b.mode === m);
      const rate = (m: string) => `${of(m).filter((b) => b.kind === 'win').length}/${of(m).length}`;
      const reasons: Record<string, number> = {};
      for (const b of res.battles) reasons[b.reason ?? '?'] = (reasons[b.reason ?? '?'] ?? 0) + 1;
      console.log(JSON.stringify({
        seed, errors: res.errors.slice(0, 2), victory: c.victory ?? null, defeat: c.defeat ?? null, turn: c.turn, regions: ownedCount(c), lv: c.gens[LORD].lv,
        siege: rate('siege'), defense: rate('defense'), hunt: rate('hunt'), reasons,
      }));
    });
  }
});
