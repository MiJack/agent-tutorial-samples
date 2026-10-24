import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const digest = (text) => createHash('sha256').update(text).digest('hex');
const baseline = JSON.parse(await read('docs/references/ui/UI-SOURCES.json'));
const scanning =
  [
    'streamdown',
    '@streamdown/code',
    '@streamdown/cjk',
    '@streamdown/math',
    '@streamdown/mermaid',
  ]
    .map((name) => `@source "../../node_modules/${name}/dist/*.js";`)
    .join('\n') + '\n\n';
for (const file of baseline.files) {
  let actual = await read(file.path);
  if (file.path === 'src/app/globals.css') {
    assert.ok(
      actual.includes(scanning),
      'Missing official Streamdown scanning directives',
    );
    actual = actual.replace(scanning, '');
  }
  assert.equal(
    digest(actual),
    file.sha256,
    `Official baseline was modified: ${file.path}`,
  );
}
const manifest = JSON.parse(
  await read('docs/references/ui/AI-ELEMENTS-SOURCES.json'),
);
for (const file of manifest.files) {
  const original = JSON.parse(await read(file.snapshot)).files.find(
    (entry) => digest(entry.content) === file.originalSha256,
  )?.content;
  assert.ok(original, `Missing original source for ${file.path}`);
  const expected = original
    .replaceAll('@/registry/default/ai-elements/', '@/components/ai-elements/')
    .replaceAll('@/registry/default/ui/', '@/components/ai-elements/ui/')
    .replaceAll('@/registry/new-york-v4/ui/', '@/components/ai-elements/ui/')
    .replaceAll('@/components/ui/', '@/components/ai-elements/ui/');
  assert.equal(
    await read(file.path),
    expected,
    `Only import paths may change: ${file.path}`,
  );
}
const extra = JSON.parse(
  await read('docs/references/ui/HARNESS-UI-SOURCES.json'),
);
for (const file of extra)
  assert.equal(
    digest(await read(file.path)),
    file.sha256,
    `Official Harness UI source was modified: ${file.path}`,
  );
const reference = await read(manifest.exampleSource);
const classes = new Set(
  [...reference.matchAll(/className="([^"]*)"/g)].map((match) => match[1]),
);
for (const match of (await read('src/components/chat.tsx')).matchAll(
  /className="([^"]*)"/g,
))
  assert.ok(
    classes.has(match[1]),
    `Custom class outside the specified example: ${match[1]}`,
  );
const stylesheets = (await readdir(new URL('src/', root), { recursive: true }))
  .filter((path) => path.endsWith('.css'))
  .sort();
assert.deepEqual(
  stylesheets,
  ['app/globals.css', 'app/typeset.css'],
  'Unexpected custom stylesheet',
);
console.log(
  `Verified ${manifest.files.length} original AI Elements/dependency files against saved official source; only import paths differ. Baseline ${baseline.files.length} files and example layout classes also verified.`,
);
