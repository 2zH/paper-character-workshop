import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const archive = new URL('dist/versions/github-first/', root);
const manifest = JSON.parse(await readFile(new URL('snapshot.json', archive), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

check(manifest.sourceCommit === '679d3684ceec749ee8ed5be270d1730550c417c3', 'snapshot has a fixed, known source commit');
check(manifest.files.length > 0 && new Set(manifest.files.map(file => file.path)).size === manifest.files.length, 'the source snapshot lists every app file once');
for (const file of manifest.files) {
  const content = await readFile(new URL(file.path, archive));
  check(hash(content) === file.snapshotSha256, `${file.path} still matches the preserved snapshot`);
  let original = content.toString();
  if (file.relocatedCssAssets) original = original.replaceAll('../../../assets/', '../assets/');
  if (file.isolatedStorageKey) {
    const isolated = "const STORAGE = 'paper-character-workshop-github-first-v1';";
    check(original.split(isolated).length === 2, 'only one storage constant is isolated in the preserved app');
    original = original.replace(isolated, "const STORAGE = 'paper-character-workshop-v1';");
  }
  check(hash(original) === file.sourceSha256, `${file.path} only changes audited asset paths or the isolated storage constant`);
  if (file.relocatedCssAssets) {
    for (const [, reference] of content.toString().matchAll(/url\(['"]?(\.\.\/[^)'"\s]+)['"]?\)/g)) {
      await access(new URL(reference, new URL(file.path, archive)));
    }
  }
}

const html = await readFile(new URL('dist/workshop-original.html', root), 'utf8');
check(hash(html) === manifest.pageSha256, 'the archive HTML remains its documented snapshot wrapper');
check(!html.includes('<base'), 'document-relative artwork and local SVG fragments retain their original base');
check(html.includes('GitHub 初版 · 独立纸框') && html.includes('href="workshop.html"'), 'the edition is identifiable and links to the current workshop');
check(html.includes('首次复制当前草稿，之后两版分别保存'), 'the independent save behavior is explained in the preserved edition');
const applicationRefs = [...html.matchAll(/(?:href|src)="([^"?]+\.(?:js|css))/g)].map(match => match[1]);
check(applicationRefs.length === manifest.files.length && applicationRefs.every(ref => ref.startsWith('versions/github-first/workshop/')), 'the preserved page never loads mutable current app code');

for (const documentUrl of ['http://127.0.0.1:4378/workshop-original.html', 'https://2zh.github.io/paper-character-workshop/workshop-original.html']) {
  const base = new URL('.', documentUrl);
  for (const reference of applicationRefs) {
    const expectedPrefix = new URL('versions/github-first/workshop/', base).href;
    check(new URL(reference, base).href.startsWith(expectedPrefix), 'archived app references stay within the archive on each deployment');
    await access(new URL(`dist/${reference}`, root));
  }
  check(new URL('assets/paper-fiber.png', base).pathname.endsWith('/assets/paper-fiber.png'), 'dynamic artwork URLs resolve to shared assets');
  check(new URL('workshop.html', base).pathname.endsWith('/workshop.html'), 'return link resolves to the current workshop');
}

const redirect = await readFile(new URL('index.html', archive), 'utf8');
check(hash(redirect) === manifest.redirectSha256 && redirect.includes('url=../../workshop-original.html'), 'the optional archive-directory URL redirects to the stable root page');

const bootstrap = html.match(/<script id="preserved-version-storage">([\s\S]*?)<\/script>/)?.[1];
check(Boolean(bootstrap) && html.indexOf('id="preserved-version-storage"') < html.indexOf('src="versions/github-first/workshop/workshop-model.js'), 'the one-time draft copy runs before the preserved app loads');
const sourceKey = 'paper-character-workshop-v1', isolatedKey = 'paper-character-workshop-github-first-v1';
const runBootstrap = entries => {
  const data = new Map(entries), writes = [];
  vm.runInNewContext(bootstrap, { localStorage: {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => { data.set(key, value); writes.push(key); }
  } });
  return { data, writes };
};
const saved = JSON.stringify({ activeId: 'kept-character', characters: [{ id: 'kept-character', name: 'Original draft' }] });
const firstOpen = runBootstrap([[sourceKey, saved]]);
check(firstOpen.data.get(isolatedKey) === saved && firstOpen.data.get(sourceKey) === saved, 'first open copies the entire current library without changing its original');
check(firstOpen.writes.length === 1 && firstOpen.writes[0] === isolatedKey, 'the migration only writes to preserved-edition storage');
const reopened = runBootstrap([[sourceKey, saved], [isolatedKey, 'independently edited draft']]);
check(reopened.data.get(isolatedKey) === 'independently edited draft' && reopened.writes.length === 0, 'later opens never replace preserved-edition changes with current-edition drafts');
const empty = runBootstrap([]);
check(empty.writes.length === 0, 'a fresh browser leaves normal sample initialization to the app');
const emptyRecord = runBootstrap([[sourceKey, saved], [isolatedKey, '']]);
check(emptyRecord.writes.length === 0, 'an existing empty or unreadable record is not silently replaced');
assert.doesNotThrow(() => vm.runInNewContext(bootstrap, { localStorage: { getItem() { throw new Error('storage disabled'); } } }));
checks++;
const currentApp = await readFile(new URL('dist/workshop/workshop.js', root), 'utf8');
check(currentApp.includes("const STORAGE = 'paper-character-workshop-v1';"), 'the current edition keeps its original draft storage key');
const sourceModel = await readFile(new URL('workshop/workshop-model.js', archive), 'utf8');
const currentModel = await readFile(new URL('dist/workshop/workshop-model.js', root), 'utf8');
check(sourceModel === currentModel, 'the first GitHub edition and current app use the same character schema and normalizer');
check(!applicationRefs.some(ref => ref.endsWith('workshop-sheet.js')), 'the GitHub first edition keeps independent paper frames, without the later continuous sheet renderer');
const firstApp = await readFile(new URL('workshop/workshop.js', archive), 'utf8');
check(!firstApp.includes('WorkshopSheet'), 'the original application behavior has no continuous-sheet integration');

// Build output intentionally changes only the gallery target, since index is the
// workshop on Pages and the original ten studies are available as studies.html.
if (process.argv.includes('--built')) {
  const built = await readFile(new URL('_site/workshop-original.html', root), 'utf8');
  check(built === html.replace('href="index.html?v=1"', 'href="studies.html?v=1"'), 'Pages only remaps the gallery link in archived HTML');
  await assert.rejects(access(new URL('_site/workshop-button.html', root)), 'the superseded draft archive is excluded from the Pages output');
  checks++;
}
console.log(`Preserved first GitHub edition: ${checks} integrity and reference checks passed.`);
