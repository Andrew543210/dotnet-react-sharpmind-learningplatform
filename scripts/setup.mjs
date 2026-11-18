import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
if (!existsSync('.env')) {
  const db = randomBytes(24).toString('hex');
  const demo = randomBytes(18).toString('base64url');
  writeFileSync('.env', `POSTGRES_PASSWORD=${db}\nPOSTGRES_PORT=54329\nConnectionStrings__Database=Host=localhost;Port=54329;Database=sharpmind;Username=sharpmind;Password=${db}\nASPNETCORE_ENVIRONMENT=Development\nASPNETCORE_URLS=http://localhost:5080\nDemo__Password=${demo}\nContent__MentorEmail=mentor@demo.sharpmind.test\n`, { mode: 0o600 });
  console.log('Created ignored .env with random local credentials.');
}
process.loadEnvFile('.env');
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' && command === 'npm' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run('docker', ['compose', 'up', '-d', '--wait', 'db']);
run('dotnet', ['tool', 'restore']);
run('dotnet', ['restore', '--locked-mode']);
run('npm', ['ci', '--prefix', 'web']);
const flags = ['--migrate'];
if (process.argv.includes('--demo')) flags.push('--seed-demo', '--seed-content');
run('dotnet', ['run', '--project', 'src/SharpMind.Api', '--no-launch-profile', '--', ...flags]);
console.log('Ready. Run node scripts/run.mjs api and node scripts/run.mjs web in separate terminals.');
if (process.argv.includes('--demo')) console.log('Demo emails: admin@demo.sharpmind.test, mentor@demo.sharpmind.test, student@demo.sharpmind.test. Password: Demo__Password in your local .env.');
