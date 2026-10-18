import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('_site/', root);
await mkdir(output, { recursive: true });
await cp(new URL('dist/', root), output, { recursive: true });
const studies = await readFile(new URL('dist/index.html', root), 'utf8');
const workshop = (await readFile(new URL('dist/workshop.html', root), 'utf8'))
  .replace('href="index.html?v=1"', 'href="studies.html?v=1"');
await writeFile(new URL('studies.html', output), studies);
await writeFile(new URL('index.html', output), workshop);
await writeFile(new URL('workshop.html', output), workshop);
await writeFile(new URL('.nojekyll', output), '');
console.log(`GitHub Pages site prepared at ${fileURLToPath(output)}`);

