# Cloudflare Pages 公開手順

## 前提
- 公開先は Cloudflare Pages。
- アプリは Vite + React の静的SPA。
- Cloudflare Pages の設定は `npm run build` と `dist` を使う。
- Node.js は `.node-version` で `22.16.0` を指定する。

## GitHubへアップロードする範囲
最終成果物フォルダ、またはプロジェクトルートの以下をGitHubリポジトリ直下に置く。

含める:
- `src/`
- `public/`
- `tests/`
- `package.json`
- `package-lock.json`
- `index.html`
- `vite.config.js`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.test.json`
- `.node-version`
- `.gitignore`
- `README.md`
- `AGENTS.md`
- `netlify.toml` は任意。Cloudflareでは使わない。

含めない:
- `node_modules/`
- `dist/`
- `out/`
- `deliverables/`
- `.git`
- `CLAUDE.md`

## Cloudflare Pages 設定
| 項目 | 値 |
|---|---|
| Framework preset | React / Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js | `.node-version` の `22.16.0` |

## SPAフォールバック
Cloudflare Pagesは、トップレベルの `404.html` がない場合にSPAとして扱い、未一致パスをルートへフォールバックする。
このため、広い `/* /index.html 200` の `_redirects` は置かない。

Cloudflare Pagesの `_redirects` は既存アセットにも適用されるため、Viteの `/assets/...` を壊す可能性がある。

## キャッシュとヘッダー
`public/_headers` を配置済み。
- HTML、Service Worker、manifestは再検証。
- Viteのハッシュ付き `/assets/*` は長期キャッシュ。
- 基本的なセキュリティヘッダーを追加。

## 確認コマンド
```bash
npm install
npm run test
npm run build
```

`dist/` に `_headers`、`sw.js`、`manifest.webmanifest`、`assets/` が出力されることを確認する。
