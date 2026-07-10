import type { CorsOptions } from 'cors';

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function collectConfiguredOrigins(): Set<string> {
  const origins = new Set<string>();

  for (const key of ['CLIENT_URL', 'APP_URL'] as const) {
    const value = process.env[key];
    if (value) origins.add(normalizeOrigin(value));
  }

  const extras = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
  for (const entry of extras) {
    const origin = entry.trim();
    if (origin) origins.add(normalizeOrigin(origin));
  }

  if (origins.size === 0) {
    origins.add('http://localhost:5173');
  }

  return origins;
}

function isAllowedOrigin(origin: string, allowed: Set<string>): boolean {
  if (allowed.has(origin)) return true;
  // Vercel production + preview deployments (e.g. *.vercel.app)
  if (/^https:\/\/[\w-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

export function getCorsOptions(): CorsOptions {
  const allowed = collectConfiguredOrigins();

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, isAllowedOrigin(origin, allowed));
    },
    credentials: true,
  };
}
