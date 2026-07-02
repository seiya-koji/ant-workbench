# Ant Workbench

> 本ファイルは [README.md](README.md) の日本語訳（内容確認用）です。

[![VS Marketplace Version](https://badgen.net/vs-marketplace/v/seiya-koji.ant-workbench?label=version)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.ant-workbench) [![VS Marketplace Installs](https://badgen.net/vs-marketplace/i/seiya-koji.ant-workbench?label=installs)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.ant-workbench) [![VS Marketplace Rating](https://badgen.net/vs-marketplace/rating/seiya-koji.ant-workbench?label=rating)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.ant-workbench) [![Open VSX Version](https://img.shields.io/open-vsx/v/seiya-koji/ant-workbench?label=open%20vsx)](https://open-vsx.org/extension/seiya-koji/ant-workbench) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

専用のサイドバーから Ant ビルドファイルを参照し、ターゲットを VS Code から直接実行できます。Java プロジェクトでは、Eclipse の `.classpath` ファイルを生成して Java 言語サーバー（`eclipse.jdt.ls`）が Ant と同じクラスパスを解決できるようにすることもできます。

## 概要

Ant Workbench は、ワークスペース内のすべての Ant ビルドファイルを一元管理するサイドバーを提供します。ターゲットの一覧表示・ワンクリック実行・フォルダーごとの複数ビルドファイル管理が、VS Code を離れることなく行えます。

### `.classpath` 生成が役立つケース

[Language Support for Java](https://marketplace.visualstudio.com/items?itemName=redhat.java)（Red Hat）を併用している場合、プロジェクトが Ant では問題なくビルドできるにもかかわらず赤い波線が表示されることがあります。これは、`.classpath` が古くなっていたり、VS Code が解決できない形式になっていたりする場合に起こります。たとえば Eclipse からエクスポートしたプロジェクトには、サーバーランタイムコンテナー・ワークスペース相対変数・古いプロジェクト参照などが含まれることがあり、VS Code ではそれらを解決できません。

Ant Workbench は **ビルドファイルを信頼できる唯一の情報源** として扱います。ビルド自身が持つ `<path>` 定義（`include`/`exclude` ルールを含む）を再利用してプロジェクト相対パスの `.classpath` を生成するため、言語サーバーは Ant がコンパイルするときとまったく同じクラスパスを解決できます。

## 機能

- **サイドバーツリー** — ワークスペース内の Ant ビルドファイルを検出し、ターゲット一覧を表示します。
- **ターゲット実行** — 任意のターゲットを Ant で実行し、出力をアウトプットチャンネルにストリーミングします。
- **アクティブビルドファイル** — フォルダーに複数のビルドファイル（例: `build.xml` と `build-app.xml`）がある場合に、使用するファイルをアクティブに指定できます。ターゲットを明示しない生成と自動生成はアクティブファイルを使用します。
- **`.classpath` 生成** _（オプション）_ — ビルドファイルの `<path>`（デフォルト id: `classpath`）から Eclipse の `.classpath` を生成し、Java プロジェクト設定を再読み込みします。
- **自動生成** _（オプション）_ — ビルドファイルが変更されたときに `.classpath` を自動的に再生成します。

## 必要なもの

- `PATH` 上の [Apache Ant](https://ant.apache.org/)（または `antWorkbench.antPath` で指定）
- `.classpath` 生成を使う場合のみ: [Language Support for Java](https://marketplace.visualstudio.com/items?itemName=redhat.java) 拡張機能

## 使い方

1. アクティビティバーから **Ant Workbench** ビューを開きます。
2. フォルダーに複数のビルドファイルがある場合は、使用するファイルの **Set as Active** をクリックします。アクティブなファイルはツリー内にマークされます。
3. ビルドファイルを展開してターゲット一覧を表示します。
4. ターゲットの **Run** をクリックして実行します。
5. _（オプション）_ ビルドファイルのインラインアクション **Generate .classpath** を使って、Java 言語サーバーの解決情報を更新します。

## 設定

| 設定                           | 既定値          | 説明                                                             |
| ------------------------------ | --------------- | ---------------------------------------------------------------- |
| `antWorkbench.antPath`         | `ant`           | Ant 実行ファイルへのパス。                                       |
| `antWorkbench.buildFileGlob`   | `**/build*.xml` | ビルドファイルの検出に使用するグロブ（`<project>` 以外は無視）。 |
| `antWorkbench.exclude`         | `[]`            | 検出から除外するグロブ。空の場合は `files.exclude` に従います。  |
| `antWorkbench.classpathPathId` | `classpath`     | `.classpath` 生成に使用する `<path>` の id。                     |
| `antWorkbench.autoGenerate`    | `false`         | ビルドファイル変更時に `.classpath` を自動再生成します。         |

末尾の 2 つの設定は、`.classpath` 生成機能を使う場合にのみ適用されます。

## `.classpath` 生成の仕組み（オプション機能）

この機能は、Ant と併せて Java 言語サーバーを使う場合に役立ちます。選択したビルドファイルの隣に小さなジェネレータースクリプトが配置され、ビルドファイルをインポートして `<path>` をプロジェクト相対の `<classpathentry>` ライブラリエントリーに変換します。ジェネレーターはビルドファイルのディレクトリから実行されるため、ビルド自身の basedir 相対プロパティが正しく解決されます。生成された `.classpath` は通常の Eclipse ファイルです。マシンごとにローカルで生成されるものなので、`.gitignore` に追加することを推奨します。
