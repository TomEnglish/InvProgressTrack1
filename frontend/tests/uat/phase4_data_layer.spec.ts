import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { readFileSync } from 'node:fs';

test.describe('Phase 4 — Data engineering layer', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Earned Value tab renders the EVM table', async ({ page }) => {
    await page.click('text=Earned Value');
    await expect(page.locator('h2', { hasText: 'Earned Value Management' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('th', { hasText: 'SPI' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'CPI' })).toBeVisible();
  });

  test('Executive Overview renders the S-curve chart canvas', async ({ page }) => {
    await page.click('text=Executive Overview');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
  });

  test('Data Upload downloads a Blank Template CSV with expected schema headers', async ({ page }) => {
    await page.click('text=Data Upload');
    await expect(page.locator('h2', { hasText: 'Data Upload' })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Blank Template")'),
    ]);
    const path = await download.path();
    const contents = readFileSync(path, 'utf-8');
    const headerLine = contents.split(/\r?\n/)[0];
    expect(headerLine).toMatch(/dwg/);
    expect(headerLine).toMatch(/budget_hrs/);
    expect(headerLine).toMatch(/actual_hrs/);
    expect(headerLine).toMatch(/percent_complete/);
  });

  test('Data Upload downloads Mock Data CSV containing numeric rows', async ({ page }) => {
    await page.click('text=Data Upload');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Mock Data")'),
    ]);
    const path = await download.path();
    const contents = readFileSync(path, 'utf-8');
    const lines = contents.split(/\r?\n/).filter(Boolean);
    expect(lines.length).toBeGreaterThan(1);
    const bodyRow = lines[1];
    expect(bodyRow).toMatch(/\d/);
  });
});
