# Safari History Detail

Safariのブラウズ履歴データベース（`History.db`）を読み込み、訪問履歴を詳細に確認できるWebアプリです。

- **プライバシー重視**: `History.db` はサーバーへアップロードされません。すべての解析はブラウザ内でWebAssembly版SQLite ([sql.js](https://sql.js.org/)) を使って行われます。
- Nuxt 4 + Vuetify 3 + Vite + pnpm で構築。

## 主な機能

- `History.db` をドラッグ&ドロップ／ファイル選択で読み込み
- 訪問履歴一覧（タイトル・URL・ドメイン・訪問日時・そのURLの累計訪問回数・状態フラグ）を仮想スクロールテーブルで表示
- タイトル/URL検索、ドメイン絞り込み、日付範囲、読み込み失敗のみ／リダイレクトのみ／自動生成履歴のみのフィルタ
- 行をクリックすると詳細ダイアログを表示（内部タイムスタンプの変換値、HTTPステータス、読み込み成否、リダイレクト元/先のvisit ID、origin/generation/attributes/scoreなどSQLiteの生データ）
- よく訪れたドメインTop 10の集計
- フィルタ後のデータをJSON/CSVでエクスポート

## History.db の場所（macOS）

Safariを終了してから、Finderの「移動」→「フォルダへ移動」で以下を開きます。

```
~/Library/Safari/
```

`History.db` をコピーし、このアプリの画面にドラッグ&ドロップしてください（Safari実行中はDBがロックされているため、必ずコピーしてから読み込んでください）。

## セットアップ

```bash
pnpm install
```

## 開発サーバー

```bash
pnpm dev
```

`http://localhost:3000` で起動します。

## ビルド

```bash
pnpm build
```

本アプリはクライアントサイドのみで完結するSPA (`ssr: false`) です。`pnpm generate` で静的ホスティング用の出力も生成できます。

## 技術スタック

- [Nuxt 4](https://nuxt.com/)
- [Vite](https://vite.dev/)
- [Vuetify](https://vuetifyjs.com/)（[vuetify-nuxt-module](https://npmjs.com/package/vuetify-nuxt-module) 経由）
- [sql.js](https://sql.js.org/)（ブラウザ内SQLite/WebAssembly）
- [pnpm](https://pnpm.io/)

## 実装メモ

- SafariのSQLiteスキーマ（`history_items` / `history_visits`）を `hv.history_item = hi.id` で結合して1訪問=1行として取得しています。
- `visit_time` はCore Dataのタイムスタンプ（2001-01-01 UTCからの秒数）のため、`+ 978307200` 秒したうえで `Date` に変換しています。
