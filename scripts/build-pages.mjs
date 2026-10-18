import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('_site/', root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('dist/', root), output, { recursive: true });
const studies = await readFile(new URL('dist/index.html', root), 'utf8');
const workshop = (await readFile(new URL('dist/workshop.html', root), 'utf8'))
  .replace('href="index.html?v=1"', 'href="studies.html?v=1"');
await writeFile(new URL('studies.html', output), studies);
await writeFile(new URL('index.html', output), workshop);
await writeFile(new URL('workshop.html', output), workshop);
// The preserved edition keeps document-relative artwork and SVG fragments intact.
// Its study-gallery link follows the same Pages home-page remapping.
const preservedPage = new URL('workshop-original.html', output);
const preserved = (await readFile(preservedPage, 'utf8'))
  .replace('href="index.html?v=1"', 'href="studies.html?v=1"');
await writeFile(preservedPage, preserved);
await writeFile(new URL('.nojekyll', output), '');
console.log(`GitHub Pages site prepared at ${fileURLToPath(output)}`);

