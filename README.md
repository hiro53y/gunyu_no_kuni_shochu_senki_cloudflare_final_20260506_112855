# 群雄ノ國：掌中戦記 3.0 ── 国盗り迷宮絵巻

スマホ縦画面向けの、和風「国盗り×不思議のダンジョン」です。八洲十五国の地図で攻める国を選び、その国の城（3〜7階の迷宮）を一手ずつ攻め上がります。天守の城主を討てば国が手に入り、捕らえた武将は家臣になります。黄泉沼の蛟王黒淵を討てば結末、全国を取れば天下統一。

- 公開URL：https://gunyu-no-kuni-shochu-senki-cloudflare-final-20260506-11285.pages.dev/
- GitHub `hiro53y/gunyu_no_kuni_shochu_senki_cloudflare_final_20260506_112855` の main に push すると、Cloudflare Pages（Git連携）が自動でビルド・公開します。
- このフォルダ `deliverables/gunyu_no_kuni_shochu_senki_cloudflare_final_20260506_112855` がリポジトリ本体です（フォルダ名・場所は変えない）。
- React 19 ＋ TypeScript ＋ Vite 7。迷宮と地図は Canvas 2D。サーバーは使わず、保存は端末の localStorage。
- 2.x（国取りSLG）のソースは `archive/v2.1/` に残しています（ビルドには入らない）。
- 名前・台詞・絵はすべて独自。既存作品の固有名詞・画像は使っていません。

## 遊びの中身

| 要素 | 内容 |
|---|---|
| 本陣 | 1季節に行動3回。出陣・修行（妖魔の巣）・内政（開発・城・兵）・交流（絆）。城下（蔵・装備・商人・鍛冶・浪人宿）は行動を使わない |
| 地図 | 八洲十五国・8勢力。国の中心からの距離で塗り分けた国境、街道、攻められる国の印、攻めてくる敵の矢印 |
| 城攻め | 3〜7階の迷宮。勢力ごとの兵（10系統×3段階）と妖怪（16系統×3段階）。中の階に2人目の将、最上階の天守に城主。撤退すると登った階まで城門が破れたまま残る |
| 武将 | 固有22名＋名もなき侍大将。部隊に2人まで。槍・弓・鉄砲・刀の戦い方。倒れても死なず傷を負う。レベルは戦をまたいで残る |
| 技 | 約50種。一直線・周り・見えている敵・部隊全体の回復や守り・寝返りなど。敵の将も使う |
| 捕縛と登用 | 倒した将を家臣に迎えるか解き放つ。忠義の将は主家が滅ぶまで牢 |
| 敵の手番 | 隣の勢力が攻めてくる。自ら迎え撃つ（1階の合戦）か籠城。8季節目から妖魔の群が目覚め、人の国も呑み込む |
| できごと | 開幕・初勝利・妖魔の目覚め・勢力の滅亡・登用・絆（各武将2話）・結末。立ち絵つきの会話 |
| 迷宮の仕組み | 前作「不思議なダンジョンもどき」から：8方向、未識別、合成、旅の商人の店、罠、モンスターハウス、満腹度、ダッシュ、タップで調べる |
| 負け | 本拠の暁原を失うと落城。その季節の始めからやり直せる |

## 操作

スマホ：十字パッド・A（攻撃）・B（ダッシュ）、上の段に 道具・技・矢・向き・地図・状態。上に並ぶ部隊の顔を押しても技の一覧が出ます。

PC：矢印・WASD・QEZC（斜め）・テンキー、Shift＋方向でダッシュ、Space 攻撃、X 足踏み、R 休む、I 道具、T 技、G 階段、V 矢、F 向き、M 地図、L 記録、Esc メニュー。

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run test       # Vitest（単体テスト・地図2,000通り・自動プレイの総当たり・国盗りの序盤）
npm run build      # tsc → vite build → dist/
```

- `FUZZ_RUNS=80 npx vitest run tests/fuzz.test.ts`：でたらめな操作と上手なボットの自動プレイを増やして総当たり。
- `BALANCE=6 npx vitest run tests/balance.test.ts`：国盗りを最初から最後まで自動で遊ばせて、勝つまでのターン・城攻めの勝率を集計。
- `CAMPAIGN=4 npx vitest run tests/campaign.test.ts`：通しの自動プレイ（不変条件の検査つき）。
- 開発サーバーで `?bot=1` を付けると、冒険の画面で自動プレイ。`?gallery` で駒・兵・妖怪・床と壁の絵を一覧。`window.__game.goto(階)`・`window.__camp`。どれも本番のビルドには入りません。
- 立ち絵から駒（`public/assets/tokens/`）と会話用の軽い絵（`public/assets/busts/`）を作るのは `python scripts/make-tokens.py`。

## 構成

```text
src/
  content/   データ：sengoku（国・勢力）、generals（武将と台詞）、skills（技）、monsters（兵と妖怪）、items、world（罠・城の見た目）
  engine/    迷宮（DOM に依存しない純粋な TS。seed 付き乱数で決定的）
    run.ts 冒険の作り方・階の移動   mapgen.ts 階・天守・合戦の野   generals.ts 武将の強さ・経験
    skills.ts 技（味方も敵も同じ仕組み）   ai.ts 敵・味方の動き   step.ts 1手の進行   save.ts 保存
  campaign/  国盗り：state（型）、campaign（出陣・結果・内政・交流・城下・ターン・敵の手番・称号）、events（物語）
  render/    Canvas の描画（地形・駒・兵・演出・ミニマップ）
  ui/        画面（タイトル・本陣・地図・編成・冒険・技・武将・城下・会話・結果）
tests/       Vitest：engine / features / mapgen / generals / campaign / fuzz / balance、bot（迷宮）・campaignBot（国盗り）
public/
  assets/portraits/  立ち絵（元の絵）  assets/tokens/ 駒  assets/busts/ 会話の絵
  assets/sprites/v2/ 妖怪・道具・罠の絵  assets/sounds/bgm/ BGM 5曲
  manifest.webmanifest（start_url "/" は変えない）/ sw.js / _headers
```

## 保存

| キー | 内容 |
|---|---|
| `gunyu3:campaign` | 本陣（国盗り） |
| `gunyu3:run` | 出陣中の冒険（毎手） |
| `gunyu3:turnstart` | 季節の始めの写し（落城した時のやり直し用） |
| `gunyu3:settings` | 音量・速さ・文字の大きさ |

2.x の保存データは読み込みません（消しもしません）。

## Cloudflare Pages の設定

| 項目 | 値 |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | `.node-version`（22.16.0） |

広い `_redirects` は置きません（`/assets` の配信を壊すため）。
