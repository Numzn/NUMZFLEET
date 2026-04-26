/**
 * Wrap Traccar-only '/api/...' and "/api/..." string literals with traccarPath().
 * Skips fuel/ERB/public prefixes. Does not modify template literals with ${}.
 * Run from frontend: node scripts/apply-traccar-path.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

const SKIP_FILES = new Set([
  'config/traccarApi.js',
  'operationSessions/api/operationSessionsApi.js',
]);

const FUEL_PREFIXES = [
  '/api/fuel-requests',
  '/api/vehicle-specs',
  '/api/vehicles',
  '/api/operation-sessions',
  '/api/reports',
  '/api/public',
  '/api/erb',
];

function isFuelPath(str) {
  return FUEL_PREFIXES.some((p) => str === p || str.startsWith(`${p}/`) || str.startsWith(`${p}?`));
}

function relImport(fromFile) {
  const dir = path.dirname(fromFile);
  let rel = path.relative(dir, path.join(srcRoot, 'config', 'traccarApi.js')).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function addImport(s, absPath) {
  if (/from ['"][^'"]*config\/traccarApi['"]/.test(s)) return s;
  const line = `import { traccarPath } from '${relImport(absPath)}';\n`;
  const m = s.match(/^import .+$/m);
  if (m) {
    const idx = s.indexOf(m[0]) + m[0].length;
    return `${s.slice(0, idx)}\n${line}${s.slice(idx)}`;
  }
  return `${line}${s}`;
}

function replaceQuotes(s, quote) {
  const re = new RegExp(`${quote}(\\/api\\/[^${quote === "'" ? "'" : '"'}]+)${quote}`, 'g');
  return s.replace(re, (full, inner) => {
    if (isFuelPath(inner)) return full;
    return `${quote}\${traccarPath('${inner}')}${quote}`;
  });
}

// Fix broken output: we want traccarPath('...') not '${traccarPath...}' inside quotes
function replaceQuotesFixed(s, quote) {
  const q = quote;
  const re = new RegExp(`${q === "'" ? "'" : '"'}(\\/api\\/[^${q}]+)${q}`, 'g');
  return s.replace(re, (full, inner) => {
    if (isFuelPath(inner)) return full;
    return `traccarPath(${q}${inner}${q})`;
  });
}

function processFile(absPath, relPath) {
  const key = relPath.replace(/\\/g, '/');
  if (SKIP_FILES.has(key)) return false;
  let s = fs.readFileSync(absPath, 'utf8');
  if (!s.includes('/api/')) return false;

  const before = s;
  s = replaceQuotesFixed(s, "'");
  s = replaceQuotesFixed(s, '"');

  if (s === before) return false;

  s = addImport(s, absPath);
  fs.writeFileSync(absPath, s);
  return true;
}

function walk(dir, base = '') {
  let n = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = path.join(base, e.name);
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) n += walk(abs, rel);
    else if (/\.(js|jsx)$/.test(e.name)) {
      if (processFile(abs, rel)) n += 1;
    }
  }
  return n;
}

const n = walk(srcRoot);
console.log(`Updated ${n} files.`);
