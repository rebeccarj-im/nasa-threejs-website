// tests/e2e/shortlink-landing.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Shortlink landing (/s/:id)', () => {
  // Adjust this to a shortId your test server can resolve.
  // If your tests mock /api/share/create to always return "short-abc",
  // then /s/short-abc should SSR correctly in your app.
  const VALID_SHORT_ID = 'short-abc';
  const INVALID_SHORT_ID = 'does-not-exist-xyz';

  test('resolves and renders preview + primary CTA', async ({ page }) => {
    await page.goto(`/s/${VALID_SHORT_ID}`);

    // Landing should show a headline or title (SSR)
    // Be liberal: either an <h1> or a prominent heading text in a landmark.
    const heading = page.getByRole('heading', { level: 1 }).or(page.getByRole('heading'));
    await expect(heading).toBeVisible();

    // Preview content—often an image; allow for different alt texts.
    const previewImg = page.locator(
      'img[alt*="preview" i], img[alt*="image" i], img[alt*="og" i], figure img'
    ).first();
    await expect(previewImg).toBeVisible();

    // Primary CTA ("Open", "Enter", "Explore", "View"). Could be a <button> or <a>.
    const primaryCta =
      page.getByRole('button', { name: /(open|enter|explore|view)/i })
        .or(page.getByRole('link', { name: /(open|enter|explore|view)/i }));

    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toBeEnabled();

    // Clicking CTA should navigate into the app (e.g., /gallery or /)
    await Promise.all([
      page.waitForURL(/\/gallery|^\/($|\?)/, { waitUntil: 'networkidle' }),
      primaryCta.click(),
    ]);
  });

  test('includes essential OG/Twitter meta tags (SSR)', async ({ page }) => {
    await page.goto(`/s/${VALID_SHORT_ID}`);

    const ogTitle = page.locator('meta[property="og:title"]');
    const ogDesc = page.locator('meta[property="og:description"]');
    const ogImage = page.locator('meta[property="og:image"]');
    const ogUrl = page.locator('meta[property="og:url"]');
    const twitterCard = page.locator('meta[name="twitter:card"]');

    await expect(ogTitle).toHaveAttribute('content', /.+/);
    await expect(ogDesc).toHaveAttribute('content', /.+/);
    await expect(ogImage).toHaveAttribute('content', /https?:\/\/.+/);
    await expect(ogUrl).toHaveAttribute('content', /https?:\/\/.+\/s\/.+/);
    await expect(twitterCard).toHaveAttribute('content', /(summary|summary_large_image)/);
  });

  test('invalid shortId shows fallback message and a way to enter the app', async ({ page }) => {
    await page.goto(`/s/${INVALID_SHORT_ID}`);

    // A helpful message (copy can vary). Match common keywords.
    const hint = page
      .getByText(/(not\s*found|expired|invalid|unavailable)/i)
      .or(page.getByRole('heading', { name: /(not\s*found|expired|invalid)/i }));
    await expect(hint).toBeVisible();

    // Still provide a route back into the app (button or link).
    const backCta =
      page.getByRole('button', { name: /(open|enter|explore|home|go back)/i })
        .or(page.getByRole('link', { name: /(open|enter|explore|home|go back)/i }));

    await expect(backCta).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/gallery|^\/($|\?)/, { waitUntil: 'networkidle' }),
      backCta.click(),
    ]);
  });
});
