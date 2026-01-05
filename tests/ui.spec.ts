import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8788';

test.describe('Veeam Data Cloud Services Map - UI Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test.describe('Search Functionality', () => {
    
    test('should display matching regions when searching', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions...' });
      await searchInput.fill('US East');
      
      const searchResults = page.getByRole('listbox');
      await expect(searchResults).toBeVisible();
      
      const options = page.getByRole('option');
      await expect(options).toHaveCount(4, { timeout: 2000 });
      
      await expect(page.getByRole('option', { name: /US East 1.*Virginia/i })).toBeVisible();
    });

    test('should work with region aliases', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions...' });
      await searchInput.fill('Virginia');
      
      const searchResults = page.getByRole('listbox');
      await expect(searchResults).toBeVisible();
      
      const results = await page.getByRole('option').all();
      expect(results.length).toBeGreaterThan(0);
      
      const hasViaText = await page.getByText(/via/i).count();
      expect(hasViaText).toBeGreaterThan(0);
    });

    test('should handle no results gracefully', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions...' });
      await searchInput.fill('NonExistentRegion123');
      
      await page.waitForTimeout(500);
      
      const options = await page.getByRole('option').count();
      expect(options).toBe(0);
    });

    test('should open region popup when selecting search result', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions...' });
      await searchInput.fill('US East');
      
      await page.getByRole('option').first().click();
      
      await page.waitForTimeout(1000);
      
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible({ timeout: 3000 });
      
      await expect(popup).toContainText(/US East|Virginia/i);
    });
  });

  test.describe('Provider Filter', () => {
    
    test('should show all providers by default', async ({ page }) => {
      const counter = page.getByText(/63 of 63 regions/i);
      await expect(counter).toBeVisible();
      
      const providerFilter = page.locator('#providerFilter');
      await expect(providerFilter).toHaveValue('all');
    });

    test('should filter regions by Azure provider', async ({ page }) => {
      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('Azure');
      
      await page.waitForTimeout(300);
      
      const counter = page.getByText(/of 63 regions/i);
      await expect(counter).toBeVisible();
      
      const counterText = await counter.textContent();
      const match = counterText?.match(/(\d+) of 63/);
      const filteredCount = match ? parseInt(match[1]) : 0;
      expect(filteredCount).toBeLessThan(63);
      expect(filteredCount).toBeGreaterThan(0);
      
      const resetButton = page.getByRole('button', { name: /reset/i });
      await expect(resetButton).toBeVisible();
    });

    test('should filter regions by AWS provider', async ({ page }) => {
      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('AWS');
      
      await page.waitForTimeout(300);
      
      const counter = page.getByText(/of 63 regions/i);
      const counterText = await counter.textContent();
      const match = counterText?.match(/(\d+) of 63/);
      const filteredCount = match ? parseInt(match[1]) : 0;
      expect(filteredCount).toBeLessThan(63);
      expect(filteredCount).toBeGreaterThan(0);
      
      const resetButton = page.getByRole('button', { name: /reset/i });
      await expect(resetButton).toBeVisible();
    });
  });

  test.describe('Service Filter', () => {
    
    test('should show all services in dropdown', async ({ page }) => {
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await serviceButton.click();
      
      await expect(page.getByRole('checkbox', { name: 'Vault' })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'M365' })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Entra ID' })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Salesforce' })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Azure' })).toBeVisible();
    });

    test('should filter regions by M365 service', async ({ page }) => {
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await serviceButton.click();
      
      const m365Checkbox = page.getByRole('checkbox', { name: 'M365' });
      await m365Checkbox.check();
      
      await page.waitForTimeout(300);
      
      await expect(page.getByRole('button', { name: /M365/i })).toBeVisible();
      
      const counter = page.getByText(/of 63 regions/i);
      const counterText = await counter.textContent();
      const match = counterText?.match(/(\d+) of 63/);
      const filteredCount = match ? parseInt(match[1]) : 0;
      expect(filteredCount).toBeLessThan(63);
      expect(filteredCount).toBeGreaterThan(0);
    });

    test('should show combined results for multiple services', async ({ page }) => {
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await serviceButton.click();
      
      await page.getByRole('checkbox', { name: 'M365' }).check();
      await page.getByRole('checkbox', { name: 'Vault' }).check();
      
      await page.waitForTimeout(300);
      
      const counter = page.getByText(/of 63 regions/i);
      const counterText = await counter.textContent();
      const match = counterText?.match(/(\d+) of 63/);
      const filteredCount = match ? parseInt(match[1]) : 0;
      expect(filteredCount).toBeGreaterThan(0);
    });

    test('should show all regions when unchecking all services', async ({ page }) => {
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await serviceButton.click();
      
      const m365Checkbox = page.getByRole('checkbox', { name: 'M365' });
      await m365Checkbox.check();
      await page.waitForTimeout(300);
      
      await m365Checkbox.uncheck();
      await page.waitForTimeout(300);
      
      await expect(page.getByRole('button', { name: /all services/i })).toBeVisible();
      await expect(page.getByText(/63 of 63 regions/i)).toBeVisible();
    });
  });

  test.describe('Combined Filters', () => {
    
    test('should apply provider and service filters together', async ({ page }) => {
      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('Azure');
      await page.waitForTimeout(300);
      
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await serviceButton.click();
      await page.getByRole('checkbox', { name: 'M365' }).check();
      await page.waitForTimeout(300);
      
      const counter = page.getByText(/of 63 regions/i);
      const counterText = await counter.textContent();
      const match = counterText?.match(/(\d+) of 63/);
      const filteredCount = match ? parseInt(match[1]) : 0;
      expect(filteredCount).toBeGreaterThan(0);
      expect(filteredCount).toBeLessThan(63);
    });

    test('should clear all filters with reset button', async ({ page }) => {
      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('Azure');
      
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await serviceButton.click();
      await page.getByRole('checkbox', { name: 'M365' }).check();
      await page.keyboard.press('Escape');
      
      await page.waitForTimeout(300);
      
      const resetButton = page.getByRole('button', { name: /reset/i });
      await resetButton.click();
      
      await page.waitForTimeout(300);
      
      await expect(providerFilter).toHaveValue('all');
      await expect(page.getByText(/63 of 63 regions/i)).toBeVisible();
      await expect(resetButton).not.toBeVisible();
    });
  });

  test.describe('Theme Toggle', () => {
    
    test('should cycle through theme options', async ({ page }) => {
      const themeButton = page.getByRole('button', { name: /theme/i });
      
      await expect(themeButton).toContainText(/system/i);
      
      await themeButton.click();
      await expect(themeButton).toContainText(/dark/i);
      
      await themeButton.click();
      await expect(themeButton).toContainText(/light/i);
      
      await themeButton.click();
      await expect(themeButton).toContainText(/system/i);
    });

    test('should persist theme preference', async ({ page }) => {
      const themeButton = page.getByRole('button', { name: /theme/i });
      await themeButton.click();
      
      await expect(themeButton).toContainText(/dark/i);
      
      const aboutButton = page.getByRole('button', { name: /about/i });
      await aboutButton.click();
      await page.keyboard.press('Escape');
      
      await expect(themeButton).toContainText(/dark/i);
    });
  });

  test.describe('Region Details Popup', () => {
    
    test('should open popup when clicking map marker', async ({ page }) => {
      const marker = page.locator('.leaflet-marker-icon').first();
      await marker.click();
      
      await page.waitForTimeout(1000);
      
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible({ timeout: 3000 });
      
      await expect(popup).toContainText(/AWS|Azure/i);
    });

    test('should show correct service details in popup', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions...' });
      await searchInput.fill('US East 1');
      
      await page.getByRole('option').first().click();
      await page.waitForTimeout(1000);
      
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible({ timeout: 3000 });
      await expect(popup).toContainText(/US East 1.*Virginia/i);
      await expect(popup).toContainText(/AWS/i);
    });

    test('should close popup with close button', async ({ page }) => {
      const marker = page.locator('.leaflet-marker-icon').first();
      await marker.click();
      await page.waitForTimeout(1000);
      
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible({ timeout: 3000 });
      
      const closeButton = popup.getByRole('button', { name: /close/i }).or(popup.locator('button:has-text("×")'));
      await closeButton.click();
      
      await expect(popup).not.toBeVisible();
    });

    test('should close popup with Escape key', async ({ page }) => {
      const marker = page.locator('.leaflet-marker-icon').first();
      await marker.click();
      await page.waitForTimeout(1000);
      
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible({ timeout: 3000 });
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      
      await expect(popup).not.toBeVisible();
    });
  });

  test.describe('About Panel', () => {
    
    test('should open and display about information', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about/i });
      await aboutButton.click();
      
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      
      await expect(dialog).toContainText(/About This Map/i);
      await expect(dialog).toContainText(/5 Services Tracked/i);
      
      await expect(dialog.getByRole('link', { name: /GitHub/i })).toBeVisible();
      await expect(dialog.getByRole('link', { name: /API Documentation/i })).toBeVisible();
      await expect(dialog.getByRole('link', { name: /Veeam/i })).toBeVisible();
    });

    test('should have clickable links in about panel', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about/i });
      await aboutButton.click();
      
      const dialog = page.getByRole('dialog');
      
      const githubLink = dialog.getByRole('link', { name: /GitHub/i });
      await expect(githubLink).toHaveAttribute('href', /github\.com/);
      
      const apiLink = dialog.getByRole('link', { name: /API/i });
      await expect(apiLink).toHaveAttribute('href', /\/api\/docs/);
    });
  });

  test.describe('Map Controls', () => {
    
    test('should zoom in and out', async ({ page }) => {
      const zoomInButton = page.getByRole('button', { name: /zoom in/i });
      const zoomOutButton = page.getByRole('button', { name: /zoom out/i });
      
      await expect(zoomInButton).toBeVisible();
      await expect(zoomOutButton).toBeVisible();
      
      await zoomInButton.click();
      await page.waitForTimeout(300);
      
      await zoomOutButton.click();
      await page.waitForTimeout(300);
    });
  });

  test.describe('API Documentation', () => {
    
    test('should load API docs page correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/api/docs`);
      
      await expect(page).toHaveTitle(/Veeam.*API/i);
      
      await expect(page.getByText(/Veeam Data Cloud Service Availability API/i)).toBeVisible();
      await expect(page.getByText(/Regions/i)).toBeVisible();
      await expect(page.getByText(/Services/i)).toBeVisible();
      await expect(page.getByText(/Health/i)).toBeVisible();
    });

    test('should have expandable endpoints', async ({ page }) => {
      await page.goto(`${BASE_URL}/api/docs`);
      
      const regionsSection = page.getByText(/Get.*regions/i).first();
      await expect(regionsSection).toBeVisible();
    });

    test('should have test request buttons', async ({ page }) => {
      await page.goto(`${BASE_URL}/api/docs`);
      
      await page.waitForTimeout(1000);
      
      const testButtons = page.getByRole('button', { name: /test request/i });
      const count = await testButtons.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Error Handling', () => {
    
    test('should handle invalid search gracefully', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions...' });
      await searchInput.fill('InvalidRegion999');
      
      await page.waitForTimeout(500);
      
      await expect(page).not.toHaveTitle(/error/i);
      await expect(searchInput).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    
    test('should be keyboard navigable', async ({ page }) => {
      await page.keyboard.press('Tab');
      
      const searchInput = page.getByRole('combobox', { name: 'Search regions...' });
      await expect(searchInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await expect(serviceButton).toBeFocused();
      
      await page.keyboard.press('Enter');
      await expect(page.getByRole('checkbox', { name: 'Vault' })).toBeVisible();
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    });

    test('should have proper ARIA labels', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions...' });
      await expect(searchInput).toHaveAttribute('aria-label', /.+/);
      
      const aboutButton = page.getByRole('button', { name: /about/i });
      await expect(aboutButton).toHaveAttribute('aria-label', /.+/);
      
      const themeButton = page.getByRole('button', { name: /theme/i });
      await expect(themeButton).toBeVisible();
    });
  });
});

test.describe('Responsive Design', () => {
  
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    
    const searchInput = page.getByRole('combobox', { name: 'Search regions...' });
    await expect(searchInput).toBeVisible();
    
    const providerFilter = page.locator('#providerFilter');
    await expect(providerFilter).toBeVisible();
    
    const serviceButton = page.getByRole('button', { name: /all services/i });
    await expect(serviceButton).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL);
    
    const searchInput = page.getByRole('combobox', { name: 'Search regions...' });
    await expect(searchInput).toBeVisible();
    
    const counter = page.getByText(/63 of 63 regions/i);
    await expect(counter).toBeVisible();
  });
});
