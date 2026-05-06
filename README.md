# 群雄ノ國：掌中戦記

## 概要
「群雄ノ國：掌中戦記」は、スマホブラウザ向けの和風戦国ファンタジー国取りターン制シミュレーションゲームです。プレイヤーは小国「暁ノ家」を率い、内政、徴兵、訓練、探索、登用、進軍を選びながら八州統一を目指します。

## 主な機能
- 12地域、プレイヤー勢力1、NPC勢力4、浪人枠1による国取りSLG
- 1ターン3APの軽量ターン制
- 内政、徴兵、訓練、探索、登用、進軍、休養
- 武将20人以上、能力値、スキル、兵数、スタミナ、忠誠
- NPC勢力の自律行動
- 勝利/敗北条件と結果画面
- localStorageによる手動セーブ、自動セーブ、ロード、削除
- スマホ縦画面を優先したカードUI
- Cloudflare Pages公開用設定
- Netlify互換設定
- PWA manifestと簡易Service Worker

## 技術スタック
- Vite
- React
- TypeScript
- CSS
- Node.js標準実行による軽量エンジンテスト
- localStorage
- Cloudflare Pages
- Netlify互換

## ローカル起動方法
```bash
npm install
npm run dev
```

OneDrive配下などでViteの依存最適化が `EPERM` になる場合は、同期が落ち着いてから再実行するか、プロジェクトを同期対象外のローカルフォルダに置いてください。Netlify用の本番buildは `npm run build` で確認済みです。

## build方法
```bash
npm run build
```

## テスト方法
```bash
npm run test
```

## Cloudflare Pagesデプロイ設定
Cloudflare Pagesのサイト設定では以下を指定します。

| 項目 | 値 |
|---|---|
| Framework preset | React / Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js | `.node-version` の `22.16.0` |

Cloudflare Pagesは、トップレベルの `404.html` がないSPAを自動的にルートへフォールバックします。そのため、広い `/* /index.html 200` の `_redirects` は置いていません。Cloudflare Pagesでは `_redirects` が既存アセットにも適用されるため、Viteの `/assets/...` を壊す可能性があります。

`public/_headers` にCloudflare Pages向けのキャッシュとセキュリティヘッダーを定義済みです。

CLIで直接アップロードする場合は、Cloudflareにログイン済みの状態で以下を実行します。

```bash
npm run deploy:cloudflare
```

## Netlify互換設定
`netlify.toml` は互換用に残しています。Netlifyを使う場合も `npm run build` と `dist` です。

## GitHub運用メモ
1. GitHubで空リポジトリを作成する。
2. このフォルダをGit管理し、初回コミットを作成する。
3. GitHubへpushする。
4. Cloudflare PagesでGitHubリポジトリを接続し、自動デプロイを有効化する。

GitHubにアップする対象は `src/`、`public/`、`tests/`、設定ファイル、READMEです。`node_modules/`、`dist/`、`out/`、`deliverables/`、`.git/` はアップしません。詳しくは `docs/cloudflare_pages.md` を参照してください。

## 操作方法
- 上部ヘッダーでターン、金、兵糧、AP、支配地域数を確認します。
- 地図タブで地域を選択します。
- 武将タブで行動に参加する武将を最大3人まで選択します。
- 下部アクションバーから内政、徴兵、訓練、探索、進軍、休養、ターン終了を実行します。
- 探索で浪人を発見した場合、内政タブから登用できます。

## セーブ仕様
- 手動セーブとターン進行時の自動セーブに対応します。
- セーブデータにはversionを持たせます。
- JSON parse失敗や不正なversionの場合はロード失敗として扱い、画面が真っ白にならないようにします。

## 今後の拡張案
- 地域数と勢力数の拡張
- 武将イベントと固有シナリオ
- 複数セーブスロット
- 難易度ごとの詳細バランス調整
- 戦闘演出の追加
- アクセシビリティ改善
