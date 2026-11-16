// Bundles the extension and xtjson-js into dist/extension.cjs (CommonJS, as
// VS Code loads it). Usage: node build.js [--watch]

import * as esbuild from 'esbuild';

const options = {
  entryPoints: ['src/extension.js'],
  outfile: 'dist/extension.cjs',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  external: ['vscode'],
  sourcemap: true,
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}
