import { promises as fs } from 'node:fs';
import path from 'node:path';

const outputDirectory = path.resolve('out');

// The Pages site now uses campusinnovate.com as its canonical root, so assets
// must stay root-relative instead of being rewritten to /campusinnovate.com/.
await fs.writeFile(path.join(outputDirectory, '.nojekyll'), '');
await fs.writeFile(path.join(outputDirectory, 'CNAME'), 'campusinnovate.com\n');
