import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
if (report.problems?.length) throw new Error('NuGet audit did not complete.');
const packages = (report.projects ?? []).flatMap(p => (p.frameworks ?? []).flatMap(f => [...(f.topLevelPackages ?? []), ...(f.transitivePackages ?? [])]));
const vulnerable = packages.filter(p => p.vulnerabilities?.length);
if (vulnerable.length) throw new Error(`NuGet advisories require review: ${vulnerable.map(p => p.id).join(', ')}`);
console.log('Direct and transitive NuGet audit: no reported advisories.');
