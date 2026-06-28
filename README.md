# Ant Workbench

[![VS Marketplace Version](https://badgen.net/vs-marketplace/v/seiya-koji.ant-workbench?label=version)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.ant-workbench)
[![VS Marketplace Installs](https://badgen.net/vs-marketplace/i/seiya-koji.ant-workbench?label=installs)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.ant-workbench)
[![VS Marketplace Rating](https://badgen.net/vs-marketplace/rating/seiya-koji.ant-workbench?label=rating)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.ant-workbench)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Browse Ant build files from a dedicated sidebar and run their targets directly from VS Code. For Java projects, it can also generate Eclipse `.classpath` files so the Java language server (`eclipse.jdt.ls`) resolves the same classpath that Ant compiles with.

## Overview

Ant Workbench gives you a unified sidebar for all Ant build files in your workspace. You can browse targets, run them with a single click, and manage multiple build files per folder — without leaving VS Code.

### When `.classpath` generation helps

If your project uses the [Language Support for Java](https://marketplace.visualstudio.com/items?itemName=redhat.java) extension, you may see red squiggles even though the project builds fine with Ant. This often happens with projects that carry a stale or incompatible `.classpath` — for example, projects exported from Eclipse that contain server-runtime containers, workspace-relative variables, or outdated project references that VS Code cannot resolve.

Ant Workbench treats the **build file as the source of truth**. It reuses the build's own `<path>` definition (including its `include`/`exclude` rules) to emit a `.classpath` whose library entries are project-relative, so the language server resolves the exact same classpath that Ant compiles with.

## Features

- **Sidebar tree** — discovers Ant build files in the workspace and lists their targets.
- **Run target** — runs any target with Ant and streams output to an Output channel.
- **Active build file** — when a folder holds more than one build file (e.g. `build.xml` and `build-app.xml`), mark one as active. Generation without an explicit target and auto-generate use the active file.
- **Generate .classpath** _(optional)_ — produces an Eclipse `.classpath` from a build file's `<path>` (default id `classpath`) and reloads the Java project configuration.
- **Auto-generate** _(optional)_ — optionally regenerates `.classpath` when the build file changes.

## Requirements

- [Apache Ant](https://ant.apache.org/) on your `PATH` (or set `antWorkbench.antPath`).
- For `.classpath` generation only: the [Language Support for Java](https://marketplace.visualstudio.com/items?itemName=redhat.java) extension.

## Installation

Install it from the Visual Studio Code Marketplace.

<https://marketplace.visualstudio.com/items?itemName=seiya-koji.ant-workbench>

## Usage

1. Open the **Ant Workbench** view from the Activity Bar.
2. If a folder has multiple build files, click **Set as Active** on the one you use. The active file is marked in the tree.
3. Expand a build file to see its targets.
4. Click **Run** on a target to execute it.
5. _(Optional)_ Use the inline **Generate .classpath** action on a build file to update Java language server resolution.

## Settings

| Setting                        | Default         | Description                                                      |
| ------------------------------ | --------------- | ---------------------------------------------------------------- |
| `antWorkbench.antPath`         | `ant`           | Path to the Ant executable.                                      |
| `antWorkbench.buildFileGlob`   | `**/build*.xml` | Glob used to discover build files (non-`<project>` are ignored). |
| `antWorkbench.exclude`         | `[]`            | Globs excluded from discovery. Empty honors `files.exclude`.     |
| `antWorkbench.classpathPathId` | `classpath`     | Id of the `<path>` reused to generate `.classpath`.              |
| `antWorkbench.autoGenerate`    | `false`         | Regenerate `.classpath` when the build file changes.             |

The last two settings only apply when using the `.classpath` generation feature.

## How `.classpath` generation works (optional)

This feature is useful when using the Java language server alongside Ant. A small generator script is placed next to the selected build file, imports it, and converts the build's `<path>` to project-relative `<classpathentry>` lib entries. Because the generator runs from the build file's directory, the build's own basedir-relative properties resolve correctly. The generated `.classpath` is a normal Eclipse file; consider adding it to `.gitignore` since it is produced locally per machine.
