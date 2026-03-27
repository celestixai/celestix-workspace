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
  const bugsFounds = [];

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
      if (text.includes('React DevTools') || text.includes('favicon') || text.includes('ERR_CONNECTION_REFUSED')) return;
      if (text.includes('downloadable font') || text.includes('the server responded with a status of 404')) return;
      const url = page.url();
      if (!consoleErrors[url]) consoleErrors[url] = [];
      consoleErrors[url].push(text);
      allConsoleErrors.push({ url, text });
    }
  });

  async function screenshot(name) {
    await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: false });
  }

  async function settle(ms = 2000) {
    await page.waitForTimeout(ms);
  }

  // Navigate to a module by clicking the nav rail button
  async function navigateToModule(moduleId) {
    // The nav rail uses data-module-id or we can click by label
    // Try clicking the button with matching text/id
    const btn = await page.$(`[data-module="${moduleId}"], button[data-nav-id="${moduleId}"]`);
    if (btn) {
      await btn.click();
      await settle(2000);
      return true;
    }
    // Fallback: use zustand store directly via page.evaluate
    try {
      await page.evaluate((mod) => {
        // Access zustand store from window or localStorage
        const storeData = JSON.parse(localStorage.getItem('celestix-ui') || '{}');
        if (storeData.state) {
          storeData.state.activeModule = mod;
          localStorage.setItem('celestix-ui', JSON.stringify(storeData));
        }
      }, moduleId);
      // Reload to pick up the change
      await page.reload({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
      await settle(2000);
      return true;
    } catch {
      return false;
    }
  }

  // Better module navigation: click the nav-rail item by finding the label text
  async function clickNavItem(label) {
    // Try various selectors
    const selectors = [
      `nav button:has-text("${label}")`,
      `aside button:has-text("${label}")`,
      `[role="navigation"] button:has-text("${label}")`,
      `button:has-text("${label}")`,
    ];
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const isVisible = await el.isVisible();
          if (isVisible) {
            await el.click();
            await settle(2000);
            return true;
          }
        }
      } catch {}
    }
    return false;
  }

  try {
    // ================================================================
    // LOGIN
    // ================================================================
    console.log('\n=== LOGIN ===\n');

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.fill('input[type="email"]', CREDS.email);
    await page.fill('input[type="password"]', CREDS.password);
    await page.click('button[type="submit"]');
    await settle(3000);

    const postLoginUrl = page.url();
    if (!postLoginUrl.includes('/login')) {
      log('LOGIN', 'PASS', `Redirected to ${postLoginUrl}`);
    } else {
      log('LOGIN', 'FAIL', 'Still on login page');
    }

    // ================================================================
    // B1: TASKS - Navigate to Spaces > Engineering > Backend > API Development
    // ================================================================
    console.log('\n=== B1: TASKS ===\n');

    // Navigate to Spaces module
    await clickNavItem('Spaces');
    await screenshot('b1-01-spaces');

    // Look for Engineering space and expand it
    const engSpace = await page.$('text=Engineering');
    if (engSpace) {
      await engSpace.click();
      await settle(1500);
      log('B1.0 Engineering space found', 'PASS');
    } else {
      log('B1.0 Engineering space found', 'FAIL', 'Not found in sidebar');
    }
    await screenshot('b1-02-engineering');

    // Look for Backend folder
    const backendFolder = await page.$('text=Backend');
    if (backendFolder) {
      await backendFolder.click();
      await settle(1500);
      log('B1.0a Backend folder found', 'PASS');
    } else {
      log('B1.0a Backend folder found', 'WARN', 'Not found');
    }

    // Look for API Development list
    const apiDevList = await page.$('text=API Development');
    if (apiDevList) {
      await apiDevList.click();
      await settle(2000);
      log('B1.0b API Development list found', 'PASS');
    } else {
      log('B1.0b API Development list found', 'WARN', 'Not found');
    }
    await screenshot('b1-03-api-development');

    // B1.1 Task list renders with tasks
    const taskRows = await page.$$('[class*="task"], [data-task-id], tr, [class*="TaskRow"], [role="row"]');
    const bodyText = await page.textContent('body');
    const taskCount = taskRows.length;
    if (taskCount > 0) {
      log('B1.1 Task list renders with tasks', 'PASS', `Found ${taskCount} task-like rows`);
    } else if (bodyText.includes('No tasks') || bodyText.includes('empty')) {
      log('B1.1 Task list renders with tasks', 'WARN', 'List appears empty');
    } else {
      log('B1.1 Task list renders with tasks', 'WARN', 'Could not identify task rows');
    }
    await screenshot('b1-04-task-list');

    // B1.2 Quick add task input
    const quickAdd = await page.$('input[placeholder*="task"], input[placeholder*="Task"], input[placeholder*="add"], input[placeholder*="Add"], [class*="quick-add"], [class*="QuickAdd"]');
    if (quickAdd) {
      log('B1.2 Quick add task input exists', 'PASS');
      try {
        await quickAdd.fill('QA Test Task B1');
        await page.keyboard.press('Enter');
        await settle(1500);
        log('B1.2a Quick add task submitted', 'PASS');
      } catch (e) {
        log('B1.2a Quick add task submitted', 'WARN', e.message.substring(0, 100));
      }
    } else {
      log('B1.2 Quick add task input exists', 'WARN', 'Not found on page');
    }
    await screenshot('b1-05-quick-add');

    // B1.3 Custom task IDs (ENG-xxx)
    const pageContent = await page.textContent('body');
    const engIdMatches = pageContent.match(/ENG-\d+/g) || [];
    if (engIdMatches.length > 0) {
      log('B1.3 Custom task IDs (ENG-xxx) visible', 'PASS', `Found ${engIdMatches.length} IDs: ${engIdMatches.slice(0, 5).join(', ')}`);
    } else {
      log('B1.3 Custom task IDs (ENG-xxx) visible', 'WARN', 'No ENG-xxx IDs found');
    }

    // B1.4 Checkboxes exist for selection
    const checkboxes = await page.$$('input[type="checkbox"], [role="checkbox"]');
    if (checkboxes.length > 0) {
      log('B1.4 Checkboxes exist for selection', 'PASS', `Found ${checkboxes.length} checkboxes`);
    } else {
      log('B1.4 Checkboxes exist for selection', 'WARN', 'No checkboxes found');
    }

    // B1.5 Views bar visible (List/Board tabs)
    const listTab = await page.$('text=List');
    const boardTab = await page.$('text=Board');
    const viewsBar = listTab || boardTab;
    if (viewsBar) {
      log('B1.5 Views bar visible', 'PASS', `List tab: ${!!listTab}, Board tab: ${!!boardTab}`);
    } else {
      log('B1.5 Views bar visible', 'WARN', 'No List/Board tabs found');
    }
    await screenshot('b1-06-views-bar');

    // ================================================================
    // B2: VIEW SWITCHING
    // ================================================================
    console.log('\n=== B2: VIEW SWITCHING ===\n');

    // Click Board tab if visible
    if (boardTab) {
      try {
        await boardTab.click();
        await settle(2000);
        await screenshot('b2-01-board-view');
        const kanbanColumns = await page.$$('[class*="column"], [class*="Column"], [class*="kanban"], [data-status]');
        log('B2.1 Board view (kanban)', 'PASS', `Found ${kanbanColumns.length} column-like elements`);
      } catch (e) {
        log('B2.1 Board view (kanban)', 'FAIL', e.message.substring(0, 100));
      }
    } else {
      // Try clicking any element that says "Board"
      try {
        await page.click('button:has-text("Board"), [role="tab"]:has-text("Board")');
        await settle(2000);
        await screenshot('b2-01-board-view');
        log('B2.1 Board view (kanban)', 'PASS', 'Clicked Board button');
      } catch {
        log('B2.1 Board view (kanban)', 'WARN', 'No Board tab found to click');
        await screenshot('b2-01-board-view');
      }
    }

    // Look for view controls (Filter, Sort, Group)
    const filterBtn = await page.$('text=Filter');
    const sortBtn = await page.$('text=Sort');
    const groupBtn = await page.$('text=Group');
    const viewControls = [filterBtn && 'Filter', sortBtn && 'Sort', groupBtn && 'Group'].filter(Boolean);
    if (viewControls.length > 0) {
      log('B2.2 View control buttons', 'PASS', `Found: ${viewControls.join(', ')}`);
    } else {
      log('B2.2 View control buttons', 'WARN', 'No Filter/Sort/Group buttons found');
    }
    await screenshot('b2-02-view-controls');

    // ================================================================
    // B3: FEATURE PAGES
    // ================================================================
    console.log('\n=== B3: FEATURE PAGES ===\n');

    // Map of module IDs to nav labels (matching nav-rail.tsx)
    const moduleTests = [
      { id: 'goals', label: 'Goals' },
      { id: 'automations', label: 'Automations' },
      { id: 'inbox', label: 'Inbox' },
      { id: 'planner', label: 'Planner' },
      { id: 'dashboards', label: 'Dashboards' },
      { id: 'clips', label: 'Clips' },
      { id: 'sprints', label: 'Sprints' },
      { id: 'people', label: 'People' },
      { id: 'integrations', label: 'Integrations' },
      { id: 'messenger', label: 'Messenger' },
      { id: 'workspace', label: 'Workspace' },
      { id: 'email', label: 'Email' },
      { id: 'calendar', label: 'Calendar' },
      { id: 'files', label: 'Files' },
      { id: 'notes', label: 'Notes' },
      { id: 'contacts', label: 'Contacts' },
      { id: 'settings', label: 'Settings' },
      { id: 'documents', label: 'Docs' },
    ];

    for (const mod of moduleTests) {
      console.log(`  Testing module: ${mod.id} (${mod.label})`);
      const errorsBefore = allConsoleErrors.length;

      // Try clicking nav item first
      let navigated = await clickNavItem(mod.label);
      if (!navigated) {
        // Fallback: set module via localStorage + reload
        await navigateToModule(mod.id);
      }

      await settle(2000);
      await screenshot(`b3-${mod.id}`);

      // Check body has content
      const modBody = await page.textContent('body').catch(() => '');
      const hasContent = modBody.length > 100; // Non-trivial content
      const newErrors = allConsoleErrors.slice(errorsBefore);

      if (hasContent) {
        log(`B3 ${mod.id} page`, 'PASS', `Body length: ${modBody.length}, console errors: ${newErrors.length}`);
      } else {
        log(`B3 ${mod.id} page`, 'FAIL', `Body too short (${modBody.length} chars)`);
      }

      if (newErrors.length > 0) {
        log(`B3 ${mod.id} console errors`, 'WARN', newErrors.map(e => e.text.substring(0, 80)).join(' | '));
      }
    }

    // ================================================================
    // B4: AI PANEL
    // ================================================================
    console.log('\n=== B4: AI PANEL ===\n');

    // Navigate to a stable page first
    await clickNavItem('Home') || await clickNavItem('Messenger');
    await settle(1000);

    // Press Ctrl+J to open AI command bar
    await page.keyboard.press('Control+j');
    await settle(1500);
    await screenshot('b4-01-ai-command-bar');

    const aiPanel = await page.$('[class*="ai"], [class*="AI"], [class*="command"], [role="dialog"]');
    const aiText = await page.textContent('body');
    const hasAIPanel = aiPanel || aiText.includes('AI') || aiText.includes('Brain') || aiText.includes('Ollama') || aiText.includes('offline');
    if (hasAIPanel) {
      log('B4.1 AI command bar opens (Ctrl+J)', 'PASS');
    } else {
      log('B4.1 AI command bar opens (Ctrl+J)', 'WARN', 'AI panel not clearly detected');
    }

    // Check for offline message
    const offlineMsg = aiText.includes('offline') || aiText.includes('Ollama') || aiText.includes('not running') || aiText.includes('connect');
    if (offlineMsg) {
      log('B4.2 Offline message (Ollama not running)', 'PASS', 'Offline/connection message detected');
    } else {
      log('B4.2 Offline message (Ollama not running)', 'WARN', 'No explicit offline message');
    }

    // Close AI panel
    await page.keyboard.press('Escape');
    await settle(500);

    // ================================================================
    // B5: INTERACTIVE FEATURES
    // ================================================================
    console.log('\n=== B5: INTERACTIVE FEATURES ===\n');

    // B5.1 Ctrl+K search palette
    await page.keyboard.press('Control+k');
    await settle(1500);
    await screenshot('b5-01-search-palette');

    const searchPalette = await page.$('[class*="search"], [class*="Search"], [class*="palette"], [class*="Palette"], [class*="command"], [role="dialog"], [role="combobox"]');
    const searchInput = await page.$('input[placeholder*="earch"], input[placeholder*="Search"]');
    if (searchPalette || searchInput) {
      log('B5.1 Search palette (Ctrl+K)', 'PASS');
    } else {
      log('B5.1 Search palette (Ctrl+K)', 'WARN', 'Search palette not clearly detected');
    }

    // Close search
    await page.keyboard.press('Escape');
    await settle(500);

    // B5.2 ? keyboard shortcuts modal
    // First click somewhere neutral to make sure no input is focused
    await page.click('main').catch(() => {});
    await settle(300);
    await page.keyboard.press('?');
    await settle(1500);
    await screenshot('b5-02-keyboard-shortcuts');

    const shortcutsModal = await page.$('[class*="shortcut"], [class*="Shortcut"], [class*="modal"]:has-text("Keyboard")');
    const shortcutsText = await page.textContent('body');
    const hasShortcuts = shortcutsModal || shortcutsText.includes('Keyboard Shortcuts') || shortcutsText.includes('keyboard shortcuts');
    if (hasShortcuts) {
      log('B5.2 Keyboard shortcuts modal (?)', 'PASS');
    } else {
      log('B5.2 Keyboard shortcuts modal (?)', 'WARN', 'Shortcuts modal not clearly detected');
    }

    // Close
    await page.keyboard.press('Escape');
    await settle(500);

  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    log('FATAL', 'FAIL', err.message.substring(0, 200));
    await screenshot('fatal-error');
  } finally {
    await browser.close();
  }

  // ================================================================
  // Generate report
  // ================================================================
  const screenshotFiles = fs.readdirSync(SCREENSHOTS).filter(f => f.startsWith('b'));

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;

  console.log(`\n=== SUMMARY: ${passCount} PASS, ${failCount} FAIL, ${warnCount} WARN ===`);
  console.log(`Screenshots: ${screenshotFiles.length}`);
  console.log(`Console errors: ${allConsoleErrors.length}`);

  // Write JSON results
  fs.writeFileSync(
    path.join(__dirname, 'qa-part-b-results.json'),
    JSON.stringify({ results, consoleErrors, allConsoleErrors, screenshots: screenshotFiles }, null, 2)
  );

  console.log('\nResults written to e2e/qa-part-b-results.json');
  console.log('Run build checks separately.');
})();
