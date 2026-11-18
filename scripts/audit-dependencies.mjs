import { spawnSync } from 'node:child_process';
function audit(args) {
  const result = spawnSync('npm', ['audit', '--json', '--prefix', 'web', ...args], { encoding: 'utf8', shell: process.platform === 'win32' });
  const report = JSON.parse(result.stdout);
  if (report.error) throw new Error(report.error.summary ?? 'Dependency audit unavailable.');
  return report;
}
const production = audit(['--omit=dev']);
if (Object.keys(production.vulnerabilities ?? {}).length) throw new Error('Production dependency advisories require review.');
const full = audit([]);
const known = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const vulnerabilities = full.vulnerabilities ?? {};
function inspect(name, seen = new Set()) {
  if (seen.has(name)) return;
  seen.add(name);
  for (const cause of vulnerabilities[name]?.via ?? []) {
    if (typeof cause === 'string') inspect(cause, seen);
    else if (cause.url !== known) throw new Error(`New dependency advisory requires review: ${cause.url}`);
  }
}
Object.keys(vulnerabilities).forEach(name => inspect(name));
console.log('Production npm audit: no reported advisories.');
if (Object.keys(vulnerabilities).length) console.log('Development toolchain: unpatched picomatch advisory GHSA-fc5q-39xc-vjpf remains. See docs/security.md; no untrusted glob patterns are accepted by the application.');
