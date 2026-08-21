import { promises as fs } from 'node:fs';
import path from 'node:path';

const outputDirectory = path.resolve('out');
const basePath = '/campusinnovate.com';
const textExtensions = new Set(['.html', '.js', '.css', '.txt', '.xml']);
const publicRoots = ['assets', 'images'];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  }));
  return files.flat();
}

function prefixKnownPath(content, root) {
  const pattern = new RegExp(`(?<!${basePath})/${root}(?=[/\\\\"'?#< )]|$)`, 'g');
  return content.replace(pattern, `${basePath}/${root}`);
}

for (const file of await walk(outputDirectory)) {
  if (!textExtensions.has(path.extname(file))) continue;
  let content = await fs.readFile(file, 'utf8');
  for (const root of publicRoots) content = prefixKnownPath(content, root);
  await fs.writeFile(file, content);
}

await fs.writeFile(path.join(outputDirectory, '.nojekyll'), '');
