import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const directory = path.join('scripts', 'tests');
const files = readdirSync(directory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.node.mjs'))
  .map((entry) => path.join(directory, entry.name))
  .sort();

if (files.length === 0) {
  throw new Error(`No harness tests found in ${directory} (*.node.mjs)`);
}

console.log(`Harness discovery: ${files.length} test files`);
for (const file of files) console.log(`  ${file}`);

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
