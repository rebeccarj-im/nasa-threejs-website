import { test, expect } from '@playwright/test';

test('DONKI share flow', async ({ page }) => {
  await page.goto('/gallery/ring?lib=donki');

  // After entering the page, click the first data card (your locator semantics may differ).
  // Using role=button + aria-label is often more robust, or target the card container directly.
  const firstCard = page.locator('article').first();
  await firstCard.click();

  await expect(page.getByRole('dialog')).toBeVisible();

  const input = page.locator('input[readonly]');
  await expect(input).not.toHaveValue(/Preparing|Creating/);
  const url = await input.inputValue();
  expect(url).toMatch(/^https?:\/\//);

  await page.getByRole('button', { name: /Copy/i }).click();
});
