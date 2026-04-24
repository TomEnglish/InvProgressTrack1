import { test, expect } from '@playwright/test';
import { loginAsAdmin, freshTestEmail } from './helpers/auth';

test.describe('Phase 1 — Admin Hub provisions a new user', () => {
  test('admin creates a viewer account and sees it in the users table', async ({ page }) => {
    const newUserEmail = freshTestEmail();
    const tempPassword = 'UATWelcome123!';

    await loginAsAdmin(page);

    await page.click('text=Admin Hub');
    await expect(page.locator('h2', { hasText: 'User Administration' })).toBeVisible();

    await page.click('button:has-text("Add User")');

    const modal = page.locator('h3:has-text("Create User Account")').locator('..').locator('..');
    await expect(modal).toBeVisible();

    await modal.locator('input[type="email"]').fill(newUserEmail);
    await modal.locator('input[type="password"]').fill(tempPassword);
    await modal.locator('select').selectOption('viewer');

    await modal.locator('button:has-text("Create User")').click();

    await expect(page.locator('td', { hasText: newUserEmail })).toBeVisible({ timeout: 10_000 });
  });
});
