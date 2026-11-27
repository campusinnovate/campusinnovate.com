import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
let html = readFileSync('public/index.html','utf8');
for (const file of ['style.css','languages.js','app.js','motion.js','tracking.js','brief.js','brand-refresh.css','systems.js']) {
 const hash = createHash('sha256').update(readFileSync('public/assets/'+file)).digest('hex').slice(0,12);
 html = html.replace(new RegExp('assets/'+file.replace('.','\\.')+'(?:\\?v=[a-f0-9]+)?','g'),'assets/'+file+'?v='+hash);
}
writeFileSync('public/index.html',html);
writeFileSync('site.html',html);
