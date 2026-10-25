// Copies src/core into supabase/functions/_shared so the server uses the exact
// same machine library and rules as the app. Run after editing src/core:
//   npm run sync-core
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'src/core');
const to = join(root, 'supabase/functions/_shared');
mkdirSync(to, { recursive: true });

for (const file of readdirSync(from).filter((f) => f.endsWith('.ts'))) {
  const src = readFileSync(join(from, file), 'utf8')
    // Deno and Node need explicit file extensions on relative imports.
    .replace(/from '(\.\/[^']+?)'/g, (_, p) => `from '${p.endsWith('.ts') ? p : p + '.ts'}'`);
  writeFileSync(
    join(to, file),
    `// GENERATED from src/core/${file} by scripts/sync-core.mjs. Edit the original, then run: npm run sync-core\n` + src,
  );
  console.log('synced', file);
}
