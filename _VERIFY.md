# v5.0.1 公開検証（2026-10-17）

実装コミット68c9c09。Cloudflare Pagesビルド成功。既存URLのv5.0.1、JS index-BfO2syAG.js / CSS index-RCPMwg91.css / sw.js / manifest / icon計5ファイルの配信内容がdistと一致。Service Workerキャッシュは gunyu-no-kuni-v10-crisp-battle-v501。保存キーとPWA識別情報に変更なし。

141テストと型チェック・ビルド成功。描画の修正・ブラウザーの寸法測定・実機未確認の範囲は tests/test_checklist.md 参照。以下は旧v5.0の公開履歴。

# Web配布検証 v5.0

配布は既存GitHub main連携のCloudflare Pages。`npm run build`でdistを生成する。公開先とPWA識別は維持する。

仕様：docs/spec.md。検証の詳細・実行条件・未確認事項：tests/test_checklist.md。
2026-10-17：実装4877ff0・設定統一3182295、Cloudflare Pages check成功。既存URL https://gunyu-no-kuni-shochu-senki-cloudflare-final-20260506-11285.pages.dev/ にv5.0を公開。

JS index-iW_z7nG_.js / CSS index-CbxI2A44.css、新画像48点、sw.js、manifest、アイコン計53ファイルの配信内容がdistと一致（sw.jsはGit改行を正規化して照合）。公開版で新規開始→出陣→勝利→本陣を操作確認。Pixel 9a実機は未検証。
