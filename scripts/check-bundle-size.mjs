import { readdirSync, readFileSync } from 'node:fs';
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
  const size = readFileSync(join(ASSETS, f)).length;
  totalRaw += size;
  if (/^index-.*\.js$/.test(f) && size > entryRaw) {
    entryRaw = size;
    entryName = f;
  }
}

const checks = [
  { label: `entry (${entryName})`, value: kb(entryRaw), budget: BUDGETS.entry },
  { label: 'total JS', value: kb(totalRaw), budget: BUDGETS.totalJs },
];

let failed = false;
console.log('Bundle size check (raw, uncompressed):');
for (const c of checks) {
  let status = 'OK';
  if (c.value >= c.budget.error) {
    status = 'ERROR';
    failed = true;
  } else if (c.value >= c.budget.warn) {
    status = 'WARN';
  }
  console.log(
    `  ${status.padEnd(5)} ${c.label}: ${c.value} KB (warn ${c.budget.warn}, error ${c.budget.error})`,
  );
}

if (failed) {
  console.error('Bundle size budget exceeded. Reduce the bundle or raise the budget deliberately.');
  process.exit(1);
}
