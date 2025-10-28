import { test, expect } from '@playwright/test';

test('ThreeCards visual baseline', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Hover to choose your universe oracle card').waitFor({ timeout: 15000 });
  await expect(page).toHaveScreenshot('threecards-desktop.png', { fullPage: true });
});
