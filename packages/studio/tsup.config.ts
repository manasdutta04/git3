import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/bin.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    splitting: false,
  },
  {
    entry: { app: 'src/ui/app.ts' },
    format: ['iife'],
    platform: 'browser',
    dts: false,
    clean: false,
    sourcemap: true,
    splitting: false,
    outDir: 'dist/ui',
    outExtension() {
      return { js: '.js' };
    },
  },
]);
