# Ant Workbench

[![VS Marketplace Version](https://badgen.net/vs-marketplace/v/seiya-koji.ant-workbench?label=version)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.ant-workbench)
[![VS Marketplace Installs](https://badgen.net/vs-marketplace/i/seiya-koji.ant-workbench?label=installs)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.ant-workbench)
[![VS Marketplace Rating](https://badgen.net/vs-marketplace/rating/seiya-koji.ant-workbench?label=rating)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.ant-workbench)
[![Open VSX Version](https://img.shields.io/open-vsx/v/seiya-koji/ant-workbench?label=open%20vsx)](https://open-vsx.org/extension/seiya-koji/ant-workbench)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Browse Ant build files from a dedicated sidebar and run their targets directly from VS Code.
For Java projects, it can also generate Eclipse `.classpath` files so the Java language server
(`eclipse.jdt.ls`) resolves the same classpath that Ant compiles with.

## Overview

Ant Workbench gives you a unified sidebar for all Ant build files in your workspace. You can
browse targets, run them with a single click, and manage multiple build files per folder —
without leaving VS Code.

### When `.classpath` generation helps

> [!NOTE]
> **Symptom** — your project uses
> [Language Support for Java](https://marketplace.visualstudio.com/items?itemName=redhat.java),
> and you see red squiggles even though the project builds fine with Ant.

This often happens with projects that carry a stale or incompatible `.classpath` — for example,
projects exported from Eclipse that contain server-runtime containers, workspace-relative
variables, or outdated project references that VS Code cannot resolve.

**The fix:** Ant Workbench treats the build file as the source of truth. It reuses the build's
own `<path>` definition (including its `include`/`exclude` rules) to emit a `.classpath` whose
library entries are project-relative, so the language server resolves the exact same classpath
that Ant compiles with.

## Features

- 🌳 **Sidebar tree** — discovers Ant build files in the workspace and lists their targets.
- ▶️ **Run target** — runs any target with Ant and streams output to an Output channel.
- ⏹️ **Stop target** — a red status bar button appears while a target is running; click it to
  abort.
- 🔗 **Jump to definition** — click a target name to open the build file at the matching
  `<target>` line.
- ⭐ **Default target highlight** — the target named in `<project default="...">` is marked with
  a star icon.
- ✅ **Active build file** — when a folder holds more than one build file (e.g. `build.xml` and
  `build-app.xml`), mark one as active. Generation without an explicit target and auto-generate
  use the active file.
- 📄 **Generate .classpath** _(optional)_ — produces an Eclipse `.classpath` from a build file's
  `<path>` (default id `classpath`), creates a minimal `.project` alongside it if one does not
  already exist, and reloads the Java project configuration.
- 🔄 **Auto-generate** _(optional)_ — optionally regenerates `.classpath` when the build file
  changes.

## Requirements

- [Apache Ant](https://ant.apache.org/) on your `PATH` (or set `antWorkbench.antPath`).
- For `.classpath` generation only: the
  [Language Support for Java](https://marketplace.visualstudio.com/items?itemName=redhat.java)
  extension.

## Installation

Install it from the Visual Studio Code Marketplace.

<https://marketplace.visualstudio.com/items?itemName=seiya-koji.ant-workbench>

## Usage

1. Open the **Ant Workbench** view from the Activity Bar.
2. If a folder has multiple build files, click **Set as Active** on the one you use.
   - The active file is marked in the tree.
3. Expand a build file to see its targets.
   - The default target is marked with a star icon.
4. Click a target name to jump to its definition in the build file.
5. Click the inline **Run** button on a target to execute it.
   - A red **Stop Ant** button appears in the status bar while it runs.
6. _(Optional)_ Use the inline **Generate .classpath** action on a build file to update Java
   language server resolution.

## Settings

| Setting                             | Default         | Description                                                        |
| ----------------------------------- | --------------- | ------------------------------------------------------------------ |
| `antWorkbench.antPath`              | `ant`           | Path to the Ant executable.                                        |
| `antWorkbench.buildFileGlob`        | `**/build*.xml` | Glob used to discover build files (non-`<project>` are ignored).   |
| `antWorkbench.exclude`              | `[]`            | Globs excluded from discovery. Empty honors `files.exclude`.       |
| `antWorkbench.classpathPathId`      | `classpath`     | Id of the `<path>` reused to generate `.classpath`.                |
| `antWorkbench.autoGenerate`         | `false`         | Regenerate `.classpath` when the build file changes.               |
| `antWorkbench.additionalClasspaths` | `[]`            | Additional `.classpath` targets. Add via sidebar or edit manually. |

The last three settings only apply when using the `.classpath` generation feature.

### Generating `.classpath` for additional projects

If a build file configures multiple Eclipse projects — for example a source project and a
companion test project — you can generate a `.classpath` for each.

Use the **Add Classpath Target** inline button in the sidebar:

1. Click the **$(add) Add Classpath Target** icon on the build file row.
2. Pick the Ant `<path>` id from the QuickPick.
   - Paths other than the primary are listed automatically.
3. Select the output directory from the workspace directory list.
4. Optionally pick one or more sibling projects to reference as source (`projectDeps`); press Esc
   to skip.
5. The entry is saved to `antWorkbench.additionalClasspaths` in `.vscode/settings.json`.

The next **Generate .classpath** run also generates the additional file.  
You can also edit the setting directly:

```json
"antWorkbench.additionalClasspaths": [
  {
    "pathId": "test-classpath",
    "outputDir": "MyProject-test",
    "projectDeps": ["MyProject"]
  }
]
```

| Field         | Required | Description                                                              |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `pathId`      | yes      | Id of the Ant `<path>` whose entries become library entries.             |
| `outputDir`   | yes      | Where to write `.classpath`, relative to the workspace folder.           |
| `projectDeps` | no       | Eclipse project names added as `<classpathentry kind="src">` references. |

> [!NOTE]
> The added project must be at the same directory depth as the primary project (sibling)
> for the generated relative paths to resolve correctly.

## How `.classpath` generation works (optional)

This feature is useful when using the Java language server alongside Ant.

- A small generator script is placed next to the selected build file, imports it, and converts
  the build's `<path>` to project-relative `<classpathentry>` lib entries. Because the generator
  runs from the build file's directory, the build's own basedir-relative properties resolve
  correctly.
- Alongside `.classpath`, a minimal `.project` (with `javanature` and `javabuilder`) is written
  in the same directory if one does not already exist. Eclipse JDT LS treats a folder as a Java
  project only when `.project` is present; a `.classpath` on its own is silently ignored.
- An existing `.project` is left untouched so any content managed by the language server (e.g.
  `filteredResources`) is preserved.

Both generated files are normal Eclipse project files; consider adding them to `.gitignore` since
they are produced locally per machine.
