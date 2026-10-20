// Deletes the local JSON database so the next start reseeds from the catalog.
// Usage (Git Bash): npx tsx packages/db/scripts/reset-json.ts   (set HOMED_DATA_DIR to target a dir)
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from '../src/index';

const dir = dataDir();
const targets = [join(dir, 'homed-db.json'), join(dir, 'homed-db.json.tmp')];

for (const file of targets) {
  if (existsSync(file)) {
    rmSync(file);
    console.log(`deleted ${file}`);
  } else {
    console.log(`not found, skipped ${file}`);
  }
}
console.log('done: the next start reseeds the JSON store');
