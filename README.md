# 群雄ノ國：掌中戦記 4.0 ── 国盗り合戦絵巻

スマホ縦画面向けの、和風の国盗り合戦シミュレーションです。八洲十五国の地図で攻める国を選び、左右に分かれた部隊の合戦（味方は左、敵は右）で砦を1つずつ落とします。部隊ごとに技と標的を選び、速さと硬直で決まる手番、技数、戦果ゲージで勝敗を争います。黄泉沼の蛟王黒淵を討てば結末、全国を取れば天下統一。

- 公開URL：https://gunyu-no-kuni-shochu-senki-cloudflare-final-20260506-11285.pages.dev/
- GitHub `hiro53y/gunyu_no_kuni_shochu_senki_cloudflare_final_20260506_112855` の main に push すると、Cloudflare Pages（Git連携）が自動でビルド・公開します。
- このフォルダ `deliverables/gunyu_no_kuni_shochu_senki_cloudflare_final_20260506_112855` がリポジトリ本体です（フォルダ名・場所は変えない）。
- React 19 ＋ TypeScript ＋ Vite 7。地図は Canvas 2D、合戦は DOM。サーバーは使わず、保存は端末の localStorage。
- 2.x（国取りSLG）のソースは `archive/v2.1/` に残しています（ビルドには入らない）。3.0（城が迷宮）のソースは git の履歴にあります。
- 名前・台詞・絵はすべて独自。既存作品の固有名詞・技名・画像は使わず、合戦の仕組みだけを参考にしています。

## 遊びの中身

| 要素 | 内容 |
|---|---|
| 本陣 | 1季節に行動3回。出陣・妖魔討伐・内政（開発・城・兵）・交流（絆）。城下（兵の補充・増員・浪人宿）は行動を使わない |
| 地図 | 八洲十五国・8勢力。国境、街道、攻められる国の印、攻めてくる敵の矢印、落とした砦の数 |
| 国と砦 | 敵の国に砦が2〜5つ（危ない国・本拠ほど多い）。合戦1回に勝つと砦を1つ落とし、最後の本城で城主が出る。落とした砦は3季節ごとに1つ取り返される |
| 陣立て | 朔（大将）を含め6部隊まで。前衛3・後衛3の枠に置く。敵の顔ぶれ（将・兵種・兵数・技）も見える |
| 合戦 | 共通の時間が流れ、次に動く時が早い部隊から手番。技ごとに消費（1・2・全）・射程（近・遠・貫通・全・味方）・倍率・硬直・反撃・要準備。戦果ゲージ、制限時間、技数切れ、全滅、朔の壊滅で決着 |
| 兵種 | 足軽・武士・弓兵・鉄砲・騎馬・忍者・軍師・巫女・僧兵・陰陽・妖怪。足軽のかばい、軍師の初めの付与、忍者の準備崩し、陰陽の式神など |
| 武将 | 固有22名＋名もなき侍大将。兵種と兵数を持ち、レベルで攻・防・知・速、技数、兵種の技が伸びる。絆2で固有技。兵が0になった家臣は2季節休む |
| 捕縛と登用 | 勝った合戦で、兵が0になった敵の将を2人まで捕らえる（名のない妖怪は除く）。忠義の将は主家が滅ぶまで牢 |
| 敵の手番 | 隣の勢力が攻めてくる。自ら迎え撃つ（合戦）か籠城。8季節目から妖魔の群が目覚め、人の国も呑み込む |
| できごと | 開幕・初勝利・妖魔の目覚め・勢力の滅亡・登用・絆（各武将2話）・結末。立ち絵つきの会話 |
| 負け | 本拠の暁原を失うと落城。その季節の始めからやり直せる |

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run test       # Vitest（合戦の単体テストと3,000戦の総当たり、国盗り）
npm run build      # tsc → vite build → dist/
```

- `BALANCE=10 npx vitest run tests/balance.test.ts`：国盗りを最初から最後まで自動で遊ばせて、勝つまでの季節・合戦の勝率・決着の理由を集計。
- `CAMPAIGN=4 npx vitest run tests/campaign.test.ts`：通しの自動プレイ（不変条件の検査つき）。
- 開発サーバーでは `window.__camp`（本陣）と `window.__battle`（合戦：`act`・`ai`）が使えます。本番のビルドには入りません。
- 立ち絵から丸い顔（`public/assets/tokens/`）と会話用の軽い絵（`public/assets/busts/`）を作るのは `python scripts/make-tokens.py`。

## 構成

```text
src/
  battle/    合戦（DOM に依存しない純粋な TS。seed 付き乱数で決定的）
    types.ts 型   kinds.ts 兵種と技   engine.ts 時間の流れ・射程・打撃・ガード・準備・戦果・決着   ai.ts 敵とおまかせ
  campaign/  国盗り：state（型）、army（兵数・敵の部隊・陣立て）、campaign（出陣・結果・内政・交流・城下・ターン・敵の手番・称号）、events（物語）
  content/   データ：sengoku（国・勢力・兵種の顔ぶれ）、generals（武将・兵種・台詞）、skills（固有技の元データ）
  engine/    rng.ts（乱数）、save.ts（保存）
  ui/        画面（タイトル・本陣・地図・陣立て・合戦・武将・城下・会話・結果・遊び方）
tests/       Vitest：battle（合戦）/ campaign（国盗り）/ balance（集計）、campaignBot（自動プレイ）
public/
  assets/portraits/  立ち絵（元の絵）  assets/tokens/ 丸い顔  assets/busts/ 会話と札の絵
  assets/sounds/bgm/ BGM
  manifest.webmanifest（start_url "/" は変えない）/ sw.js / _headers
```

## 保存

| キー | 内容 |
|---|---|
| `gunyu4:campaign` | 本陣（国盗り） |
| `gunyu4:battle` | 合戦の途中（毎手） |
| `gunyu4:turnstart` | 季節の始めの写し（落城した時のやり直し用） |
| `gunyu4:settings` | 音量・速さ・文字の大きさ・おまかせ |

3.0・2.x の保存データは読み込みません（消しもしません）。

## Cloudflare Pages の設定

| 項目 | 値 |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | `.node-version`（22.16.0） |

広い `_redirects` は置きません（`/assets` の配信を壊すため）。
