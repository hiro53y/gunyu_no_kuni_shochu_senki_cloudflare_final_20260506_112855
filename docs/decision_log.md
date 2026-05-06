# 判断記録

<!-- AIが重要な判断をしたとき自動追記する。人間は編集不要。 -->

| 日付 | 判断内容 | 理由 | 決めた人/ツール |
|------|--------|------|-------------|
| 2026-05-05 | タイトルは「群雄ノ國：掌中戦記」を採用 | 仮題の時点で短く、スマホ画面でも表示しやすく、ゲーム内容を十分に表すため | Codex |
| 2026-05-05 | 外部画像素材や画像生成APIは使わず、CSS/SVG/テキスト表現に限定 | 著作権・依存性・Netlify公開の安定性を優先するため | Codex |
| 2026-05-05 | テストはVitestではなくNode実行の軽量テストへ変更 | このWindows/OneDrive環境でVitest/Vite config読込時にspawn EPERMが発生したため。テスト内容は維持し、`npm run test` が安定して通ることを優先した | Codex |
| 2026-05-05 | npm scriptsのVite起動に `--configLoader native` を指定 | Viteのconfig bundle時にesbuild spawn EPERMが発生したため、Node native loaderでconfig読込を安定させるため | Codex |
| 2026-05-06 | 旧成果物を上書きせず、最終成果物を別名フォルダで作成 | deliverables内の既存ファイル上書きを避け、生成物を含まないクリーンなパッケージを明確にするため | Codex |
