/**
 * Build script for opencode packages.
 * Bundles @opencode-ai/llm (and its dependency @opencode-ai/schema)
 * into ESM JS files that can be imported at runtime by evi-ide.
 *
 * The bundled output goes to ext/opencode-bundled/ with a package.json
 * that mirrors @opencode-ai/llm's export map so imports like
 *   import { LLM, LLMClient } from '@opencode-ai/llm'
 *   import { OpenAI } from '@opencode-ai/llm/providers/openai'
 * resolve at compile time (via tsconfig paths) and runtime (via bundled JS).
 */

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OPENCODE_DIR = path.join(ROOT, 'ext/opencode');
const LLM_PKG_DIR = path.join(OPENCODE_DIR, 'packages/llm');
const SCHEMA_PKG_DIR = path.join(OPENCODE_DIR, 'packages/schema');
const OUT_DIR = path.join(ROOT, 'ext/opencode-bundled/llm');

// Entry points matching @opencode-ai/llm's package.json exports
const ENTRY_POINTS = {
  'index': path.join(LLM_PKG_DIR, 'src/index.ts'),
  'route': path.join(LLM_PKG_DIR, 'src/route/index.ts'),
  'provider': path.join(LLM_PKG_DIR, 'src/provider.ts'),
  'tool': path.join(LLM_PKG_DIR, 'src/tool.ts'),
  'tool-runtime': path.join(LLM_PKG_DIR, 'src/tool-runtime.ts'),
  'providers/openai': path.join(LLM_PKG_DIR, 'src/providers/openai.ts'),
  'providers/anthropic': path.join(LLM_PKG_DIR, 'src/providers/anthropic.ts'),
  'providers/google': path.join(LLM_PKG_DIR, 'src/providers/google.ts'),
  'providers/openai-compatible': path.join(LLM_PKG_DIR, 'src/providers/openai-compatible.ts'),
  'providers/azure': path.join(LLM_PKG_DIR, 'src/providers/azure.ts'),
  'providers/openrouter': path.join(LLM_PKG_DIR, 'src/providers/openrouter.ts'),
  'providers/xai': path.join(LLM_PKG_DIR, 'src/providers/xai.ts'),
  'providers/amazon-bedrock': path.join(LLM_PKG_DIR, 'src/providers/amazon-bedrock.ts'),
  'protocols/openai-chat': path.join(LLM_PKG_DIR, 'src/protocols/openai-chat.ts'),
  'protocols/openai-responses': path.join(LLM_PKG_DIR, 'src/protocols/openai-responses.ts'),
  'protocols/anthropic-messages': path.join(LLM_PKG_DIR, 'src/protocols/anthropic-messages.ts'),
  'protocols/gemini': path.join(LLM_PKG_DIR, 'src/protocols/gemini.ts'),
};

/**
 * Resolve @opencode-ai/* package names to their source TypeScript files.
 */
function createOpencodePlugin() {
  return {
    name: 'opencode-resolve',
    setup(build) {
      // Resolve @opencode-ai/schema and its subpath exports
      build.onResolve({ filter: /^@opencode-ai\/schema(?:\/.+)?$/ }, (args) => {
        const sub = args.path.replace(/^@opencode-ai\/schema/, '') || '/index';
        const tsPath = path.join(SCHEMA_PKG_DIR, 'src', sub + '.ts');
        if (fs.existsSync(tsPath)) return { path: tsPath };
        // Try /index.ts
        const indexTs = path.join(SCHEMA_PKG_DIR, 'src', sub, 'index.ts');
        if (fs.existsSync(indexTs)) return { path: indexTs };
        return { path: tsPath };
      });

      // Resolve @opencode-ai/llm internal re-exports (llm/route, etc.)
      build.onResolve({ filter: /^@opencode-ai\/llm(?:\/.+)?$/ }, (args) => {
        const sub = args.path.replace(/^@opencode-ai\/llm/, '') || '/index';
        const tsPath = path.join(LLM_PKG_DIR, 'src', sub + '.ts');
        if (fs.existsSync(tsPath)) return { path: tsPath };
        const indexTs = path.join(LLM_PKG_DIR, 'src', sub, 'index.ts');
        if (fs.existsSync(indexTs)) return { path: indexTs };
        return { path: tsPath };
      });
    },
  };
}

async function main() {
  console.log(`Building opencode LLM bundle to ${OUT_DIR}`);

  // Clean output
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Build with esbuild
  // splitting: true ensures shared modules (e.g. Model class) live in a single
  // shared chunk so that `instanceof` checks work across entry points.
  const result = await esbuild.build({
    entryPoints: ENTRY_POINTS,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outdir: OUT_DIR,
    outbase: path.join(LLM_PKG_DIR, 'src'),
    plugins: [createOpencodePlugin()],
    external: ['effect'],
    sourcemap: false,
    minify: false,
    keepNames: true,
    legalComments: 'none',
    splitting: true,
    chunkNames: 'chunk-[name]-[hash]',
    outExtension: { '.js': '.mjs' },
    banner: {
      js: '// @opencode-ai/llm bundle for evi-ide',
    },
  });

  if (result.errors.length > 0) {
    console.error('Build errors:', result.errors);
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('Build warnings:', result.warnings);
  }

  // Generate exports map from entry points
  const exportMap = {};
  for (const [key] of Object.entries(ENTRY_POINTS)) {
    const exportPath = key === 'index' ? '.' : `./${key}`;
    const sourcePath = `./${key.replace(/^index$/, 'index')}.mjs`;
    exportMap[exportPath] = sourcePath;
  }

  // Write package.json for the bundled package
  const bundledPkg = {
    name: '@opencode-ai/llm',
    version: '0.0.0-bundled',
    type: 'module',
    private: true,
    exports: exportMap,
    dependencies: {
      effect: '4.0.0-beta.83',
    },
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'package.json'),
    JSON.stringify(bundledPkg, null, 2),
  );

  // Copy @opencode-ai/schema types for compile-time resolution
  // We need schema's .d.ts files so TypeScript can type-check
  console.log('Build complete!');
  console.log(`Output: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
