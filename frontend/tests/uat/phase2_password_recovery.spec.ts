import { test, expect } from '@playwright/test';
import { createTestUser, supabaseAdmin } from './helpers/auth';

test.describe('Phase 2 — Password recovery', () => {
  test('forgot-password form submits cleanly and shows success banner', async ({ page }) => {
    const { email } = await createTestUser();

    await page.goto('/forgot-password');
    await page.fill('input[type="email"]', email);
    await page.click('button:has-text("Send Magic Link")');
    await expect(page.locator('text=Recovery initiated')).toBeVisible({ timeout: 10_000 });
  });

  test('token_hash recovery link completes reset and logs user into dashboard', async ({ page, baseURL }) => {
    const { email } = await createTestUser();
    const newPassword = 'NewUATKey456!';

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });
    if (error) throw error;
    const tokenHash = data.properties.hashed_token;

    await page.goto(`${baseURL}/reset-password?token_hash=${tokenHash}&type=recovery`);
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 10_000 });

    await page.locator('input[type="password"]').first().fill(newPassword);
    await page.locator('input[type="password"]').nth(1).fill(newPassword);
    await page.click('button:has-text("Set New Password")');

    await expect(page.locator('text=Password Updated')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/.*reset-password/, { timeout: 10_000 });
  });
});
