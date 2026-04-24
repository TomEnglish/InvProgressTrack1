import { test, expect } from '@playwright/test';
import { createTestUser, loginAs, logout, supabaseAdmin } from './helpers/auth';

test.describe('REPRO — post-recovery password stability', () => {
  test('new password survives multiple logout/login cycles', async ({ page, baseURL }) => {
    const { email } = await createTestUser();
    const newPassword = 'ReproUAT-Cycle-1!';

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });
    if (error) throw error;
    const tokenHash = data.properties.hashed_token;

    await page.goto(`${baseURL}/reset-password?token_hash=${tokenHash}&type=recovery`);
    await expect(page.locator('h2', { hasText: 'Initialize Security Key' })).toBeVisible();
    await page.locator('input[type="password"]').first().fill(newPassword);
    await page.locator('input[type="password"]').nth(1).fill(newPassword);
    await page.click('button:has-text("Bind Credentials")');
    await expect(page.locator('text=Credentials Bound')).toBeVisible();
    await expect(page).not.toHaveURL(/.*reset-password/, { timeout: 10_000 });

    // Cycle 1 — log out from the recovery session, log back in
    await logout(page);
    await loginAs(page, email, newPassword);

    // Cycle 2 — same creds, same browser context
    await logout(page);
    await loginAs(page, email, newPassword);

    // Cycle 3 — rule out N-specific flake
    await logout(page);
    await loginAs(page, email, newPassword);
  });
});
