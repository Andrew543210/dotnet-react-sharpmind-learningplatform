import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
process.env.SHARPMIND_TEST_CONNECTION ??= process.env.ConnectionStrings__Database;
if (!process.env.SHARPMIND_TEST_CONNECTION) throw new Error('Set SHARPMIND_TEST_CONNECTION or run local setup first.');
const result = spawnSync('dotnet', ['test', '--no-restore', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
