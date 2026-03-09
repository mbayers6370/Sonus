import { spawnSync } from 'node:child_process';

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const hasSonarConfig =
  Boolean(process.env.SONAR_HOST_URL) &&
  Boolean(process.env.SONAR_TOKEN) &&
  Boolean(process.env.SONAR_PROJECT_KEY);

if (hasSonarConfig) {
  console.log('Running Sonar scan via @sonar/scan...');
  run('npx', [
    '--yes',
    '@sonar/scan',
    `-Dsonar.host.url=${process.env.SONAR_HOST_URL}`,
    `-Dsonar.token=${process.env.SONAR_TOKEN}`,
    `-Dsonar.projectKey=${process.env.SONAR_PROJECT_KEY}`,
    `-Dsonar.projectName=${process.env.SONAR_PROJECT_NAME || process.env.SONAR_PROJECT_KEY}`,
    '-Dsonar.sources=backend/src,sonus-react/src',
    '-Dsonar.tests=backend/src,sonus-react/src',
    '-Dsonar.test.inclusions=**/*.test.ts,**/*.test.tsx',
    '-Dsonar.typescript.tsconfigPaths=backend/tsconfig.json,sonus-react/tsconfig.json',
  ]);
} else {
  console.log(
    'SONAR_* environment variables not set. Running fallback static scan (lint + backend typecheck + frontend build).'
  );
  run('npm', ['run', 'lint']);
  run('npm', ['--prefix', 'backend', 'run', 'typecheck']);
  run('npm', ['--prefix', 'sonus-react', 'run', 'build']);
}
