/**
 * Build script for compiling TypeScript worker to JavaScript
 * Uses esbuild to bundle functions/_worker.ts into functions/_worker.js
 */

const esbuild = require('esbuild');
const path = require('path');

async function build() {
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, '../functions/_worker.ts')],
      bundle: true,
      format: 'esm',
      target: 'es2021',
      outfile: path.join(__dirname, '../functions/_worker.js'),
      platform: 'browser',
      conditions: ['worker', 'browser'],
      external: ['__STATIC_CONTENT_MANIFEST'],
      logLevel: 'info',
    });
    console.log('✅ Worker compiled successfully');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
