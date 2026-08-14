# セキュリティポリシー

## 対応バージョン

このリポジトリは単一ブランチ（`main`）で運用しています。セキュリティ修正は常に `main` の最新版に対して行われます。過去のタグ／リリースに対する個別のバックポートは行いません。

| バージョン     | サポート状況 |
| -------------- | ------------ |
| `main`（最新） | ✅           |
| それ以外       | ❌           |

## 脆弱性の報告方法

このリポジトリでは GitHub の [Private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) を利用します。

脆弱性を発見した場合は、Issueやpull requestなど公開の場ではなく、このリポジトリの **[Security] タブ → [Report a vulnerability]** から報告してください。

- https://github.com/kytlogia/safario-historilo/security/advisories/new

報告には、再現手順・影響範囲・想定される深刻度など、判断に必要な情報をできる範囲で含めてください。

## 対象となる脆弱性

このアプリはSafariのブラウズ履歴（`History.db`）というローカルの機微データを扱いますが、報告対象はあくまで**アプリの実装上の脆弱性**です。具体例:

- ローカルアクセス制御（`server/utils/history-store.ts` の `assertLocalRequest` など）のバイパス
- 意図しない第三者への `History.db` の内容・存在有無の漏洩
- XSS・インジェクションなど、このアプリのコードに起因する一般的な脆弱性
- 依存パッケージ経由の脆弱性で、このアプリの利用シナリオにおいて実際に悪用可能なもの

以下は**サポート対象外**です。報告いただいても対応できない場合があります。

- `History.db` の中身（あなた自身、または第三者のブラウズ履歴データそのもの）に関する報告
- Safari本体やmacOS自体の脆弱性
- ローカル環境で `NUXT_HISTORY_DB_ALLOW_REMOTE=true` など、ドキュメントに明記された非推奨設定を意図的に有効化した上での挙動

## 対応方針

報告を受け取り次第、内容を確認し、必要に応じて追加情報をお願いすることがあります。修正が完了次第、GitHub Security Advisories経由で報告者に連絡し、公開のタイミングについて相談させていただきます。
