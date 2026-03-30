#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';

// ── Config ──────────────────────────────────────────────────────────────────

const SCROLL_STEP = 300;
const SCROLL_PAUSE = 400;
const NAV_TIMEOUT = 30_000;
const DOWNLOAD_CONCURRENCY = 6;
const MIN_IMAGE_BYTES = 20_000;    // skip images < 20 KB (thumbnails / icons)
const MIN_IMAGE_DIMENSION = 300;   // skip <img> where max(w,h) < 300 px (thumbnails)
const TRACKER_DOMAINS = [
  'facebook.com', 'google-analytics.com', 'googletagmanager.com',
  'doubleclick.net', 'twitter.com', 'linkedin.com', 'bing.com',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  process.stdout.write(`[${ts}] ${msg}\n`);
}

function normalizeUrl(raw, baseHostname) {
  try {
    const u = new URL(raw);
    if (u.hostname !== baseHostname) return null;
    u.hash = '';
    u.search = '';
    const clean = u.href.replace(/\/+$/, '');
    return clean;
  } catch { return null; }
}

function pagePathToDir(pageUrl, domain) {
  const u = new URL(pageUrl);
  let p = u.pathname.replace(/^\/+|\/+$/g, '') || '_root';
  p = p.replace(/[<>:"|?*]/g, '_');
  return path.join('downloaded-assets', domain, p);
}

function filenameFromUrl(imgUrl) {
  try {
    const u = new URL(imgUrl);
    const segments = u.pathname.split('/').filter(Boolean);
    let name = segments[segments.length - 1] || 'image';
    name = name.replace(/[<>:"|?*]/g, '_');
    if (!/\.\w{2,5}$/.test(name)) name += '.jpg';
    return name;
  } catch { return 'image.jpg'; }
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function downloadImage(url, destPath) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
  if (contentLength > 0 && contentLength < MIN_IMAGE_BYTES) {
    throw new Error(`Too small (${contentLength} bytes)`);
  }

  const fileStream = createWriteStream(destPath);
  await pipeline(Readable.fromWeb(res.body), fileStream);
}

function shouldSkipImage(src) {
  if (!src) return true;
  if (src.startsWith('data:')) return true;
  if (src.endsWith('.svg')) return true;
  try {
    const u = new URL(src);
    if (TRACKER_DOMAINS.some(d => u.hostname.includes(d))) return true;
    // Wix image resizer srcset variants (w_NNN,h_NNN) are blocked when fetched directly
    if (u.hostname.includes('wixstatic.com') && /\/v1\/fill\/w_\d+/.test(u.pathname)) return true;
  } catch { return true; }
  return false;
}

// ── Core: per-page processing ───────────────────────────────────────────────

async function autoScroll(page) {
  await page.evaluate(async (step, pause) => {
    await new Promise(resolve => {
      let lastHeight = 0;
      let stableCount = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        const newHeight = document.body.scrollHeight;
        if (newHeight === lastHeight) {
          stableCount++;
          if (stableCount >= 5) { clearInterval(timer); resolve(); }
        } else {
          stableCount = 0;
          lastHeight = newHeight;
        }
      }, pause);
      setTimeout(() => { clearInterval(timer); resolve(); }, 30_000);
    });
  }, SCROLL_STEP, SCROLL_PAUSE);
}

// Returns only links found inside nav/header elements on the page.
// Falls back to all same-domain links if no nav elements are found.
async function extractNavLinks(page, baseHostname) {
  const hrefs = await page.evaluate(() => {
    const navSelectors = [
      'nav a[href]',
      'header a[href]',
      '[role="navigation"] a[href]',
      '[class*="nav"] a[href]',
      '[class*="menu"] a[href]',
      '[id*="nav"] a[href]',
      '[id*="menu"] a[href]',
    ];
    const found = new Set();
    for (const sel of navSelectors) {
      document.querySelectorAll(sel).forEach(a => found.add(a.href));
    }
    // Fall back to all links if the page has no recognisable nav
    if (found.size === 0) {
      document.querySelectorAll('a[href]').forEach(a => found.add(a.href));
    }
    return [...found];
  });

  const links = new Set();
  for (const href of hrefs) {
    const clean = normalizeUrl(href, baseHostname);
    if (clean) links.add(clean);
  }
  return links;
}

async function extractImageUrls(page, minDim) {
  return page.evaluate((minDim) => {
    const urls = new Set();

    // <img> src — skip thumbnails by rendered / natural pixel size
    document.querySelectorAll('img').forEach(img => {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w > 0 && h > 0 && Math.max(w, h) < minDim) return; // thumbnail
      if (img.src) urls.add(img.src);
      if (img.currentSrc) urls.add(img.currentSrc);
    });

    // <img> srcset — take only the largest descriptor per srcset
    document.querySelectorAll('img[srcset]').forEach(img => {
      let bestSrc = null, bestW = 0;
      img.srcset.split(',').forEach(entry => {
        const parts = entry.trim().split(/\s+/);
        const src = parts[0];
        const w = parts[1] ? parseInt(parts[1], 10) : 0;
        if (w > bestW) { bestW = w; bestSrc = src; }
      });
      if (bestSrc) urls.add(bestSrc);
    });

    // <source> srcset inside <picture> — largest descriptor only
    document.querySelectorAll('picture source[srcset]').forEach(source => {
      let bestSrc = null, bestW = 0;
      source.srcset.split(',').forEach(entry => {
        const parts = entry.trim().split(/\s+/);
        const src = parts[0];
        const w = parts[1] ? parseInt(parts[1], 10) : 0;
        if (w > bestW) { bestW = w; bestSrc = src; }
      });
      if (bestSrc) urls.add(bestSrc);
    });

    // CSS background-image on all elements
    document.querySelectorAll('*').forEach(el => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') {
        const matches = bg.matchAll(/url\(["']?(.*?)["']?\)/g);
        for (const m of matches) {
          if (m[1]) urls.add(m[1]);
        }
      }
    });

    return [...urls];
  }, minDim);
}

// ── Core: per-page image scraper ────────────────────────────────────────────

async function scrapePage(browser, pageUrl, domain, globalImages, downloadedCount) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
    await autoScroll(page);

    const rawImages = await extractImageUrls(page, MIN_IMAGE_DIMENSION);
    const newImages = rawImages.filter(src => !shouldSkipImage(src) && !globalImages.has(src));

    if (newImages.length > 0) {
      const dir = pagePathToDir(pageUrl, domain);
      await ensureDir(dir);

      const usedNames = new Set();

      for (let i = 0; i < newImages.length; i += DOWNLOAD_CONCURRENCY) {
        const batch = newImages.slice(i, i + DOWNLOAD_CONCURRENCY);
        await Promise.allSettled(batch.map(async (imgUrl) => {
          if (globalImages.has(imgUrl)) return;
          globalImages.add(imgUrl);

          let name = filenameFromUrl(imgUrl);
          if (usedNames.has(name)) {
            const ext = path.extname(name);
            const base = path.basename(name, ext);
            let n = 2;
            while (usedNames.has(`${base}_${n}${ext}`)) n++;
            name = `${base}_${n}${ext}`;
          }
          usedNames.add(name);

          const dest = path.join(dir, name);
          try {
            await downloadImage(imgUrl, dest);
            downloadedCount.value++;
            log(`  ✓ ${name}`);
          } catch (err) {
            log(`  ✗ ${name} — ${err.message}`);
          }
        }));
      }
    }

    log(`  → ${newImages.length} new images on this page (${downloadedCount.value} total downloaded)\n`);
  } catch (err) {
    log(`  ⚠ Page error: ${err.message}\n`);
  } finally {
    await page.close();
  }
}

