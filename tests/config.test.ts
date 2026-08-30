import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

type StaticConfig = {
  globalHeaders: Record<string, string>;
  routes: Array<{ route: string; headers: Record<string, string> }>;
  responseOverrides: Record<string, { rewrite: string }>;
};

describe('deployment response policy', () => {
  it('ships security headers and immutable caching for hashed assets', async () => {
    const config = JSON.parse(await readFile('public/staticwebapp.config.json', 'utf8')) as StaticConfig;
    expect(config.globalHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(config.globalHeaders['Content-Security-Policy']).toContain("style-src 'self' 'unsafe-inline'");
    expect(config.globalHeaders['Permissions-Policy']).toContain('camera=()');
    expect(config.globalHeaders['X-Frame-Options']).toBe('DENY');
    expect(config.routes.find(route => route.route === '/assets/main-*')?.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(config.routes.find(route => route.route === '/manifest.webmanifest')?.headers['Content-Type']).toBe('application/manifest+json');
    expect(config.responseOverrides['404'].rewrite).toBe('/404.html');
  });
});
