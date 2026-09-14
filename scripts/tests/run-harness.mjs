import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Directory scanned by the harness, relative to the repository root (the cwd of every gate). */
export const HARNESS_TESTS_DIRECTORY = path.join('scripts', 'tests');
export const HARNESS_TEST_SUFFIX = '.node.mjs';

/**
 * Every harness test, sorted: the single discovery behind `pnpm harness:test`
 * and behind the `harness` step of `pnpm verify` (SDD-0464). A directory with
 * no matching file is an error, never an empty green run.
 */
export function discoverHarnessTests(directory = HARNESS_TESTS_DIRECTORY) {
  const files = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(HARNESS_TEST_SUFFIX))
    .map((entry) => path.join(directory, entry.name))
    .sort();

  if (files.length === 0) {
    throw new Error(`No harness tests found in ${directory} (*${HARNESS_TEST_SUFFIX})`);
  }
  return files;
}

/** Runs the discovered files under `node --test`, inheriting stdio; returns the exit status. */
export function runHarness(files = discoverHarnessTests()) {
  console.log(`Harness discovery: ${files.length} test files`);
  for (const file of files) console.log(`  ${file}`);

  const result = spawnSync(process.execPath, ['--test', ...files], {
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

// CLI boundary: only `node scripts/tests/run-harness.mjs` runs the harness;
// importing this module just exposes the discovery.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = runHarness();
}
