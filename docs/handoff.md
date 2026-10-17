# 引継ぎ v5.0

現在の状態：完了・公開中（2026-10-17）。対象はこのdeliverables内Gitリポジトリ。親フォルダや公開URLを移動・変更しない。

仕様の正本は docs/spec.md。画像指示とレジストリは docs/art-v5.md / art-v5-manifest.json。検証結果と未確認事項は tests/test_checklist.md。旧版の手順や保存キーは現行手順として使わない。

主要実装：campaign/strategy.ts が活動・外交・褒賞・ルート・周回、campaign.ts が命令/合戦の状態遷移。mapGeometry.ts の国領域をYashimaMapが表示と操作に共用。battle/view/sprites.ts が透過アトラスを読み、field.ts が演出。元の立ち絵94ファイルは変更なし。

通常テストは npm test。通し60件を含める場合はPowerShellで `$env:V5_RUNS='20'; npm test`。通しボットは既知seedの複製上で編成候補を比較する検証ソルバーであり、人が遊ぶ難易度の証明ではない。資源・領土・勝利の注入は行わない。シナリオ境界テストは明示した完了合戦fixtureを別に使う。

開発確認用 `?qa=battle/council/ending` はDEVのみ。製品ビルドにfixtureを含めない。通常保存の確認はqaなしURLで行う。保存確認・復元画面を追加しない。旧キーを消去しない。

実装公開コミットは4877ff0、演出設定の統一は3182295。既存URLのv5.0と53配信ファイルの一致、Cloudflareビルド成功を確認済み。次回は公開版を基準に再現条件を確認する。Pixel 9a実機と人による長時間プレイはPC検証と分けて扱う。サブエージェント：未使用。
