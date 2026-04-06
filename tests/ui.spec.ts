import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8788';

test.describe('Veeam Data Cloud Services Map - UI Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Close any open dialogs from previous tests
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });

  test.describe('Search Functionality', () => {
    
    test('should display matching regions when searching', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions' });
      await searchInput.fill('US East');
      
      const searchResults = page.getByRole('listbox');
      await expect(searchResults).toBeVisible();
      
      const options = page.getByRole('option');
      await expect(options).toHaveCount(7, { timeout: 2000 });
      
      await expect(page.getByRole('option', { name: /US East 1.*Virginia/i })).toBeVisible();
    });

    test('should work with region aliases', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions' });
      await searchInput.fill('Virginia');
      
      const searchResults = page.getByRole('listbox');
      await expect(searchResults).toBeVisible();
      
      const results = await page.getByRole('option').all();
      expect(results.length).toBeGreaterThan(0);
      
      await expect(page.getByRole('option').first()).toContainText(/Virginia/);
    });

    test('should handle no results gracefully', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions' });
      await searchInput.fill('zzz999xxx');
      
      await page.waitForTimeout(500);
      
      await expect(page).not.toHaveTitle(/error/i);
      await expect(searchInput).toBeVisible();
    });

    test('should open region popup when selecting non-clustered region from search', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet map navigation causes webkit instability on Linux');
      // Control test: Canada Central is NOT in a cluster, should open popup correctly
      // This contrasts with clustered regions like US East which may fail to open popup
      const searchInput = page.getByRole('combobox', { name: 'Search regions' });
      await searchInput.fill('Canada Central');
      
      const searchResults = page.getByRole('listbox', { name: 'Search results' });
      await expect(searchResults).toBeVisible();
      
      await page.getByRole('option', { name: /Canada Central 1/i }).click();
      
      await page.waitForTimeout(1000);
      
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible({ timeout: 5000 });
      
      await expect(popup).toContainText(/Canada Central|Montreal/i);
    });

    test('should open region popup when selecting search result', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet map navigation causes webkit instability on Linux');
      // Regression test for issue #23: clustered regions now correctly open popup when selected from search
      const searchInput = page.getByRole('combobox', { name: 'Search regions' });
      await searchInput.fill('East US 2');
      
      const searchResults = page.getByRole('listbox', { name: 'Search results' });
      await expect(searchResults).toBeVisible();
      
      await page.getByRole('option', { name: /East US 2/i }).click();
      
      await page.waitForTimeout(1000);
      
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible({ timeout: 5000 });
      
      await expect(popup).toContainText(/East US 2|Virginia/i);
    });
  });

  test.describe('Provider Filter', () => {
    
    test('should show all providers by default', async ({ page }, testInfo) => {
      const mobilePlatforms = ['Mobile Chrome', 'Mobile Safari'];
      test.skip(
        mobilePlatforms.includes(testInfo.project.name),
        `Skipping on mobile: ${testInfo.project.name}`
      );
      const counter = page.getByText(/72 of 72 regions/i);
      await expect(counter).toBeVisible();
      
      const providerFilter = page.locator('#providerFilter');
      await expect(providerFilter).toHaveValue('all');
    });

    test('should filter regions by Azure provider', async ({ page }) => {
      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('Azure');
      
      await page.waitForTimeout(300);
      
      const resetButton = page.getByRole('button', { name: /reset/i });
      await expect(resetButton).toBeVisible();
      await expect(providerFilter).toHaveValue('Azure');
      
      const markers = page.locator('path.leaflet-interactive');
      const count = await markers.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should filter regions by AWS provider', async ({ page }) => {
      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('AWS');
      
      await page.waitForTimeout(300);
      
      const resetButton = page.getByRole('button', { name: /reset/i });
      await expect(resetButton).toBeVisible();
      await expect(providerFilter).toHaveValue('AWS');
      
      const markers = page.locator('path.leaflet-interactive');
      const count = await markers.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should show correct filtered count for Azure in counter text', async ({ page }, testInfo) => {
      const mobilePlatforms = ['Mobile Chrome', 'Mobile Safari'];
      test.skip(
        mobilePlatforms.includes(testInfo.project.name),
        `Counter text not visible on mobile viewports`
      );

      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('Azure');
      await page.waitForTimeout(300);

      const counter = page.getByText(/of 72 regions/i);
      await expect(counter).toBeVisible();

      const counterText = await counter.textContent();
      const match = counterText?.match(/(\d+) of 72/);
      const filteredCount = match ? parseInt(match[1]) : 0;
      
      expect(filteredCount).toBe(45);
      expect(filteredCount).toBeLessThan(72);
    });

    test('should show correct filtered count for AWS in counter text', async ({ page }, testInfo) => {
      const mobilePlatforms = ['Mobile Chrome', 'Mobile Safari'];
      test.skip(
        mobilePlatforms.includes(testInfo.project.name),
        `Counter text not visible on mobile viewports`
      );

      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('AWS');
      await page.waitForTimeout(300);

      const counter = page.getByText(/of 72 regions/i);
      await expect(counter).toBeVisible();

      const counterText = await counter.textContent();
      const match = counterText?.match(/(\d+) of 72/);
      const filteredCount = match ? parseInt(match[1]) : 0;
      
      expect(filteredCount).toBe(27);
      expect(filteredCount).toBeLessThan(72);
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
      
      const counter = page.getByText(/of 72 regions/i);
      const counterText = await counter.textContent();
      const match = counterText?.match(/(\d+) of 72/);
      const filteredCount = match ? parseInt(match[1]) : 0;
      expect(filteredCount).toBeLessThan(72);
      expect(filteredCount).toBeGreaterThan(0);
    });

    test('should show combined results for multiple services', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Checking multiple filters triggers Leaflet re-render that hangs webkit on Linux');
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await serviceButton.click();
      
      await page.getByRole('checkbox', { name: 'M365' }).check();
      await page.getByRole('checkbox', { name: 'Vault' }).check();
      
      await page.waitForTimeout(300);
      
      const counter = page.getByText(/of 72 regions/i);
      const counterText = await counter.textContent();
      const match = counterText?.match(/(\d+) of 72/);
      const filteredCount = match ? parseInt(match[1]) : 0;
      expect(filteredCount).toBeGreaterThan(0);
    });

    test('should show all regions when unchecking all services', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet map re-render after filter change causes webkit instability on Linux');
      // Option 2: Skip multiple mobile platforms
      const mobilePlatforms = ['Mobile Chrome', 'Mobile Safari'];
      test.skip(
        mobilePlatforms.includes(testInfo.project.name),
        `Skipping on mobile: ${testInfo.project.name}`
      );
      // Desktop-only counter text check
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await serviceButton.click();
      
      const m365Checkbox = page.getByRole('checkbox', { name: 'M365' });
      await m365Checkbox.check();
      await page.waitForTimeout(300);
      
      await m365Checkbox.uncheck();
      await page.waitForTimeout(300);
      
      await expect(page.getByRole('button', { name: /all services/i })).toBeVisible();
      await expect(page.getByText(/72 of 72 regions/i)).toBeVisible();
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
      
      const counter = page.getByText(/of 72 regions/i);
      const counterText = await counter.textContent();
      const match = counterText?.match(/(\d+) of 72/);
      const filteredCount = match ? parseInt(match[1]) : 0;
      expect(filteredCount).toBeGreaterThan(0);
      expect(filteredCount).toBeLessThan(72);
    });

    test('should clear all filters with reset button', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet map re-render after filter reset causes webkit instability on Linux');
      const mobilePlatforms = ['Mobile Chrome', 'Mobile Safari'];
      const isMobile = mobilePlatforms.includes(testInfo.project.name);

      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('Azure');
      
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await serviceButton.click();
      await page.getByRole('checkbox', { name: 'M365' }).check();
      await page.keyboard.press('Escape');
      
      await page.waitForTimeout(300);

      const resetButton = page.getByRole('button', { name: /reset/i });
      await expect(resetButton).toBeVisible();

      await resetButton.click();
      await page.waitForTimeout(300);

      await expect(resetButton).not.toBeVisible();
      await expect(providerFilter).toHaveValue('all');
      await expect(page.getByRole('button', { name: /all services/i })).toBeVisible();

      if (!isMobile) {
        await expect(page.getByText(/72 of 72 regions/i)).toBeVisible();
      }

      if (!isMobile) {
        await expect(page.locator('path.leaflet-interactive').first()).toBeVisible({ timeout: 5000 });
        const markers = page.locator('path.leaflet-interactive');
        const count = await markers.count();
        expect(count).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Filter URL Deep-Linking', () => {

    test('syncs provider filter to the URL', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet re-render on filter change causes webkit instability on Linux');
      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('Azure');
      await expect(page).toHaveURL(/[\?&]provider=Azure/);

      await providerFilter.selectOption('all');
      await expect(page).not.toHaveURL(/provider=/);
    });

    test('syncs service filters to the URL and clears them on reset', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet re-render on filter change causes webkit instability on Linux');
      await page.getByRole('button', { name: /all services/i }).click();
      await page.getByRole('checkbox', { name: 'M365' }).check();
      await expect(page).toHaveURL(/[\?&]services=vdc_m365/);

      await page.getByRole('button', { name: /reset/i }).click();
      await expect(page).not.toHaveURL(/services=/);
      await expect(page).not.toHaveURL(/provider=/);
    });

    test('hydrates filters from URL on load and after reload', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet re-render on filter hydration causes webkit instability on Linux');
      const mobilePlatforms = ['Mobile Chrome', 'Mobile Safari'];
      test.skip(mobilePlatforms.includes(testInfo.project.name), `Counter elements not visible on mobile: ${testInfo.project.name}`);
      await page.goto(`${BASE_URL}/?provider=Azure&services=vdc_m365`);
      const totalCount = await page.locator('#totalCount').textContent();
      expect(totalCount, '#totalCount element was empty or missing').not.toBeNull();
      await expect(page.locator('#providerFilter')).toHaveValue('Azure');
      await expect(page.locator('#serviceDropdown input[value="vdc_m365"]')).toBeChecked();
      await expect(page.locator('#visibleCount')).not.toHaveText(totalCount!);

      await page.reload();
      await expect(page.locator('#providerFilter')).toHaveValue('Azure');
      await expect(page.locator('#serviceDropdown input[value="vdc_m365"]')).toBeChecked();
      await expect(page.locator('#visibleCount')).not.toHaveText(totalCount!);
    });

    test('replays filter changes with browser back and forward', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet re-render during history navigation causes webkit instability on Linux');
      const mobilePlatforms = ['Mobile Chrome', 'Mobile Safari'];
      test.skip(mobilePlatforms.includes(testInfo.project.name), `Complex history navigation unstable on mobile: ${testInfo.project.name}`);
      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('Azure');
      await page.getByRole('button', { name: /all services/i }).click();
      await page.getByRole('checkbox', { name: 'M365' }).check();
      await page.keyboard.press('Escape');

      await page.goBack();
      await expect(providerFilter).toHaveValue('Azure');
      await expect(page.locator('#serviceDropdown input[value="vdc_m365"]')).not.toBeChecked();

      await page.goForward();
      await expect(providerFilter).toHaveValue('Azure');
      await expect(page.locator('#serviceDropdown input[value="vdc_m365"]')).toBeChecked();
    });

    test('hydrates service params for checkbox values present in the DOM', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet re-render on filter hydration causes webkit instability on Linux');
      await page.route('**/*', async route => {
        if (route.request().resourceType() !== 'document') {
          await route.continue();
          return;
        }

        const response = await route.fetch();
        const html = await response.text();
        const injectedHtml = html.replace(
          /(<input type=checkbox value=vdc_azure_backup> Azure<\/label>)(<\/div>)/,
          '$1<label class="multiselect-option text-white light:text-slate-900"><input type=checkbox value=vdc_test_service> Test Service</label>$2'
        );

        expect(injectedHtml).not.toBe(html);
        await route.fulfill({ response, body: injectedHtml });
      });

      await page.goto(`${BASE_URL}/?services=vdc_test_service`);

      await expect(page.locator('#serviceDropdown input[value="vdc_test_service"]')).toBeChecked();
      await expect(page).toHaveURL(/[\?&]services=vdc_test_service/);
    });

    test('hydrates provider params for select options present in the DOM', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet re-render on filter hydration causes webkit instability on Linux');
      await page.route('**/*', async route => {
        if (route.request().resourceType() !== 'document') {
          await route.continue();
          return;
        }

        const response = await route.fetch();
        const html = await response.text();
        const injectedHtml = html.replace(
          /(<option value=AWS>AWS<\/option>)(<\/select>)/,
          '$1<option value=GCP>GCP</option>$2'
        );

        expect(injectedHtml).not.toBe(html);
        await route.fulfill({ response, body: injectedHtml });
      });

      await page.goto(`${BASE_URL}/?provider=GCP`);

      await expect(page.locator('#providerFilter option[value="GCP"]')).toHaveCount(1);
      await expect(page.locator('#providerFilter')).toHaveValue('GCP');
      await expect(page).toHaveURL(/[\?&]provider=GCP/);
    });

    test('keeps history.state unused while syncing filter URLs', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet re-render during URL sync causes webkit instability on Linux');
      expect(await page.evaluate(() => window.history.state)).toBeNull();

      const providerFilter = page.locator('#providerFilter');
      await providerFilter.selectOption('Azure');
      await expect(page).toHaveURL(/[\?&]provider=Azure/);
      expect(await page.evaluate(() => window.history.state)).toBeNull();

      await page.getByRole('button', { name: /all services/i }).click();
      await page.getByRole('checkbox', { name: 'M365' }).check();
      await expect(page).toHaveURL(/[\?&]services=vdc_m365/);
      expect(await page.evaluate(() => window.history.state)).toBeNull();
    });

  });

  test.describe('Theme Toggle', () => {
    
    test('should cycle through theme options', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Leaflet tile layer swap during theme change causes webkit instability on Linux');
      const themeButton = page.getByRole('button', { name: /theme/i });

      await expect(themeButton).toHaveAttribute('title', /system/i);

      await themeButton.click();
      await expect(themeButton).toHaveAttribute('title', /dark/i);
      await expect(page.locator('html')).toHaveClass(/dark/);

      await themeButton.click();
      await expect(themeButton).toHaveAttribute('title', /light/i);
      await expect(page.locator('html')).toHaveClass(/light/);

      await themeButton.click();
      await expect(themeButton).toHaveAttribute('title', /system/i);
    });

    test('should persist theme preference', async ({ page }) => {
      const themeButton = page.getByRole('button', { name: /theme/i });
      await themeButton.click();
      
      await expect(themeButton).toHaveAttribute('title', /dark/i);
      
      const aboutButton = page.getByRole('button', { name: /open about panel/i });
      await aboutButton.click();
      await page.keyboard.press('Escape');
      
      await expect(themeButton).toHaveAttribute('title', /dark/i);
    });
  });

  test.describe('Region Details Popup', () => {
    
    test('should open popup when clicking map marker', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'Mobile Safari', 'Direct SVG marker clicks are unreliable on simulated mobile');
      // Known issue: Leaflet markers are not exposed in accessibility tree
      // Markers are SVG/Canvas elements without accessible roles
      await page.waitForTimeout(1000);
      
      const marker = page.locator('path.leaflet-interactive').first();
      await marker.click({ force: true });
      
      await page.waitForTimeout(3000);
      
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible({ timeout: 5000 });
      
      await expect(popup).toContainText(/AWS|Azure/i);
    });

    test('should show correct service details in popup', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions' });
      await searchInput.fill('US East 1');
      
      const searchResults = page.getByRole('listbox', { name: 'Search results' });
      await expect(searchResults).toBeVisible();
      
      await page.getByRole('option', { name: /US East 1/i }).click();
      await page.waitForTimeout(1000);
      
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible({ timeout: 3000 });
      await expect(popup).toContainText(/US East 1.*Virginia/i);
      await expect(popup).toContainText(/AWS/i);
    });

    test('should close popup with close button', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'Mobile Safari', 'Leaflet popup close button clicks are unreliable on simulated mobile');
      const searchInput = page.getByRole('combobox', { name: 'Search regions' });
      await searchInput.fill('Canada Central 1');
      
      const searchResults = page.getByRole('listbox', { name: 'Search results' });
      await expect(searchResults).toBeVisible();
      
      const canadaCentralOption = page.getByRole('option', { name: /Canada Central 1/i });
      await expect(canadaCentralOption).toBeVisible();
      await canadaCentralOption.click();
      
      await page.waitForTimeout(1000);
      
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible({ timeout: 5000 });
      
      const closeButton = page.getByRole('button', { name: /close popup/i });
      await closeButton.click();
      
      await expect(popup).not.toBeVisible();
    });

    test('should close popup with Escape key', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'Mobile Safari', 'Direct SVG marker clicks are unreliable on simulated mobile');
      // Known issue: Leaflet popups do not respond to Escape key
      const marker = page.locator('path.leaflet-interactive').first();
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
      // Known issue: About dialog elements are outside viewport
      const aboutButton = page.getByRole('button', { name: /open about panel/i });
      await aboutButton.click();
      await page.waitForTimeout(500);
      
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      
      await expect(dialog).toContainText(/About This Map/i);
      await expect(dialog).toContainText(/5/i,/Services Tracked/i);
      
      await expect(dialog.getByRole('link', { name: /View on GitHub/i })).toBeVisible();
      await expect(dialog.getByRole('link', { name: /API Documentation/i })).toBeVisible();
      await expect(dialog.getByRole('link', { name: /Official Veeam Data Cloud/i })).toBeVisible();
    });

    test('should have clickable links in about panel', async ({ page }) => {
      // Known issue: About dialog elements are outside viewport
      const aboutButton = page.getByRole('button', { name: /open about panel/i });
      await aboutButton.click();
      
      const dialog = page.getByRole('dialog');
      
      const githubLink = dialog.getByRole('link', { name: /View on GitHub/i });
      await expect(githubLink).toHaveAttribute('href', /github\.com/);
      
      const apiLink = dialog.getByRole('link', { name: /API Documentation/i });
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
    
    test('should load API docs page correctly', async ({ page }, testInfo) => {
      const mobilePlatforms = ['Mobile Chrome', 'Mobile Safari'];
      test.skip(mobilePlatforms.includes(testInfo.project.name), 'Scalar API docs render mobile layout without sidebar navigation');
      await page.goto(`${BASE_URL}/api/docs`);
      
      await expect(page).toHaveTitle(/Veeam.*API/i);
      
      await page.waitForTimeout(1500);
      
      await expect(page.getByRole('button', { name: /Introduction/i })).toBeVisible();
      await expect(page.locator('text=Regions').first()).toBeVisible();
      await expect(page.locator('text=Services').first()).toBeVisible();
      await expect(page.locator('text=Health').first()).toBeVisible();
    });

    test('should have expandable endpoints', async ({ page }, testInfo) => {
      const mobilePlatforms = ['Mobile Chrome', 'Mobile Safari'];
      test.skip(mobilePlatforms.includes(testInfo.project.name), 'Scalar API docs render mobile layout without sidebar navigation');
      await page.goto(`${BASE_URL}/api/docs`);
      
      await page.waitForTimeout(1500);
      
      const endpointButton = page.getByRole('button', { name: /Find nearest regions/i });
      await expect(endpointButton).toBeVisible();
    });

    test('should have test request buttons', async ({ page }, testInfo) => {
      const mobilePlatforms = ['Mobile Chrome', 'Mobile Safari'];
      test.skip(mobilePlatforms.includes(testInfo.project.name), 'Scalar API docs render mobile layout without test request buttons');
      // Scalar API docs use different interaction pattern
      await page.goto(`${BASE_URL}/api/docs`);
      
      await page.waitForTimeout(1000);
      
      const testButtons = page.getByRole('button', { name: /test request/i });
      const count = await testButtons.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Error Handling', () => {
    
    test('should handle invalid search gracefully', async ({ page }) => {
      const searchInput = page.getByRole('combobox', { name: 'Search regions' });
      await searchInput.fill('InvalidRegion999');
      
      await page.waitForTimeout(500);
      
      await expect(page).not.toHaveTitle(/error/i);
      await expect(searchInput).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    
    test('should be keyboard navigable', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'Dynamic aria-hidden accessibility tree updates are unreliable in webkit on Linux');
      test.skip(testInfo.project.name === 'Mobile Safari', 'Hardware keyboard navigation does not apply to mobile');
      await page.keyboard.press('Tab');
      
      const searchInput = page.getByRole('combobox', { name: 'Search regions' });
      await expect(searchInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await expect(serviceButton).toBeFocused();

      await serviceButton.press('Enter');
      await expect(page.getByRole('checkbox', { name: 'Vault' })).toBeVisible();
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    });

    test('should have proper ARIA labels', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /open about panel/i });
      await expect(aboutButton).toHaveAttribute('aria-label', /open about panel/i);
      
      const themeButton = page.getByRole('button', { name: /theme/i });
      await expect(themeButton).toBeVisible();
      await expect(themeButton).toHaveAttribute('title', /theme/i);
    });
  });

  test.describe('Responsive Design', () => {
    
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      
      const searchInput = page.getByRole('combobox', { name: 'Search regions' });
      await expect(searchInput).toBeVisible();
      
      const providerFilter = page.locator('#providerFilter');
      await expect(providerFilter).toBeVisible();
      
      const serviceButton = page.getByRole('button', { name: /all services/i });
      await expect(serviceButton).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      
      const searchInput = page.getByRole('combobox', { name: 'Search regions' });
      await expect(searchInput).toBeVisible();
      
      const counter = page.getByText(/72 of 72 regions/i);
      await expect(counter).toBeVisible();
    });
  });
});
