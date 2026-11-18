import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../web/package.json', import.meta.url));
const { Client } = require('pg');
if (existsSync('.env')) process.loadEnvFile('.env');
const options = { host: process.env.PGHOST ?? 'localhost', port: Number(process.env.PGPORT ?? process.env.POSTGRES_PORT ?? 54329), user: process.env.PGUSER ?? 'sharpmind', password: process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD, database: 'postgres' };
if (!options.password) throw new Error('Configure PGHOST/PGPORT/PGUSER/PGPASSWORD or run local setup.');
const dbName = `sharpmind_e2e_${randomBytes(10).toString('hex')}`;
const db = new Client(options);
await db.connect();
await db.query(`CREATE DATABASE "${dbName}"`);
process.env.ConnectionStrings__Database = `Host=${options.host};Port=${options.port};Database=${dbName};Username=${options.user};Password="${options.password.replaceAll('"', '""')}"`;
process.env.ASPNETCORE_ENVIRONMENT = 'Testing';
process.env.Demo__Password = randomBytes(24).toString('base64url');
process.env.Content__MentorEmail = 'mentor@demo.sharpmind.test';
let status = 1;
try {
  const setup = spawnSync('dotnet', ['run', '--project', 'src/SharpMind.Api', '--no-launch-profile', '--', '--migrate', '--seed-demo', '--seed-content'], { stdio: 'inherit' });
  if (setup.status !== 0) throw new Error('E2E database setup failed.');
  const cli = require.resolve('@playwright/test/cli');
  const result = spawnSync(process.execPath, [cli, 'test', ...process.argv.slice(2)], { cwd: 'web', stdio: 'inherit' });
  status = result.status ?? 1;
} finally {
  if (!/^sharpmind_e2e_[a-f0-9]+$/.test(dbName)) throw new Error('Unsafe test database name.');
  await db.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  await db.end();
}
process.exit(status);
