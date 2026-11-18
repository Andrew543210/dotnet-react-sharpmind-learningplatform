import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
if (existsSync('.env')) process.loadEnvFile('.env');
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const directory = resolve('data/backups', stamp);
mkdirSync(directory, { recursive: true, mode: 0o700 });
function run(args) { const result = spawnSync('docker', ['compose', ...args], { stdio: 'inherit' }); if (result.status !== 0) process.exit(result.status ?? 1); }
run(['exec', '-T', 'db', 'pg_dump', '-U', 'sharpmind', '-d', 'sharpmind', '-Fc', '-f', '/tmp/sharpmind-backup.dump']);
run(['cp', 'db:/tmp/sharpmind-backup.dump', `${directory}/database.dump`]);
const app = spawnSync('docker', ['compose', 'ps', '-a', '-q', 'app'], { encoding: 'utf8' });
if (app.stdout.trim()) {
  run(['cp', 'app:/app/data/media', `${directory}/media`]);
  run(['cp', 'app:/app/data/keys', `${directory}/keys`]);
} else {
  for (const [source, target] of [[process.env.Media__RootPath ?? 'data/media', 'media'], [process.env.DataProtection__KeyPath ?? 'data/keys', 'keys']])
    if (existsSync(source)) cpSync(source, `${directory}/${target}`, { recursive: true });
}
console.log(`Backup created at ${directory}. Keep it access-restricted and copy it to encrypted storage outside this machine.`);
