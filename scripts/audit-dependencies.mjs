import { spawnSync } from 'node:child_process';
function audit(args) {
  const result = spawnSync('npm', ['audit', '--json', '--prefix', 'web', ...args], { encoding: 'utf8', shell: process.platform === 'win32' });
  const report = JSON.parse(result.stdout);
  if (report.error) throw new Error(report.error.summary ?? 'Dependency audit unavailable.');
  return Object.keys(report.vulnerabilities ?? {});
}
const production = audit(['--omit=dev']);
if (production.length) throw new Error(`Production dependency advisories require review: ${production.join(', ')}`);
const full = audit([]);
if (full.length) throw new Error(`Development dependency advisories require review: ${full.join(', ')}`);
console.log('npm audit: no reported advisories in production or development dependencies.');
