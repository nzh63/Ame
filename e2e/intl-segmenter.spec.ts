import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/** Segment `text` in the page context using `Intl.Segmenter`. */
function segmentInPage(page: Page, text: string, language: string): Promise<string[]> {
  return page.evaluate(
    ({ t, lang }: { t: string; lang: string }) => {
      const segmenter = new Intl.Segmenter(lang, { granularity: 'word' });
      return Array.from(segmenter.segment(t)).map((s) => s.segment);
    },
    { t: text, lang: language },
  );
}

test.describe('Intl.Segmenter (frontend word segmentation)', () => {
  test('Intl.Segmenter is available in WebView2', async ({ page }) => {
    const available = await page.evaluate(() => typeof Intl.Segmenter === 'function');
    expect(available).toBe(true);
  });

  test('segments Japanese into words with the ja locale', async ({ page }) => {
    const words = await segmentInPage(page, '私はガラスを食べられます', 'ja');
    // '私はガラスを食べられます' should break into multiple words, not per-char.
    expect(words.length).toBeGreaterThan(1);
    // The whole text must be preserved (no lost characters).
    expect(words.join('')).toBe('私はガラスを食べられます');
  });

  test('preserves whitespace and separators as their own segments', async ({ page }) => {
    const words = await segmentInPage(page, 'こんにちは。 世界', 'ja');
    expect(words.join('')).toBe('こんにちは。 世界');
    // The full-width period and space are preserved.
    expect(words.some((w) => w === '。')).toBe(true);
    expect(words.some((w) => w.trim() === '')).toBe(true);
  });

  test('falls back gracefully for an unsupported locale', async ({ page }) => {
    // A bogus locale should not throw; Intl falls back to the default locale.
    const words = await segmentInPage(page, 'hello world', 'xx-XX');
    expect(words.join('')).toBe('hello world');
  });
});
