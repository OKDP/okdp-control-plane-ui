import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = 'dist/assets';

const BUDGETS = {
  entry: { warn: 450, error: 550 },
  totalJs: { warn: 1300, error: 1600 },
};

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

let files;
try {
  files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`Bundle size check: "${ASSETS}" not found. Run "npm run build" first.`);
  process.exit(1);
}

let totalRaw = 0;
let entryRaw = 0;
let entryName = '(none)';
for (const f of files) {
  const size = statSync(join(ASSETS, f)).size;
  totalRaw += size;
  if (/^index-.*\.js$/.test(f) && size > entryRaw) {
    entryRaw = size;
    entryName = f;
  }
}

const checks = [
  { label: `entry (${entryName})`, bytes: entryRaw, budget: BUDGETS.entry },
  { label: 'total JS', bytes: totalRaw, budget: BUDGETS.totalJs },
];

let failed = false;
console.log('Bundle size check (raw, uncompressed):');
for (const c of checks) {
  // Compared in bytes so a size just under the budget is not rounded past it.
  let status = 'OK';
  if (c.bytes >= c.budget.error * 1024) {
    status = 'ERROR';
    failed = true;
  } else if (c.bytes >= c.budget.warn * 1024) {
    status = 'WARN';
  }
  console.log(
    `  ${status.padEnd(5)} ${c.label}: ${kb(c.bytes)} KB (warn ${c.budget.warn}, error ${c.budget.error})`,
  );
}

if (failed) {
  console.error('Bundle size budget exceeded. Reduce the bundle or raise the budget deliberately.');
  process.exit(1);
}
