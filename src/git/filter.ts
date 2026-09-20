import path from 'node:path';

export const DEFAULT_IGNORED_EXTENSIONS = new Set([
  // Binaries & compiled artifacts
  '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
  '.class', '.pyc', '.pyo', '.wasm',
  // Media & assets
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.avif',
  '.mp4', '.mov', '.avi', '.webm', '.mp3', '.wav', '.flac',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar',
  // Fonts
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  // Source maps
  '.map',
]);

export const DEFAULT_IGNORED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'cargo.lock',
  'poetry.lock',
  'composer.lock',
  'gemfile.lock',
  'mix.lock',
  'flake.lock',
  'go.sum',
  'podfile.lock',
]);

export const DEFAULT_IGNORED_DIRS = [
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  '.git',
  '.turbo',
  '.cache',
  'vendor',
];

/**
 * Checks whether a file path should be ignored during code review.
 */
export function shouldIgnoreFile(filePath: string, customExcludes: string[] = []): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = path.basename(normalized);
  const ext = path.extname(normalized).toLowerCase();

  // 1. Check exact filename matches (e.g. package-lock.json)
  if (DEFAULT_IGNORED_FILENAMES.has(basename.toLowerCase())) {
    return true;
  }

  // 2. Check binary and media extensions
  if (DEFAULT_IGNORED_EXTENSIONS.has(ext)) {
    return true;
  }

  // 3. Check minified patterns (e.g. bundle.min.js)
  if (basename.includes('.min.') || basename.endsWith('.bundle.js') || basename.endsWith('.chunk.js')) {
    return true;
  }

  // 4. Check common ignored directories
  const pathSegments = normalized.split('/');
  for (const dir of DEFAULT_IGNORED_DIRS) {
    if (pathSegments.includes(dir)) {
      return true;
    }
  }

  // 5. Check user-defined exclusions
  for (const pattern of customExcludes) {
    const cleanPattern = pattern.trim().replace(/\\/g, '/');
    if (!cleanPattern) continue;

    if (cleanPattern.startsWith('*.')) {
      const targetExt = cleanPattern.slice(1).toLowerCase();
      if (ext === targetExt) return true;
    } else if (normalized === cleanPattern || basename === cleanPattern || normalized.includes(cleanPattern)) {
      return true;
    } else {
      // Glob matching (*, **)
      const regexPattern = cleanPattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');
      const regex = new RegExp(`^${regexPattern}$|${regexPattern}`);
      if (regex.test(normalized)) {
        return true;
      }
    }
  }

  return false;
}
