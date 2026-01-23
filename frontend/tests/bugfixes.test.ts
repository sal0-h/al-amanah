import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Tests for frontend bug fixes from BUG_REPORT.md
 */

describe('Logo Theme Reactivity (Bug #5)', () => {
  it('Dashboard logo has key={theme} for reactivity', () => {
    const content = readFileSync(join(__dirname, '../src/pages/Dashboard.tsx'), 'utf-8');
    expect(content).toMatch(/<img\s+key=\{theme\}/);
  });

  it('Login logo has key={theme} for reactivity', () => {
    const content = readFileSync(join(__dirname, '../src/pages/Login.tsx'), 'utf-8');
    expect(content).toMatch(/<img\s+key=\{theme\}/);
  });

  it('AdminPanel logo has key={theme} for reactivity', () => {
    const content = readFileSync(join(__dirname, '../src/pages/AdminPanel.tsx'), 'utf-8');
    expect(content).toMatch(/<img\s+key=\{theme\}/);
  });
});

describe('Week Boundary UI (Bug #8)', () => {
  it('AdminPanel has week boundary tooltips', () => {
    const content = readFileSync(join(__dirname, '../src/pages/AdminPanel.tsx'), 'utf-8');
    expect(content).toContain('title="Week starts on Sunday"');
    expect(content).toContain('Sunday-Saturday');
  });
});

describe('PWA Manifest Improvements (Bug #10)', () => {
  let manifest: Record<string, unknown>;

  beforeAll(() => {
    const content = readFileSync(join(__dirname, '../public/manifest.webmanifest'), 'utf-8');
    manifest = JSON.parse(content);
  });

  it('has id field', () => {
    expect(manifest.id).toBe('/');
  });

  it('has scope field', () => {
    expect(manifest.scope).toBe('/');
  });

  it('has description', () => {
    expect(manifest.description).toBeDefined();
    expect((manifest.description as string).length).toBeGreaterThan(0);
  });

  it('has orientation field', () => {
    expect(manifest.orientation).toBe('portrait-primary');
  });

  it('icons have correct purpose (not maskable)', () => {
    const icons = manifest.icons as Array<{ purpose: string }>;
    for (const icon of icons) {
      expect(icon.purpose).toBe('any');
    }
  });
});
