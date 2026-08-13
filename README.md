# Safari History Detail

Safariのブラウズ履歴データベース（`History.db`）を読み込み、訪問履歴を詳細に確認できるWebアプリです。

- **プライバシー重視**: `History.db` はどちらの読み込み方法でも外部サーバーへ送信されません。ファイルの解析処理そのものは常にブラウザ内でWebAssembly版SQLite ([sql.js](https://sql.js.org/)) を使って行われます。
- Nuxt 4 + Vuetify 3 + Vite + pnpm で構築。
- `History.db` の読み込みは**自動読み込みとドラッグ&ドロップの両対応**です（詳細は下記）。

## 主な機能

- `pnpm dev` などNodeサーバーとして起動している場合、ボタン一つで `~/Library/Safari/History.db` を自動読み込み（後述）
- `History.db` をドラッグ&ドロップ／ファイル選択で読み込み
- 訪問履歴一覧（タイトル・URL・ドメイン・訪問日時・そのURLの累計訪問回数・状態フラグ）を仮想スクロールテーブルで表示
- タイトル/URL検索、ドメイン絞り込み、日付範囲、読み込み失敗のみ／リダイレクトのみ／自動生成履歴のみのフィルタ
- 行をクリックすると詳細ダイアログを表示（内部タイムスタンプの変換値、HTTPステータス、読み込み成否、リダイレクト元/先のvisit ID、origin/generation/attributes/scoreなどSQLiteの生データ）
- よく訪れたドメインTop 10の集計
- フィルタ後のデータをJSON/CSVでエクスポート

## History.db の読み込み方法（両対応）

### 1. 自動読み込み（Nodeサーバーとして起動している場合）

`pnpm dev` や `pnpm build && node .output/server/index.mjs` のようにNitroサーバーが起動している環境では、Nitroサーバー(Node.jsプロセス)が **`~/Library/Safari/History.db` をローカルのファイルシステムから直接読み込みます**。画面を開くと自動的に利用可否が判定され、「この Mac の History.db を自動で読み込む」ボタンが表示されます。

- 既定のパスは `~/Library/Safari/History.db` です。`NUXT_HISTORY_DB_PATH` 環境変数で上書きできます。
- 読み込み時は `History.db` 本体に加えて `-wal` / `-shm` ファイルも一時ディレクトリへコピーしてから開くため、元ファイルを変更・破損することなく、Safari実行中でも安全に読み取れます。
- サーバーは読み込んだバイト列をそのままブラウザへ返し、実際のパース処理は他の読み込み方法と同じくブラウザ内のsql.jsで行われます（サーバー側でデータの中身を解析・保持することはありません）。
- macOSでは、ターミナルアプリ（またはNodeを実行するアプリ）に「フルディスクアクセス」権限を付与する必要があります（システム設定 → プライバシーとセキュリティ → フルディスクアクセス）。
- この機能は `node:sqlite`（Node.js 22.5以降に付属）を使用します。利用できない環境や `History.db` が見つからない環境では自動的にドラッグ&ドロップのみの表示にフォールバックします。

### 2. ドラッグ&ドロップ / ファイル選択

`pnpm generate` で生成した静的ホスティング環境など、Nitroサーバーが介在しない場合は自動読み込みボタンは表示されず、従来通り手動での読み込みになります。

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

画面（Vueアプリ）自体はクライアントサイドのみで完結するSPA (`ssr: false`) ですが、`server/api/` 以下にNitroのAPIルートを持つため、`pnpm build && node .output/server/index.mjs` のようにNodeサーバーとして起動すると自動読み込み機能が有効になります。

静的ホスティング用途では引き続き `pnpm generate` が使えます。その場合Nitro APIルートは含まれないため、自動読み込みボタンは表示されずドラッグ&ドロップのみになります（機能は自動的にフォールバックするため、コードの変更は不要です）。

## 技術スタック

- [Nuxt 4](https://nuxt.com/) / [Nitro](https://nitro.build/)
- [Vite](https://vite.dev/)
- [Vuetify](https://vuetifyjs.com/)（[vuetify-nuxt-module](https://npmjs.com/package/vuetify-nuxt-module) 経由）
- [sql.js](https://sql.js.org/)（ブラウザ内SQLite/WebAssembly）
- `node:sqlite`（Node.js組み込み。自動読み込み時のWALマージに使用）
- [pnpm](https://pnpm.io/)

## 実装メモ

- SafariのSQLiteスキーマ（`history_items` / `history_visits`）を `hv.history_item = hi.id` で結合して1訪問=1行として取得しています。
- `visit_time` はCore Dataのタイムスタンプ（2001-01-01 UTCからの秒数）のため、`+ 978307200` 秒したうえで `Date` に変換しています。
- 自動読み込み関連のサーバーコードは `server/utils/history-store.ts`（`History.db`のパス解決・WALマージ・バイト列取得）と `server/api/local-history/`（`status.get.ts` で利用可否判定、`index.get.ts` でバイト列を返却）にあります。フロントエンドは `GET /api/local-history/status` で利用可否を判定し、利用可能な場合のみ `GET /api/local-history` からバイト列を取得して既存の `parseSafariHistoryFile`（ドラッグ&ドロップと共通のsql.jsパーサー）に渡します。
