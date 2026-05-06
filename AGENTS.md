# Codex 向けルール

## プロジェクト概要
- このプロジェクトはスマホ向けWeb国取りSLG「群雄ノ國：掌中戦記」である。
- Vite + React + TypeScriptで実装し、GitHub管理とCloudflare Pages公開を第一前提にする。
- Netlify設定は互換用に残してよいが、公開手順と検証はCloudflare Pagesを優先する。
- バックエンドは持たず、セーブデータはlocalStorageに保存する。
- PWAはmanifestと簡易Service Workerで軽量に対応する。

## 開発ルール
- TypeScript型安全性を重視し、`any` は極力使わない。
- ゲームロジックは可能な限り `/src/engine` に純粋関数として分離する。
- UIコンポーネントは `/src/components` に分離する。
- 乱数は `/src/engine/random.ts` に集約し、可能な限りseed管理してデバッグしやすくする。
- localStorage処理は `/src/engine/save.ts` に集約し、データ破損やJSON parse失敗に備えて例外処理を入れる。
- 既存商業作品の固有表現、作品名、キャラクター名、勢力名、地名を使わない。
- 成人向け表現は入れない。
- CSS、SVG、絵文字、簡易アイコン、自作軽量表現のみを使い、外部有料素材や画像生成APIに依存しない。
- `npm run build` が通る状態を完了条件とする。
- スマホ縦画面360px幅でも操作できることを重視する。

## 作業順
1. README.md、docs/handoff.md、TASKS.mdを確認する。
2. 仕様にない大改造は避け、必要な作業をTASKS.mdに反映する。
3. 実装後は関連テスト、`npm run build`、可能なら起動確認を行う。
4. 作業終了時はTASKS.md、docs/handoff.md、tests/test_checklist.mdを更新する。

## フォルダ運用
| フォルダ | 用途 |
|---|---|
| input/ | 参照資料・テンプレート・スタイル定義（読み取り専用） |
| src/ | 実装コード |
| out/ | 中間出力・下書き |
| deliverables/ | ユーザーが単独コピーできる最終成果 |
| docs/ | 仕様・引き継ぎ・判断記録 |
| tests/ | テスト・チェックリスト |

## 禁止事項
- このフォルダより上のディレクトリへのアクセス。
- 既存の deliverables/ 内ファイルの上書き。必要な場合は別名で保存する。
- CLAUDE.md の変更。
- テスト未実施のまま完了扱いにすること。
