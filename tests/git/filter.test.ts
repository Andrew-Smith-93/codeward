import { describe, it, expect } from 'vitest';
import { shouldIgnoreFile } from '../../src/git/filter.js';

describe('Git Filter', () => {
  it('ignores standard lockfiles', () => {
    expect(shouldIgnoreFile('package-lock.json')).toBe(true);
    expect(shouldIgnoreFile('pnpm-lock.yaml')).toBe(true);
    expect(shouldIgnoreFile('yarn.lock')).toBe(true);
    expect(shouldIgnoreFile('cargo.lock')).toBe(true);
    expect(shouldIgnoreFile('nested/dir/cargo.lock')).toBe(true);
    expect(shouldIgnoreFile('poetry.lock')).toBe(true);
  });

  it('ignores binary and media files', () => {
    expect(shouldIgnoreFile('assets/logo.png')).toBe(true);
    expect(shouldIgnoreFile('images/hero.jpg')).toBe(true);
    expect(shouldIgnoreFile('icons/favicon.ico')).toBe(true);
    expect(shouldIgnoreFile('fonts/inter.woff2')).toBe(true);
    expect(shouldIgnoreFile('bin/native.wasm')).toBe(true);
    expect(shouldIgnoreFile('dist/bundle.js.map')).toBe(true);
  });

  it('ignores minified scripts and bundles', () => {
    expect(shouldIgnoreFile('public/vendor.min.js')).toBe(true);
    expect(shouldIgnoreFile('static/app.bundle.js')).toBe(true);
    expect(shouldIgnoreFile('static/styles.min.css')).toBe(true);
  });

  it('ignores excluded directories', () => {
    expect(shouldIgnoreFile('node_modules/express/index.js')).toBe(true);
    expect(shouldIgnoreFile('dist/index.js')).toBe(true);
    expect(shouldIgnoreFile('coverage/lcov-report/index.html')).toBe(true);
    expect(shouldIgnoreFile('.next/server/pages/index.js')).toBe(true);
  });

  it('allows source code files', () => {
    expect(shouldIgnoreFile('src/index.ts')).toBe(false);
    expect(shouldIgnoreFile('src/auth/login.py')).toBe(false);
    expect(shouldIgnoreFile('pkg/api/handlers.go')).toBe(false);
    expect(shouldIgnoreFile('components/Button.tsx')).toBe(false);
  });

  it('supports custom exclude patterns', () => {
    expect(shouldIgnoreFile('src/gen/client.ts', ['src/gen/*'])).toBe(true);
    expect(shouldIgnoreFile('docs/spec.yaml', ['*.yaml'])).toBe(true);
    expect(shouldIgnoreFile('tests/fixtures/data.json', ['tests/fixtures'])).toBe(true);
  });
});
