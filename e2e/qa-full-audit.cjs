const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

const BASE = 'http://localhost:5173';
const CREDS = { email: 'alice@celestix.local', password: 'Password123' };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];
  const consoleErrors = {};
  const allConsoleErrors = [];

  function log(test, status, detail = '') {
    const entry = { test, status, detail };
    results.push(entry);
    const icon = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'WARN';
    console.log(`[${icon}] ${test} ${detail}`);
  }

  // Collect console errors globally
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text().substring(0, 300);
      // Skip noisy/expected errors
      if (text.includes('React DevTools') || text.includes('favicon') || text.includes('ERR_CONNECTION_REFUSED')) return;
      const url = page.url();
      if (!consoleErrors[url]) consoleErrors[url] = [];
      consoleErrors[url].push(text);
      allConsoleErrors.push({ url, text });
    }
  });

  // Helper: screenshot
  async function screenshot(name) {
    await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: false });
  }

  // Helper: wait for network idle-ish
  async function settle(ms = 1500) {
    await page.waitForTimeout(ms);
  }

  try {
    // ================================================================
    // A1: AUTH TESTS
    // ================================================================
    console.log('\n=== A1: AUTH TESTS ===\n');

    // Test 1: Login page renders
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await screenshot('01-login-page');
    const loginHeading = await page.textContent('h1').catch(() => null);
    if (loginHeading && loginHeading.includes('Welcome back')) {
      log('A1.1 Login page renders', 'PASS', `Heading: "${loginHeading}"`);
    } else {
      log('A1.1 Login page renders', 'FAIL', `Heading: "${loginHeading}"`);
    }

    // Test 2: Login form elements present
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitBtn = await page.$('button[type="submit"]');
    if (emailInput && passwordInput && submitBtn) {
      log('A1.2 Login form elements present', 'PASS');
    } else {
      log('A1.2 Login form elements present', 'FAIL', `email=${!!emailInput} password=${!!passwordInput} submit=${!!submitBtn}`);
    }

    // Test 3: Invalid login shows error
    await page.fill('input[type="email"]', 'bad@test.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    await settle(2000);
    await screenshot('02-login-invalid');
    // Check for toast or error message
    const errorToast = await page.$('[class*="toast"], [role="alert"], [class*="error"], [class*="Toast"]');
    const bodyText = await page.textContent('body');
    const hasErrorMsg = bodyText.includes('Invalid') || bodyText.includes('failed') || bodyText.includes('error') || errorToast;
    if (hasErrorMsg) {
      log('A1.3 Invalid login shows error', 'PASS');
    } else {
      log('A1.3 Invalid login shows error', 'WARN', 'No visible error message detected');
    }

    // Test 4: Valid login works
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.fill('input[type="email"]', CREDS.email);
    await page.fill('input[type="password"]', CREDS.password);
    await page.click('button[type="submit"]');
    await settle(3000);
    await screenshot('03-login-success');
    const postLoginUrl = page.url();
    // After login we should be at the main app (not /login)
    if (!postLoginUrl.includes('/login') && !postLoginUrl.includes('/welcome')) {
      log('A1.4 Valid login redirects to app', 'PASS', `URL: ${postLoginUrl}`);
    } else {
      log('A1.4 Valid login redirects to app', 'FAIL', `Still at: ${postLoginUrl}`);
    }

    // Test 5: Nav rail visible after login
    const navRail = await page.$('nav');
    if (navRail) {
      log('A1.5 Nav rail visible after login', 'PASS');
    } else {
      log('A1.5 Nav rail visible after login', 'FAIL');
    }

    // ================================================================
    // A2: NAVIGATION TESTS - Visit every module
    // ================================================================
    console.log('\n=== A2: NAVIGATION TESTS ===\n');

    // The modules we can navigate to by clicking nav buttons
    const navModules = [
      'dashboard', 'inbox', 'messenger', 'workspace',
      'spaces', 'tasks', 'calendar', 'goals', 'sprints',
      'documents', 'notes', 'files', 'clips',
      'people', 'meetings', 'planner', 'time-reports',
      'automations', 'dashboards', 'integrations',
      'settings'
    ];

    // Additional modules accessible via URL/store but not main nav
    const extraModules = [
      'email', 'contacts', 'forms', 'lists', 'bookings',
      'loop', 'whiteboard', 'stream', 'workflows',
      'spreadsheets', 'presentations', 'pdf', 'diagrams',
      'analytics', 'todo', 'video-editor', 'designer', 'sites', 'social'
    ];

    const allModules = [...navModules, ...extraModules];

    for (const mod of allModules) {
      try {
        // Use the UI store to switch modules via JavaScript injection
        await page.evaluate((m) => {
          const store = JSON.parse(localStorage.getItem('celestix-ui') || '{}');
          store.state = store.state || {};
          store.state.activeModule = m;
          localStorage.setItem('celestix-ui', JSON.stringify(store));
        }, mod);

        // Navigate to force re-render
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await settle(2000);
        await screenshot(`mod-${mod}`);

        // Check for blank page (only loading spinner or empty)
        const mainContent = await page.$('main');
        const mainText = mainContent ? await mainContent.textContent().catch(() => '') : '';
        const mainHtml = mainContent ? await mainContent.innerHTML().catch(() => '') : '';

        // Check for error boundary
        const hasError = mainHtml.includes('Something went wrong') || mainHtml.includes('Error') && mainHtml.includes('boundary');
        const isBlank = mainText.trim().length < 5 && !mainHtml.includes('svg') && !mainHtml.includes('img');

        if (hasError) {
          log(`A2 Module: ${mod}`, 'FAIL', 'Error boundary triggered');
        } else if (isBlank) {
          log(`A2 Module: ${mod}`, 'WARN', 'Page appears blank/minimal');
        } else {
          log(`A2 Module: ${mod}`, 'PASS', `Content length: ${mainText.length}`);
        }
      } catch (err) {
        log(`A2 Module: ${mod}`, 'FAIL', err.message.substring(0, 100));
        await screenshot(`mod-${mod}-error`);
      }
    }

    // ================================================================
    // A3: HIERARCHY TESTS - Spaces sidebar interaction
    // ================================================================
    console.log('\n=== A3: HIERARCHY TESTS ===\n');

    // Navigate to Spaces module
    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem('celestix-ui') || '{}');
      store.state = store.state || {};
      store.state.activeModule = 'spaces';
      localStorage.setItem('celestix-ui', JSON.stringify(store));
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await settle(3000);
    await screenshot('10-spaces-page');

    // Check if spaces sidebar is present
    const spacesSidebar = await page.$('[class*="w-[260px]"], [class*="Spaces"]');
    const spacesText = await page.textContent('body');
    const hasSpaces = spacesText.includes('Spaces') || spacesText.includes('Engineering') || spacesText.includes('No spaces');
    if (hasSpaces) {
      log('A3.1 Spaces sidebar visible', 'PASS');
    } else {
      log('A3.1 Spaces sidebar visible', 'WARN', 'Spaces text not found');
    }

    // Try to find and expand Engineering space
    const engineeringBtn = await page.$('button:has-text("Engineering")').catch(() => null);
    if (engineeringBtn) {
      await engineeringBtn.click();
      await settle(1500);
      await screenshot('11-engineering-expanded');
      log('A3.2 Engineering space expandable', 'PASS');

      // Look for folders/lists inside
      const backendBtn = await page.$('button:has-text("Backend")').catch(() => null);
      if (backendBtn) {
        await backendBtn.click();
        await settle(1500);
        await screenshot('12-backend-folder');
        log('A3.3 Backend folder clickable', 'PASS');

        // Look for lists like "API Development"
        const apiDevBtn = await page.$('button:has-text("API Development")').catch(() => null);
        if (apiDevBtn) {
          await apiDevBtn.click();
          await settle(1500);
          await screenshot('13-api-development-list');
          log('A3.4 API Development list clickable', 'PASS');

          // Check if tasks are visible in main area
          const mainArea = await page.$('main');
          const mainAreaText = mainArea ? await mainArea.textContent().catch(() => '') : '';
          if (mainAreaText.length > 50) {
            log('A3.5 Tasks visible in main area', 'PASS', `Content length: ${mainAreaText.length}`);
          } else {
            log('A3.5 Tasks visible in main area', 'WARN', 'Main area seems sparse');
          }
        } else {
          log('A3.4 API Development list', 'WARN', 'Not found - may not exist in seed data');
        }
      } else {
        log('A3.3 Backend folder', 'WARN', 'Not found - may not exist in seed data');
      }
    } else {
      log('A3.2 Engineering space', 'WARN', 'Not found - checking for any spaces');
      // Try to click any space
      const anySpaceBtn = await page.$$('button').then(async (btns) => {
        for (const btn of btns) {
          const text = await btn.textContent().catch(() => '');
          if (text.length > 2 && text.length < 30 && !text.includes('Create') && !text.includes('Settings')) {
            return btn;
          }
        }
        return null;
      });
      if (anySpaceBtn) {
        const spaceName = await anySpaceBtn.textContent();
        await anySpaceBtn.click();
        await settle(1500);
        await screenshot('11-space-expanded');
        log('A3.2 Space expandable (alt)', 'PASS', `Clicked: "${spaceName}"`);
      }
    }

    // ================================================================
    // A4: VISUAL TESTS
    // ================================================================
    console.log('\n=== A4: VISUAL TESTS ===\n');

    // Test 4.1: Console errors summary
    const totalErrors = allConsoleErrors.length;
    if (totalErrors === 0) {
      log('A4.1 Console errors', 'PASS', 'No console errors detected');
    } else {
      log('A4.1 Console errors', 'WARN', `${totalErrors} console errors detected`);
      // Print first 10
      allConsoleErrors.slice(0, 10).forEach((e, i) => {
        console.log(`  Error ${i + 1}: ${e.text.substring(0, 150)}`);
      });
    }

    // Test 4.2: Horizontal overflow check on main pages
    const overflowModules = ['dashboard', 'messenger', 'tasks', 'spaces', 'settings'];
    let overflowIssues = 0;
    for (const mod of overflowModules) {
      await page.evaluate((m) => {
        const store = JSON.parse(localStorage.getItem('celestix-ui') || '{}');
        store.state = store.state || {};
        store.state.activeModule = m;
        localStorage.setItem('celestix-ui', JSON.stringify(store));
      }, mod);
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await settle(1500);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      if (hasOverflow) {
        overflowIssues++;
        log(`A4.2 Horizontal overflow: ${mod}`, 'FAIL', 'Page wider than viewport');
        await screenshot(`overflow-${mod}`);
      }
    }
    if (overflowIssues === 0) {
      log('A4.2 Horizontal overflow check', 'PASS', 'No overflow on key pages');
    }

    // Test 4.3: Broken images check
    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem('celestix-ui') || '{}');
      store.state = store.state || {};
      store.state.activeModule = 'dashboard';
      localStorage.setItem('celestix-ui', JSON.stringify(store));
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await settle(2000);

    const brokenImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
    });
    if (brokenImages.length === 0) {
      log('A4.3 Broken images', 'PASS', 'No broken images detected');
    } else {
      log('A4.3 Broken images', 'FAIL', `${brokenImages.length} broken: ${brokenImages.slice(0, 3).join(', ')}`);
    }

    // Test 4.4: Ctrl+K opens search palette
    await page.keyboard.press('Control+k');
    await settle(1000);
    await screenshot('20-search-palette');
    const searchDialog = await page.$('[role="dialog"], [class*="search"], [class*="Search"], [class*="palette"], [class*="Palette"], [class*="CommandPalette"]');
    if (searchDialog) {
      log('A4.4 Ctrl+K search palette', 'PASS');
      // Close it
      await page.keyboard.press('Escape');
      await settle(500);
    } else {
      // Check if any overlay appeared
      const overlayVisible = await page.evaluate(() => {
        const els = document.querySelectorAll('[data-state="open"], [class*="overlay"]');
        return els.length > 0;
      });
      if (overlayVisible) {
        log('A4.4 Ctrl+K search palette', 'PASS', 'Overlay detected');
        await page.keyboard.press('Escape');
        await settle(500);
      } else {
        log('A4.4 Ctrl+K search palette', 'WARN', 'Search palette not detected');
      }
    }

    // Test 4.5: Ctrl+J opens AI command bar
    await page.keyboard.press('Control+j');
    await settle(1000);
    await screenshot('21-ai-command-bar');
    const aiBar = await page.$('[class*="AI"], [class*="ai-command"], [class*="CommandBar"], [role="dialog"]');
    if (aiBar) {
      log('A4.5 Ctrl+J AI command bar', 'PASS');
      await page.keyboard.press('Escape');
      await settle(500);
    } else {
      log('A4.5 Ctrl+J AI command bar', 'WARN', 'AI command bar not detected');
    }

    // Test 4.6: Mobile viewport test
    await page.setViewportSize({ width: 375, height: 812 });
    await settle(1500);
    await screenshot('22-mobile-viewport');
    const mobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > 376;
    });
    const mobileNav = await page.$('[class*="mobile"], [class*="MobileNav"], [class*="bottom-nav"]');
    if (mobileOverflow) {
      log('A4.6 Mobile viewport overflow', 'FAIL', `scrollWidth > viewport`);
    } else {
      log('A4.6 Mobile viewport no overflow', 'PASS');
    }
    if (mobileNav) {
      log('A4.7 Mobile nav visible', 'PASS');
    } else {
      // Check for mobile nav in the dom
      const hasMobileNavInDom = await page.evaluate(() => {
        const el = document.querySelector('.md\\:hidden, [class*="mobile-nav"]');
        return !!el;
      });
      log('A4.7 Mobile nav visible', hasMobileNavInDom ? 'PASS' : 'WARN', hasMobileNavInDom ? 'Found in DOM' : 'Not found');
    }

    // Reset viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Test 4.8: Welcome page renders
    await page.evaluate(() => {
      localStorage.removeItem('celestix-auth');
    });
    await page.goto(`${BASE}/welcome`, { waitUntil: 'networkidle', timeout: 15000 });
    await settle(1500);
    await screenshot('23-welcome-page');
    const welcomeText = await page.textContent('body');
    if (welcomeText.includes('Celestix') || welcomeText.includes('celestix') || welcomeText.includes('Welcome') || welcomeText.includes('workspace')) {
      log('A4.8 Welcome page renders', 'PASS');
    } else {
      log('A4.8 Welcome page renders', 'FAIL', 'No Celestix/Welcome text found');
    }

    // Test 4.9: Register page renders
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle', timeout: 15000 });
    await settle(1500);
    await screenshot('24-register-page');
    const registerText = await page.textContent('body');
    if (registerText.includes('Create') || registerText.includes('Register') || registerText.includes('Sign up')) {
      log('A4.9 Register page renders', 'PASS');
    } else {
      log('A4.9 Register page renders', 'FAIL');
    }

  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    log('FATAL', 'FAIL', err.message);
    await screenshot('fatal-error');
  }

  // ================================================================
  // SUMMARY
  // ================================================================
  console.log('\n=== SUMMARY ===\n');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  console.log(`Total: ${results.length} | PASS: ${passCount} | FAIL: ${failCount} | WARN: ${warnCount}`);

  // Console errors by page
  console.log('\n=== CONSOLE ERRORS BY PAGE ===\n');
  for (const [url, errors] of Object.entries(consoleErrors)) {
    console.log(`${url}: ${errors.length} errors`);
    errors.slice(0, 3).forEach(e => console.log(`  - ${e.substring(0, 150)}`));
  }

  // Save results to JSON
  const report = {
    timestamp: new Date().toISOString(),
    summary: { total: results.length, pass: passCount, fail: failCount, warn: warnCount },
    results,
    consoleErrors,
    allConsoleErrors: allConsoleErrors.slice(0, 50),
  };
  fs.writeFileSync(path.join(__dirname, 'qa-results.json'), JSON.stringify(report, null, 2));
  console.log('\nResults saved to e2e/qa-results.json');

  await browser.close();
})();
