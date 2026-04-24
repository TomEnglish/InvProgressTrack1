import { Page, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export const adminEmail = process.env.UAT_ADMIN_EMAIL!;
export const adminPassword = process.env.UAT_ADMIN_PASSWORD!;

export const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/');
  await expect(page).toHaveURL(/.*login/);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL(/.*login/, { timeout: 10_000 });
}

export async function loginAsAdmin(page: Page) {
  await loginAs(page, adminEmail, adminPassword);
}

export async function logout(page: Page) {
  await page.click('button[title="Sign Out"]');
  await expect(page).toHaveURL(/.*login/, { timeout: 10_000 });
}

export function freshTestEmail(): string {
  return `uat-test-${Date.now()}@invenio.com`;
}

export async function createTestUser(opts: { role?: 'admin' | 'viewer' } = {}) {
  const email = freshTestEmail();
  const password = 'UATWelcome123!';
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {},
    app_metadata: { provider: 'email', providers: ['email'] },
  });
  if (error) throw error;
  return { email, password, id: data.user.id };
}
