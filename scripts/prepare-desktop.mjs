import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const standalone = join(process.cwd(), '.next', 'standalone');
await rm(join(standalone, 'public'), { recursive: true, force: true });
await mkdir(join(standalone, '.next'), { recursive: true });
await cp(join(process.cwd(), 'public'), join(standalone, 'public'), { recursive: true });
await cp(join(process.cwd(), '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });
