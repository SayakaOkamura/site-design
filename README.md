# site-design

サイトデザイン案の作成・比較用リポジトリ。素の HTML / CSS のみで、ビルドは不要。
GitHub Pages でそのまま公開する前提の構成。

## 構成

```
.
├── index.html              デザイン案のインデックス（公開トップ）
├── .nojekyll               Pages で _ 始まりのファイルを無視させない
├── assets/
│   ├── css/
│   │   ├── reset.css       最小リセット
│   │   ├── tokens.css      デザイントークン（色・余白・タイポ）
│   │   └── index.css       インデックスページ専用
│   └── img/                画像
├── designs/
│   ├── IDEAS.md            消した案の記録（実物は git 履歴にある）
│   ├── 005-paper-flow/     デザイン案（1案 = 1ディレクトリ）
│   └── 006-sketches/       試作は 1案 = 1ファイルのこともある
└── templates/
    └── _template/          新規案の雛形
```

## 新しいデザイン案を追加する

1. `templates/_template/` を `designs/0NN-案の名前/` にコピー
2. `index.html` / `style.css` を編集
3. ルートの `index.html` のカードを 1 枚コピーして、リンク先と説明を差し替える

案ごとの `style.css` では色・余白を直値で書かず、`tokens.css` の `var(--…)` を参照する。
案そのものが配色違いの検証なら、その案の `style.css` の先頭で `:root` のトークンを上書きする。

## 確認方法

`index.html` をブラウザで開くだけ。サーバは不要。

## 公開（GitHub Pages）

`main` ブランチのルートを Pages として公開している。push すれば数十秒で反映される。
