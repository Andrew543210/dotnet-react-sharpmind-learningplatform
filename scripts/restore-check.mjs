import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
const source = resolve(process.argv[2] ?? '');
if (!process.argv[2] || !existsSync(source)) throw new Error('Usage: node scripts/restore-check.mjs path/to/database.dump');
const name = `sharpmind_restore_${randomBytes(8).toString('hex')}`;
const temp = `/tmp/${name}.dump`;
function run(args) { const result = spawnSync('docker', ['compose', ...args], { stdio: 'inherit' }); if (result.status !== 0) throw new Error('Restore verification failed.'); }
run(['cp', source, `db:${temp}`]);
run(['exec', '-T', 'db', 'createdb', '-U', 'sharpmind', name]);
try {
  run(['exec', '-T', 'db', 'pg_restore', '--no-owner', '-U', 'sharpmind', '-d', name, temp]);
  run(['exec', '-T', 'db', 'psql', '-U', 'sharpmind', '-d', name, '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT COUNT(*) AS courses FROM "Courses"; SELECT COUNT(*) AS certificates FROM "Certificates"; SELECT COUNT(*) AS media FROM "CourseMedia";']);
  console.log('Database archive restored successfully into an isolated check database. Also inspect media files and exercise the restored app before relying on a production recovery plan.');
} finally {
  if (!/^sharpmind_restore_[a-f0-9]+$/.test(name)) throw new Error('Unsafe restore-check database name.');
  run(['exec', '-T', 'db', 'dropdb', '-U', 'sharpmind', name]);
}
