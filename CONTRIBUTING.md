# Contributing

このドキュメントは開発フローに関する取り決めをまとめたものです。ブランチ運用・PRマージルールを含む全体方針は [#51](https://github.com/kytlogia/safario-historilo/issues/51) で検討中で、決定次第このドキュメントに追記していきます。

## Issueの起票

- Issueは必ず [Issue Forms](https://github.com/kytlogia/safario-historilo/issues/new/choose) のテンプレートから作成する（Blank issueは無効化済み）。
  - `バグ報告`（`bug`ラベルが自動付与）
  - `機能要望・改善提案`（`enhancement`ラベルが自動付与）
  - `ドキュメント・運用改善`（`documentation`ラベルが自動付与）
- 上記のいずれにも当てはまらない場合（質問など）は、最も近いテンプレートを選び、内容に応じてラベルを手動調整する。
- 種別ラベルは作成時点で必ず1つ付与された状態にする（テンプレート経由なら自動で満たされる）。
- milestone（対象バージョン）は作成時点では未設定でよい。トリアージ時にリポジトリオーナーが設定する。
- Claude Codeなどのエージェントが自律的にIssueを起票する場合も、同じテンプレート・ルールに従う。