// ── Core: crawler ───────────────────────────────────────────────────────────

async function crawl(startUrl) {
  const origin = new URL(startUrl);
  const baseHostname = origin.hostname;
  const domain = baseHostname;
  const home = normalizeUrl(startUrl, baseHostname) || startUrl;

  const globalImages = new Set();
  const downloadedCount = { value: 0 };
  const navLinks = new Set(); // declared here so it's accessible after the try block

  log(`Starting crawl of ${domain}`);
  log(`Mode: homepage + top-level nav pages only (no deep crawl)`);
  log(`Output → downloaded-assets/${domain}/\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ── Phase 1: scrape homepage and collect nav links ───────────────────────
    log(`[Page 1] ${home}`);
    const homePage = await browser.newPage();
    await homePage.setViewport({ width: 1440, height: 900 });

    try {
      await homePage.goto(home, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
      await autoScroll(homePage);

      const discovered = await extractNavLinks(homePage, baseHostname);
      for (const l of discovered) navLinks.add(l);
      // Remove the home URL itself so we don't double-scrape it
      navLinks.delete(home);

      log(`  Found ${navLinks.size} nav link(s): ${[...navLinks].join(', ')}\n`);

      const rawImages = await extractImageUrls(homePage, MIN_IMAGE_DIMENSION);
      const newImages = rawImages.filter(src => !shouldSkipImage(src) && !globalImages.has(src));

      if (newImages.length > 0) {
        const dir = pagePathToDir(home, domain);
        await ensureDir(dir);
        const usedNames = new Set();

        for (let i = 0; i < newImages.length; i += DOWNLOAD_CONCURRENCY) {
          const batch = newImages.slice(i, i + DOWNLOAD_CONCURRENCY);
          await Promise.allSettled(batch.map(async (imgUrl) => {
            if (globalImages.has(imgUrl)) return;
            globalImages.add(imgUrl);
            let name = filenameFromUrl(imgUrl);
            if (usedNames.has(name)) {
              const ext = path.extname(name);
              const base = path.basename(name, ext);
              let n = 2;
              while (usedNames.has(`${base}_${n}${ext}`)) n++;
              name = `${base}_${n}${ext}`;
            }
            usedNames.add(name);
            const dest = path.join(dir, name);
            try {
              await downloadImage(imgUrl, dest);
              downloadedCount.value++;
              log(`  ✓ ${name}`);
            } catch (err) {
              log(`  ✗ ${name} — ${err.message}`);
            }
          }));
        }
        log(`  → ${newImages.length} new images on homepage (${downloadedCount.value} total downloaded)\n`);
      }
    } catch (err) {
      log(`  ⚠ Homepage error: ${err.message}\n`);
    } finally {
      await homePage.close();
    }

    // ── Phase 2: scrape each nav page (no further recursion) ─────────────────
    const navArray = [...navLinks];
    for (let i = 0; i < navArray.length; i++) {
      const pageUrl = navArray[i];
      log(`[Page ${i + 2}/${navArray.length + 1}] ${pageUrl}`);
      await scrapePage(browser, pageUrl, domain, globalImages, downloadedCount);
    }
  } finally {
    await browser.close();
  }

  const totalPages = 1 + navLinks.size;
  log(`\n✅ Done! Scraped ${totalPages} pages, downloaded ${downloadedCount.value} images.`);
  log(`   Output: downloaded-assets/${domain}/`);
}

// ── CLI entry ───────────────────────────────────────────────────────────────

const url = process.argv[2];

if (!url) {
  console.error('\nUsage: node scrape-images.js <url>\n');
  console.error('Example: node scrape-images.js https://www.goodguysroofing.com\n');
  process.exit(1);
}

try {
  new URL(url);
} catch {
  console.error(`\nInvalid URL: "${url}"\n`);
  process.exit(1);
}

crawl(url).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
