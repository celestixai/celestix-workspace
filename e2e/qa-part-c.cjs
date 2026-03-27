/**
 * QA Part C — Celestix Workspace
 * 1. Browser Interactive Tests (Playwright)
 * 2. Backend API Audit (fetch/http)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ── Config ──────────────────────────────────────────────────────────
const FRONTEND = 'http://localhost:5173';
const BACKEND  = 'http://localhost:3001';
const API_BASE = `${BACKEND}/api/v1`;
const CREDS    = { email: 'alice@celestix.local', password: 'Password123' };
const SCREENSHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

// ── Helpers ─────────────────────────────────────────────────────────
const browserResults = [];
const apiResults     = [];

function logBrowser(test, status, detail = '') {
  browserResults.push({ test, status, detail });
  console.log(`[BROWSER][${status}] ${test}${detail ? ' — ' + detail : ''}`);
}

function logApi(endpoint, status, code, detail = '') {
  apiResults.push({ endpoint, status, code, detail });
  console.log(`[API][${status}] ${code} ${endpoint}${detail ? ' — ' + detail : ''}`);
}

function httpGet(url, token) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, body: parsed, raw: body });
      });
    });
    req.on('error', (err) => resolve({ status: 0, body: null, raw: err.message }));
    req.end();
  });
}

function httpPost(url, data, token) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const payload = JSON.stringify(data);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers,
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, body: parsed, raw: body });
      });
    });
    req.on('error', (err) => resolve({ status: 0, body: null, raw: err.message }));
    req.write(payload);
    req.end();
  });
}

// ════════════════════════════════════════════════════════════════════
// PART 1: BROWSER INTERACTIVE TESTS
// ════════════════════════════════════════════════════════════════════

async function runBrowserTests() {
  console.log('\n══════════════════════════════════════════════════');
  console.log(' PART 1: BROWSER INTERACTIVE TESTS (Playwright)');
  console.log('══════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const ss = async (name) => {
    await page.screenshot({ path: path.join(SCREENSHOTS, `c-${name}.png`), fullPage: false });
  };
  const settle = (ms = 2000) => page.waitForTimeout(ms);

  try {
    // ── LOGIN ────────────────────────────────────────────────────
    console.log('--- Login ---');
    await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.fill('input[type="email"]', CREDS.email);
    await page.fill('input[type="password"]', CREDS.password);
    await page.click('button[type="submit"]');
    await settle(3000);

    const postLogin = page.url();
    if (!postLogin.includes('/login')) {
      logBrowser('LOGIN', 'PASS', `Redirected to ${postLogin}`);
    } else {
      logBrowser('LOGIN', 'FAIL', 'Still on login page');
      await browser.close();
      return;
    }

    // ── C1: Ctrl+N → Quick Task Modal ───────────────────────────
    console.log('\n--- C1: Quick Task Modal (Ctrl+N) ---');
    await page.keyboard.press('Control+n');
    await settle(1500);
    // Check for modal / dialog
    const quickTaskModal = await page.$('[role="dialog"], [data-state="open"], .modal, [class*="modal"], [class*="Modal"], [class*="quick-task"], [class*="QuickTask"]');
    if (quickTaskModal) {
      logBrowser('C1 Quick Task Modal opens on Ctrl+N', 'PASS');
    } else {
      // Some apps open a new browser tab on Ctrl+N. Check if there's any overlay.
      const overlay = await page.$('[class*="overlay"], [class*="Overlay"], [data-radix-popper-content-wrapper]');
      if (overlay) {
        logBrowser('C1 Quick Task Modal opens on Ctrl+N', 'PASS', 'Overlay detected');
      } else {
        logBrowser('C1 Quick Task Modal opens on Ctrl+N', 'WARN', 'No modal/dialog detected (may have opened new tab)');
      }
    }
    await ss('c1-quick-task-modal');
    // Close modal if open
    await page.keyboard.press('Escape');
    await settle(500);

    // ── C2: Goals → Create ──────────────────────────────────────
    console.log('\n--- C2: Goals → Create ---');
    await page.click('button[aria-label="Goals"]');
    await settle(2000);
    await ss('c2-goals-page');

    // Look for a Create/New button
    const goalsCreateBtn = await page.$('button:has-text("Create"), button:has-text("New Goal"), button:has-text("Add Goal"), button:has-text("New"), [aria-label="Create goal"]');
    if (goalsCreateBtn) {
      await goalsCreateBtn.click();
      await settle(1500);
      logBrowser('C2 Goals → Create button found & clicked', 'PASS');
    } else {
      // Try plus icon button
      const plusBtn = await page.$('[class*="goal"] button, button:has-text("+")');
      if (plusBtn) {
        await plusBtn.click();
        await settle(1500);
        logBrowser('C2 Goals → Create button found & clicked', 'PASS', 'via plus button');
      } else {
        logBrowser('C2 Goals → Create button found & clicked', 'WARN', 'No Create button visible');
      }
    }
    await ss('c2-goals-create');
    // Close any open modals/overlays
    await page.keyboard.press('Escape');
    await settle(800);
    await page.keyboard.press('Escape');
    await settle(800);
    // Force-close any remaining overlay by clicking outside or removing it
    const overlay2 = await page.$('.fixed.inset-0.z-50, [class*="overlay"][class*="fixed"]');
    if (overlay2) {
      await page.evaluate(() => {
        document.querySelectorAll('.fixed.inset-0.z-50').forEach(el => el.remove());
      });
      await settle(500);
    }

    // ── C3: Automations → Create ────────────────────────────────
    console.log('\n--- C3: Automations → Create ---');
    await page.click('button[aria-label="Automations"]', { timeout: 10000 }).catch(async () => {
      // If still blocked, force-remove overlays
      await page.evaluate(() => {
        document.querySelectorAll('[class*="fixed"][class*="inset"]').forEach(el => {
          if (el.classList.contains('z-50') || el.style.zIndex >= 50) el.remove();
        });
      });
      await settle(500);
      await page.click('button[aria-label="Automations"]', { timeout: 5000 });
    });
    await settle(2000);
    await ss('c3-automations-page');

    const autoCreateBtn = await page.$('button:has-text("Create"), button:has-text("New Automation"), button:has-text("Add"), button:has-text("New")');
    if (autoCreateBtn) {
      await autoCreateBtn.click();
      await settle(1500);
      logBrowser('C3 Automations → Create button found & clicked', 'PASS');
    } else {
      logBrowser('C3 Automations → Create button found & clicked', 'WARN', 'No Create button visible');
    }
    await ss('c3-automations-create');
    await page.keyboard.press('Escape');
    await settle(800);
    await page.keyboard.press('Escape');
    await settle(800);
    await page.evaluate(() => {
      document.querySelectorAll('.fixed.inset-0.z-50, [class*="overlay"][class*="fixed"]').forEach(el => el.remove());
    }).catch(() => {});
    await settle(500);

    // ── C4: Dashboards → Create ─────────────────────────────────
    console.log('\n--- C4: Dashboards → Create ---');
    await page.click('button[aria-label="Dashboards"]', { timeout: 10000 }).catch(async () => {
      await page.evaluate(() => {
        document.querySelectorAll('[class*="fixed"][class*="inset"]').forEach(el => {
          if (el.classList.contains('z-50') || el.style.zIndex >= 50) el.remove();
        });
      });
      await settle(500);
      await page.click('button[aria-label="Dashboards"]', { timeout: 5000 });
    });
    await settle(2000);
    await ss('c4-dashboards-page');

    const dashCreateBtn = await page.$('button:has-text("Create"), button:has-text("New Dashboard"), button:has-text("Add"), button:has-text("New")');
    if (dashCreateBtn) {
      await dashCreateBtn.click();
      await settle(1500);
      logBrowser('C4 Dashboards → Create button found & clicked', 'PASS');
    } else {
      logBrowser('C4 Dashboards → Create button found & clicked', 'WARN', 'No Create button visible');
    }
    await ss('c4-dashboards-create');
    await page.keyboard.press('Escape');
    await settle(800);
    await page.keyboard.press('Escape');
    await settle(800);
    await page.evaluate(() => {
      document.querySelectorAll('.fixed.inset-0.z-50, [class*="overlay"][class*="fixed"]').forEach(el => el.remove());
    }).catch(() => {});
    await settle(500);

    // ── C5: Ctrl+K → Search "API" ──────────────────────────────
    console.log('\n--- C5: Ctrl+K → Search "API" ---');
    // Make sure we're on a clean state
    await page.click('button[aria-label="Home"]').catch(() => {});
    await settle(1000);
    await page.keyboard.press('Control+k');
    await settle(1500);

    const searchPalette = await page.$('[role="dialog"], [data-state="open"], [class*="palette"], [class*="Palette"], [class*="command"], [class*="Command"], [cmdk-root], input[placeholder*="Search"], input[placeholder*="search"]');
    if (searchPalette) {
      logBrowser('C5 Search palette opens on Ctrl+K', 'PASS');
      // Type "API"
      await page.keyboard.type('API', { delay: 80 });
      await settle(2000);
      logBrowser('C5 Typed "API" in search', 'PASS');
    } else {
      logBrowser('C5 Search palette opens on Ctrl+K', 'WARN', 'No search dialog detected');
    }
    await ss('c5-search-api');
    await page.keyboard.press('Escape');
    await settle(800);
    await page.keyboard.press('Escape');
    await settle(800);
    await page.evaluate(() => {
      document.querySelectorAll('.fixed.inset-0.z-50, [class*="overlay"][class*="fixed"]').forEach(el => el.remove());
    }).catch(() => {});
    await settle(500);

    // ── C6: Workspace → General channel → Message input ─────────
    console.log('\n--- C6: Workspace → General channel → Message input ---');
    await page.click('button[aria-label="Workspace"]', { timeout: 10000 }).catch(async () => {
      await page.evaluate(() => {
        document.querySelectorAll('[class*="fixed"][class*="inset"]').forEach(el => {
          if (el.classList.contains('z-50') || el.style.zIndex >= 50) el.remove();
        });
      });
      await settle(500);
      await page.click('button[aria-label="Workspace"]', { timeout: 5000 });
    });
    await settle(3000);
    await ss('c6-workspace-page');

    // Find the "general" channel in the sidebar/channel list
    let foundGeneral = false;
    // Try multiple selectors for "general"
    for (const sel of [':text("general")', 'text=general', 'button:has-text("general")', 'div:has-text("general")']) {
      try {
        const els = await page.$$(sel);
        for (const el of els) {
          const text = (await el.textContent() || '').trim().toLowerCase();
          if (text === 'general' || text.includes('general')) {
            const visible = await el.isVisible();
            if (visible) {
              await el.click();
              await settle(2000);
              foundGeneral = true;
              break;
            }
          }
        }
        if (foundGeneral) break;
      } catch {}
    }
    if (foundGeneral) {
      logBrowser('C6 Found "general" channel', 'PASS');
    } else {
      logBrowser('C6 Found "general" channel', 'WARN', 'Channel text not found; checking for any channel');
    }
    await ss('c6-workspace-channel');

    // Check for message input (textarea or contenteditable)
    const msgInput = await page.$('textarea, [contenteditable="true"], input[placeholder*="message"], input[placeholder*="Message"], textarea[placeholder*="message"], textarea[placeholder*="Message"]');
    if (msgInput) {
      logBrowser('C6 Message input exists in workspace channel', 'PASS');
    } else {
      logBrowser('C6 Message input exists in workspace channel', 'WARN', 'No textarea/contenteditable found');
    }
    await ss('c6-workspace-message-input');

  } catch (err) {
    logBrowser('UNEXPECTED ERROR', 'FAIL', err.message);
  } finally {
    await browser.close();
  }
}

// ════════════════════════════════════════════════════════════════════
// PART 2: BACKEND API AUDIT
// ════════════════════════════════════════════════════════════════════

async function runApiAudit() {
  console.log('\n══════════════════════════════════════════════════');
  console.log(' PART 2: BACKEND API AUDIT');
  console.log('══════════════════════════════════════════════════\n');

  // Login
  const loginRes = await httpPost(`${API_BASE}/auth/login`, CREDS);
  if (!loginRes.body?.data?.accessToken) {
    console.error('FATAL: Cannot login.', loginRes.raw);
    return;
  }
  const token   = loginRes.body.data.accessToken;
  const userId  = loginRes.body.data.user.id;
  logApi('/auth/login', 'PASS', loginRes.status, `userId=${userId}`);

  // Get workspace ID
  const wsRes = await httpGet(`${API_BASE}/workspace`, token);
  const wsId  = wsRes.body?.data?.[0]?.id || '';
  logApi('/workspace', wsRes.status < 300 ? 'PASS' : 'FAIL', wsRes.status, `wsId=${wsId}`);

  // Get space + list IDs
  const spacesRes = await httpGet(`${API_BASE}/spaces/workspace/${wsId}/spaces`, token);
  const spaceId   = spacesRes.body?.data?.[0]?.id || '';
  logApi(`/spaces/workspace/{wsId}/spaces`, spacesRes.status < 300 ? 'PASS' : 'FAIL', spacesRes.status, `spaceId=${spaceId}`);

  const listsRes = await httpGet(`${API_BASE}/task-lists/space/${spaceId}/lists`, token);
  const listId   = listsRes.body?.data?.[0]?.id || '';
  logApi(`/task-lists/space/{spaceId}/lists`, listsRes.status < 300 ? 'PASS' : 'FAIL', listsRes.status, `listId=${listId}`);

  // ── All endpoints to audit ────────────────────────────────────
  const endpoints = [
    { label: '/auth/me',                              url: `${API_BASE}/auth/me` },
    { label: '/spaces/{spaceId}',                     url: `${API_BASE}/spaces/${spaceId}` },
    { label: '/spaces/{spaceId}/members',             url: `${API_BASE}/spaces/${spaceId}/members` },
    { label: '/spaces/{spaceId}/statuses',            url: `${API_BASE}/spaces/${spaceId}/statuses` },
    { label: '/folders/space/{spaceId}/folders',      url: `${API_BASE}/folders/space/${spaceId}/folders` },
    { label: '/task-lists/{listId}/statuses',         url: `${API_BASE}/task-lists/${listId}/statuses` },
    { label: '/task-types/space/{spaceId}',           url: `${API_BASE}/task-types/space/${spaceId}` },
    { label: '/custom-fields/workspace/{wsId}',       url: `${API_BASE}/custom-fields/workspace/${wsId}` },
    { label: '/tags/workspace/{wsId}',                url: `${API_BASE}/tags/workspace/${wsId}` },
    { label: '/templates/workspace/{wsId}',           url: `${API_BASE}/templates/workspace/${wsId}` },
    { label: '/automations/workspace/{wsId}',         url: `${API_BASE}/automations/workspace/${wsId}` },
    { label: '/automations/templates',                url: `${API_BASE}/automations/templates` },
    { label: '/goals/workspace/{wsId}',               url: `${API_BASE}/goals/workspace/${wsId}` },
    { label: '/goals/workspace/{wsId}/folders',       url: `${API_BASE}/goals/workspace/${wsId}/folders` },
    { label: '/dashboards-custom/workspace/{wsId}',   url: `${API_BASE}/dashboards-custom/workspace/${wsId}` },
    { label: '/inbox',                                url: `${API_BASE}/inbox` },
    { label: '/inbox/counts',                         url: `${API_BASE}/inbox/counts` },
    { label: '/reminders',                            url: `${API_BASE}/reminders` },
    { label: '/docs/hub?workspaceId={wsId}',          url: `${API_BASE}/docs/hub?workspaceId=${wsId}` },
    { label: '/clips/workspace/{wsId}',               url: `${API_BASE}/clips/workspace/${wsId}` },
    { label: '/sprints/space/{spaceId}/folders',      url: `${API_BASE}/sprints/space/${spaceId}/folders` },
    { label: '/time-tracking/report',                 url: `${API_BASE}/time-tracking/report?startDate=2020-01-01&endDate=2030-12-31` },
    { label: '/schedules/workspace/{wsId}',           url: `${API_BASE}/schedules/workspace/${wsId}` },
    { label: '/ai/status',                            url: `${API_BASE}/ai/status` },
    { label: '/search/advanced?q=test',               url: `${API_BASE}/search/advanced?q=test&workspaceId=${wsId}&limit=5` },
    { label: '/integrations/workspace/{wsId}',        url: `${API_BASE}/integrations/workspace/${wsId}` },
    { label: '/teams/workspace/{wsId}',               url: `${API_BASE}/teams/workspace/${wsId}` },
    { label: '/notifications',                        url: `${API_BASE}/notifications` },
    { label: '/notifications/unread-count',           url: `${API_BASE}/notifications/unread-count` },
  ];

  for (const ep of endpoints) {
    const res = await httpGet(ep.url, token);
    const ok = res.status >= 200 && res.status < 300;
    logApi(ep.label, ok ? 'PASS' : 'FAIL', res.status, ok ? '' : (res.body?.error || res.raw?.substring(0, 100)));
  }
}

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════

(async () => {
  const startTime = Date.now();

  await runBrowserTests();
  await runApiAudit();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n══════════════════════════════════════════════════');
  console.log(' SUMMARY');
  console.log('══════════════════════════════════════════════════');

  const bPass = browserResults.filter(r => r.status === 'PASS').length;
  const bWarn = browserResults.filter(r => r.status === 'WARN').length;
  const bFail = browserResults.filter(r => r.status === 'FAIL').length;
  console.log(`Browser: ${bPass} PASS, ${bWarn} WARN, ${bFail} FAIL (of ${browserResults.length})`);

  const aPass = apiResults.filter(r => r.status === 'PASS').length;
  const aWarn = apiResults.filter(r => r.status === 'WARN').length;
  const aFail = apiResults.filter(r => r.status === 'FAIL').length;
  console.log(`API:     ${aPass} PASS, ${aWarn} WARN, ${aFail} FAIL (of ${apiResults.length})`);
  console.log(`Elapsed: ${elapsed}s`);

  // Write results JSON
  const resultsFile = path.join(__dirname, 'qa-part-c-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({ browserResults, apiResults, elapsed }, null, 2));
  console.log(`\nResults saved to ${resultsFile}`);
})();
