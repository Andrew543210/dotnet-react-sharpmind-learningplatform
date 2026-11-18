import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
for (const [command, args] of [['npm', ['run', 'build', '--prefix', 'web']], ['dotnet', ['restore', '--locked-mode']], ['dotnet', ['publish', 'src/SharpMind.Api', '-c', 'Release', '--no-restore', '-o', 'data/publish']]]) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' && command === 'npm' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
mkdirSync('data/publish/wwwroot', { recursive: true });
cpSync('web/dist', 'data/publish/wwwroot', { recursive: true });
console.log('Published API and React assets to ignored data/publish. Configure HTTPS, database, media and key paths before deployment.');
