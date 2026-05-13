# テストチェックリスト

## 自動テスト
- [x] 戦闘計算が結果を返す
- [x] 内政で石高が増える
- [x] 徴兵で兵力が増え、資源が減る
- [x] 進軍勝利時に地域支配が変わる
- [x] 制圧時に旧防衛武将が制圧地域へ残らない
- [x] 登用でAPを消費し、候補所在地に配置する
- [x] セーブデータのserialize/deserializeができる
- [x] 壊れたセーブデータを拒否する
- [x] 勝利条件を判定できる
- [x] 25ターンのスモーク進行で状態が壊れない

## build
- [x] ルートで `npm run build`
- [x] 検証用deliverables内で `npm run build`
- [x] Cloudflare検証用deliverables内で `npm run build`

## 起動確認
- [x] build済み `dist` のトップページを簡易HTTPサーバーで配信し、HTTP 200を確認
- [x] Cloudflare検証用distの `/`、manifest、Service Worker、icon、JS、CSS がHTTP 200を返すことを確認
- [ ] 実機スマホまたはブラウザでのタップ操作確認

## パッケージ
- [x] `deliverables/gunyu_no_kuni_shochu_senki_final_20260506_110019/` を作成
- [x] 最終パッケージに `node_modules`、`dist`、`out/test-build`、`tsconfig.tsbuildinfo` が含まれないことを確認
- [x] `deliverables/gunyu_no_kuni_shochu_senki_cloudflare_final_20260506_112855/` を作成
- [x] Cloudflare最終パッケージに `node_modules`、`dist`、`out/test-build`、`.git` が含まれないことを確認

## Cloudflare Pages
- [x] `public/_headers` が `dist/_headers` に出力されることを確認
- [x] `dist/_redirects` が存在しないことを確認
- [x] `.node-version` を追加
- [x] `docs/cloudflare_pages.md` を追加
- [x] Service Worker構文チェック
- [x] manifest JSON parseチェック

## 既知の環境差分
- [ ] OneDrive配下ではVite dev serverの依存最適化キャッシュ操作で `EPERM` が出る場合がある
- [ ] ルートの `git init` はOneDrive権限/ロックで失敗。不完全な `.git` は最終成果物には含めていない

## 2026-05-13 追加確認
- [x] `npm test` で現行v2.1向けエンジンテスト9件が通過
- [x] `npx tsc -b --pretty false` がエラーなし
- [x] NPC侵攻がプレイヤー絡みでも作戦記に出ることを自動テストで確認
- [x] CharacterPortrait追加後も全武将表示の型チェックが通過
- [x] 1ターン目終了で即敗北しないことを自動テストで確認
- [x] `npm test` は10件通過
- [ ] `npm run build` は TypeScript 後の Vite/esbuild 実行ファイル起動が `spawn EPERM` で停止。Cloudflare Pages/通常PC環境で再確認する
