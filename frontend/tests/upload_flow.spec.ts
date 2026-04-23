import { test, expect } from '@playwright/test';

test.describe('Progress Tracker E2E Upload Flow', () => {
  test('User logs in, uploads a tracking sequence, and dashboard parses it', async ({ page }) => {
    // 1. Strict Auth Gateway interception
    await page.goto('http://localhost:5173/');
    await expect(page).toHaveURL(/.*login/);
    
    // 2. Perform Login Flow
    await page.fill('input[type="email"]', 'admin@invenio.kis');
    await page.fill('input[type="password"]', 'secure-password123');
    await page.click('button[type="submit"]');

    // 3. Verify Auth context successfully propagates to dashboard
    await expect(page.locator('h2', { hasText: 'Executive Overview' })).toBeVisible({ timeout: 10000 });

    // 4. Navigate Dropzone Pipeline
    await page.click('text=Data Upload');
    await expect(page.locator('h2', { hasText: 'Data Upload' })).toBeVisible();

    // 5. Fill out the target architecture & payload constraints
    await page.fill('input[placeholder="copy-paste UUID here..."]', '550e8400-e29b-41d4-a716-446655440000');
    
    const csvContent = 'dwg,budget_hrs,actual_hrs,percent_complete\nISO-001,100,50,50';
    await page.setInputFiles('input[type="file"]', {
      name: 'test_upload.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    // Handle standard browser alert
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Successfully processed');
      await dialog.accept();
    });

    await page.click('button:has-text("Submit to Pipeline")');

    // 6. Ensure dashboard handles the Edge Function revalidation
    await page.click('text=Executive Overview');
    await expect(page.locator('text=Total Items')).toBeVisible();
  });
});
