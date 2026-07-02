// Removes generated Ant Workbench artifacts (.classpath, .project, build output,
// settings.json created by Add Classpath Target) from sample-workspace before each debug
// session, so the workspace always starts from the "nothing generated yet" state the
// README's walkthrough assumes.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'sample-workspace');

const targets = [
  '.vscode/settings.json',
  'MyApp/.classpath',
  'MyApp/.project',
  'MyApp/bin',
  'MyApp/dist',
  'MyApp-test/.classpath',
  'MyApp-test/.project',
  'MyApp-test/bin',
];

for (const target of targets) {
  fs.rmSync(path.join(root, target), { recursive: true, force: true });
}
