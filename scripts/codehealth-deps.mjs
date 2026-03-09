import { spawnSync } from 'node:child_process';

function listFiles(root, globs) {
  const args = ['--files', root];
  for (const glob of globs) {
    args.push('-g', glob);
  }
  const result = spawnSync('rg', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Failed to list files under ${root}\n`);
    process.exit(result.status ?? 1);
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function cruise(target, tsConfig, files) {
  const result = spawnSync(
    'npx',
    [
      '--yes',
      'dependency-cruiser',
      '--config',
      '.dependency-cruiser.cjs',
      '--ts-config',
      tsConfig,
      '--output-type',
      'json',
      '--',
      ...files,
    ],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'dependency-cruiser failed\n');
    process.exit(result.status ?? 1);
  }

  const payload = JSON.parse(result.stdout || '{}');
  const modules = Array.isArray(payload.modules) ? payload.modules : [];
  const dependencyCount = modules.reduce(
    (sum, moduleRow) => sum + (Array.isArray(moduleRow.dependencies) ? moduleRow.dependencies.length : 0),
    0
  );
  const circularCount = modules.reduce((sum, moduleRow) => {
    const deps = Array.isArray(moduleRow.dependencies) ? moduleRow.dependencies : [];
    return sum + deps.filter((dep) => dep && dep.circular).length;
  }, 0);
  const unresolved = [];
  for (const moduleRow of modules) {
    const deps = Array.isArray(moduleRow.dependencies) ? moduleRow.dependencies : [];
    for (const dep of deps) {
      if (!dep || !dep.couldNotResolve) continue;
      const moduleRef = String(dep.module || '');
      const isExternal = !moduleRef.startsWith('.');
      const isTypeOnlySharedContract = moduleRef.includes('shared/contracts');
      if (isExternal || isTypeOnlySharedContract) continue;
      unresolved.push({ from: moduleRow.source, to: moduleRef });
    }
  }

  return {
    target,
    tsConfig,
    modules: modules.length,
    dependencies: dependencyCount,
    circular: circularCount,
    unresolved: unresolved.length,
    unresolvedSamples: unresolved.slice(0, 10),
  };
}

const backendFiles = listFiles('backend/src', ['*.ts']);
const frontendFiles = listFiles('sonus-react/src', ['*.ts', '*.tsx']);

const scans = [
  cruise('backend/src', 'backend/tsconfig.json', backendFiles),
  cruise('sonus-react/src', 'sonus-react/tsconfig.json', frontendFiles),
];

console.log('Dependency Cruiser summary:');
for (const scan of scans) {
  console.log(
    `- ${scan.target}: modules=${scan.modules}, dependencies=${scan.dependencies}, circular=${scan.circular}, unresolved=${scan.unresolved}`
  );
  if (scan.unresolvedSamples.length > 0) {
    for (const sample of scan.unresolvedSamples) {
      console.log(`  unresolved: ${sample.from} -> ${sample.to}`);
    }
  }
}

const hasIssues = scans.some((scan) => scan.circular > 0 || scan.unresolved > 0);
if (hasIssues) {
  process.exit(1);
}
