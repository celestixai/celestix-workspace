import { test, expect } from '@playwright/test';

/**
 * Auth Flow E2E Tests
 * 
 * Tests the complete user journey:
 * 1. Visit app → see login page
 * 2. Register new account
 * 3. Login with credentials
 * 4. See dashboard / workspace
 * 5. Logout
 */

test.describe('Authentication Flow', () => {
  const testEmail = `e2e-${Date.now()}@celestix.ai`;
  const testPassword = 'E2eTestPass123!';

  test('should show login page on first visit', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login or show login UI
    await expect(
      page.getByRole('heading', { name: /login|sign in|welcome/i })
        .or(page.getByPlaceholder(/email/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should register a new account', async ({ page }) => {
    await page.goto('/register');
    // Alternative: click "Sign up" link from login page
    // await page.goto('/');
    // await page.getByText(/sign up|register|create account/i).click();

    // Fill registration form
    await page.getByPlaceholder(/email/i).fill(testEmail);
    await page.getByPlaceholder(/password/i).first().fill(testPassword);

    // Look for first name / last name fields (may vary)
    const firstNameField = page.getByPlaceholder(/first name/i);
    if (await firstNameField.isVisible()) {
      await firstNameField.fill('E2E');
    }
    const lastNameField = page.getByPlaceholder(/last name/i);
    if (await lastNameField.isVisible()) {
      await lastNameField.fill('Tester');
    }

    // Confirm password if field exists
    const confirmField = page.getByPlaceholder(/confirm/i);
    if (await confirmField.isVisible()) {
      await confirmField.fill(testPassword);
    }

    // Submit
    await page.getByRole('button', { name: /register|sign up|create/i }).click();

    // Should navigate away from register page
    await expect(page).not.toHaveURL(/register/, { timeout: 10000 });
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/email/i).fill(testEmail);
    await page.getByPlaceholder(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should reach the main app (dashboard, workspace, or any authenticated page)
    await expect(page).not.toHaveURL(/login/, { timeout: 10000 });

    // Look for common authenticated UI elements
    const hasNavRail = await page.locator('[data-testid="nav-rail"], nav, aside').first().isVisible();
    const hasUserMenu = await page.getByRole('button', { name: /user|profile|menu/i }).isVisible();

    expect(hasNavRail || hasUserMenu).toBeTruthy();
  });

  test('should reject invalid login', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/email/i).fill('wrong@celestix.ai');
    await page.getByPlaceholder(/password/i).fill('WrongPass123!');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should stay on login page or show error
    await expect(
      page.getByText(/invalid|incorrect|error|failed/i)
        .or(page.locator('[data-testid="login-error"]'))
    ).toBeVisible({ timeout: 5000 });
  });

  test('should navigate between modules after login', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(testEmail);
    await page.getByPlaceholder(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await expect(page).not.toHaveURL(/login/, { timeout: 10000 });

    // Try clicking through main navigation items
    const navLinks = page.locator('nav a, aside a, [data-testid="nav-rail"] a');
    const count = await navLinks.count();

    if (count > 0) {
      // Click first few nav items and verify no crash
      for (let i = 0; i < Math.min(count, 5); i++) {
        await navLinks.nth(i).click();
        // Give module time to lazy-load
        await page.waitForTimeout(1000);
        // Page should not show an error
        const hasError = await page.getByText(/error|crashed|something went wrong/i).isVisible();
        expect(hasError).toBeFalsy();
      }
    }
  });
});
