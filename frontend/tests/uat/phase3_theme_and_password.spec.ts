import { test, expect } from '@playwright/test';
import { createTestUser, loginAs } from './helpers/auth';

test.describe('Phase 3 — Theme toggle and in-app password change', () => {
  test('user toggles dark mode and updates password from header key modal', async ({ page }) => {
    const { email, password } = await createTestUser();
    await loginAs(page, email, password);

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.click('button[title="Toggle Dark Mode"]');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Logo shifts to solid Neon Cyan rect in dark mode
    await expect(page.locator('header svg[aria-label="Invenio"] rect[fill="#0891B2"]')).toHaveCount(1);

    await page.click('button[title="Update Security Profile"]');
    await expect(page.locator('h3', { hasText: 'Initialize Security Architecture' })).toBeVisible();

    const newPassword = 'ThemeRotatedKey789!';
    const modal = page.locator('h3:has-text("Initialize Security Architecture")').locator('..');
    await modal.locator('input[type="password"]').first().fill(newPassword);
    await modal.locator('input[type="password"]').nth(1).fill(newPassword);
    await modal.locator('button:has-text("Update Matrix")').click();

    await expect(page.locator('text=Credential Overwrite Complete')).toBeVisible({ timeout: 10_000 });
  });
});
