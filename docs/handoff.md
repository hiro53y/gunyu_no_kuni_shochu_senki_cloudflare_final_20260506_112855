# 引き継ぎメモ

## 現在の状況
- 2026-05-08時点で、スマホ向けWeb国取りSLG「群雄ノ國：掌中戦記」のCloudflare Pages向けMVP+αを実装済み。
- ルート直下はGitHub/Netlifyに置けるVite + React + TypeScript構成。
- 現行の使用対象フォルダは `deliverables/gunyu_no_kuni_shochu_senki_cloudflare_final_20260506_112855/`。

## 変更内容
- 12地域、5主要勢力、浪人枠、20人以上の武将、スキル、NPC行動、ランダムイベント、勝敗判定を実装。
- 内政、徴兵、訓練、探索、登用、進軍、休養、ターン終了を実装。
- localStorageの手動セーブ、自動セーブ、ロード、削除、破損データ例外処理を実装。
- スマホ縦画面向けの固定ヘッダー、タブ、下部アクションバー、モーダルを実装。
- `netlify.toml`、manifest、Service Worker、README、AGENTS.md、テストを整備。
- サブエージェントレビューで見つかった防衛武将の勢力不整合、登用AP/配置検証、セーブ検証、Service Workerキャッシュ方針を修正。
- 国絵図背景＋地域ノードのマップUI、武将デザインシート入りカード、SVGミニキャラ戦闘画面へ改修。
- 下部コマンドの探索・休養を復帰し、進軍は隣接敵領を選択して実行するようUI条件を修正。

## 検証
- 現行Cloudflare最終フォルダで `npm run test` 成功。9件通過。
- 現行Cloudflare最終フォルダで `npm run build` 成功。
- `deliverables/gunyu_no_kuni_shochu_senki_20260506_105904/` で `npm install` 成功。
- `deliverables/gunyu_no_kuni_shochu_senki_20260506_105904/` で `npm run test` 成功。8件通過。
- `deliverables/gunyu_no_kuni_shochu_senki_20260506_105904/` で `npm run build` 成功。
- build済み `dist` を簡易HTTPサーバーで配信し、HTTP 200を確認。
- `dist` の `/`、manifest、Service Worker、地図画像、武将画像のHTTP 200を確認。
- クリーンな最終成果物 `deliverables/gunyu_no_kuni_shochu_senki_final_20260506_110019/` は生成物を含まない59ファイル構成。`node_modules`、`dist`、`out/test-build`、`tsconfig.tsbuildinfo` が含まれないことを確認。

## 注意点
- このOneDrive配下の実行環境では、Vite dev serverの依存最適化で `EPERM` が出る場合がある。`--configLoader native` に変更してconfig読込は回避済みだが、依存キャッシュのrenameで失敗することがある。
- Netlify公開用の `npm run build` は成功しており、本番配信には影響しない見込み。
- 古い成果物フォルダ `deliverables/gunyu_no_kuni_shochu_senki/` と検証用 `deliverables/gunyu_no_kuni_shochu_senki_20260506_105904/` は残置。最終使用対象は `gunyu_no_kuni_shochu_senki_final_20260506_110019/`。
- ルートで `git init` を試したが、OneDrive配下の権限/ロックで失敗。ルート直下に不完全な `.git` が残っているが、権限拒否により削除・修復できなかった。最終成果物フォルダには `.git` は含めていない。

## 次にやること
- 必要なら実機スマホでUIタップ操作を確認する。
- GitHubへ登録する場合は、最終成果物フォルダを別の通常ローカルフォルダへコピーして `git init` するのが安全。
