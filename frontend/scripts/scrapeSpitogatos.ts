/**
 * scrapeSpitogatos.ts — Spitogatos.gr bulk scraper
 *
 * Strategy (ported from working Python implementation):
 *   1. Opens a VISIBLE Chrome window — you solve the hCaptcha once if shown
 *   2. Script waits up to 3 minutes for you to clear the challenge
 *   3. Automatically paginates through all results in the SAME browser session
 *   4. All data extracted from listing cards — NO per-detail-page visits
 *   5. Saves to Supabase incrementally after every page (resumable)
 *
 * Proven HTML selectors (from working Python scraper):
 *   article.ordered-element  → listing card container
 *   a.tile__link              → listing URL
 *   h3.tile__title            → property title (type + sqm)
 *   h3.tile__location         → address / neighbourhood
 *   p.price__text             → rent (€)
 *   li[title]                 → floor, bedrooms, bathrooms (structured)
 *
 * Commands (from frontend/):
 *   npm run scrape:dry    — preview first page, no Supabase write
 *   npm run scrape        — Athens areas (default)
 *   npm run scrape:all    — all cities
 */

import * as fs   from 'fs';
import * as path from 'path';

// ─── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  const p = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(p)) { console.error('❌  .env.local not found'); process.exit(1); }
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

// ─── Scrape targets ───────────────────────────────────────────────────────────
// Each area gets its own paginated crawl.  Pages to scrape × ~20 cards/page = listings.

interface ScrapeArea {
  url:      string;
  label:    string;
  region:   string;
  pages:    number;
}

const ATHENS_AREAS: ScrapeArea[] = [
  { url: 'https://www.spitogatos.gr/en/to_rent-homes/athens-center',        label: 'Athens Center',  region: 'attiki', pages: 25 },
  { url: 'https://www.spitogatos.gr/en/to_rent-homes/athens-north',         label: 'Athens North',   region: 'attiki', pages: 20 },
  { url: 'https://www.spitogatos.gr/en/to_rent-homes/athens-south',         label: 'Athens South',   region: 'attiki', pages: 20 },
  { url: 'https://www.spitogatos.gr/en/to_rent-homes/athens-west',          label: 'Athens West',    region: 'attiki', pages: 15 },
  { url: 'https://www.spitogatos.gr/en/to_rent-homes/athens-east',          label: 'Athens East',    region: 'attiki', pages: 15 },
];

const ALL_AREAS: ScrapeArea[] = [
  ...ATHENS_AREAS,
  { url: 'https://www.spitogatos.gr/en/to_rent-homes/piraeus',              label: 'Piraeus',        region: 'peiraia',      pages: 15 },
  { url: 'https://www.spitogatos.gr/en/to_rent-homes/thessaloniki',         label: 'Thessaloniki',   region: 'thessaloniki', pages: 25 },
  { url: 'https://www.spitogatos.gr/en/to_rent-homes/thessaloniki-center',  label: 'Thess. Center',  region: 'thessaloniki', pages: 15 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id:            string;
  listing_url:   string;
  price_eur:     number;
  bedrooms:      number | null;
  bathrooms:     number | null;
  sqm:           number | null;
  floor_level:   number | null;
  year_built:    null;
  property_type: string;
  area:          string;
  municipality:  string;
  region:        string;
  latitude:      null;
  longitude:     null;
  description:   string | null;
  amenities:     string[];
  heating_type:  string | null;
  energy_class:  null;
  is_agency:     null;
  is_furnished:  boolean | null;
  has_parking:   boolean | null;
  completeness:  number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const randDelay = () => sleep(1800 + Math.random() * 2000);

function completenessScore(l: Omit<Listing, 'completeness'>): number {
  return Math.round([
    l.price_eur > 0, l.bedrooms != null, l.sqm != null,
    l.area !== '', l.bathrooms != null, l.floor_level != null,
    (l.description?.length ?? 0) > 20, l.amenities.length > 0,
  ].filter(Boolean).length / 8 * 100);
}

// ─── Card parser (runs inside Playwright page context) ────────────────────────
// Extracts all fields from a single article.ordered-element card.
// Runs as a serialisable function passed to page.evaluate() — no imports.

const PARSE_CARDS_FN = `
() => {
  const BASE = 'https://www.spitogatos.gr';

  function cleanText(el) {
    return el ? el.textContent.replace(/\\s+/g, ' ').trim() : '';
  }

  return Array.from(document.querySelectorAll('article.ordered-element')).flatMap(article => {
    // ── URL ──────────────────────────────────────────────────────────────
    const linkEl = article.querySelector('a.tile__link');
    if (!linkEl) return [];
    const href = linkEl.getAttribute('href') || '';
    const url  = href.startsWith('http') ? href : BASE + href;

    // ── Title → type + sqm ───────────────────────────────────────────────
    const titleText = cleanText(article.querySelector('h3.tile__title'));
    let sqm = null;
    const sqmM = titleText.match(/(\\d+)\\s*m[²2]/i) || titleText.match(/(\\d+)\\s*τ\\.μ\\./i);
    if (sqmM) sqm = parseInt(sqmM[1]);

    const tl = titleText.toLowerCase();
    const propertyType = tl.includes('studio') || tl.includes('γκαρσον') ? 'studio'
                       : tl.includes('maisonn') || tl.includes('μεζον')  ? 'maisonette'
                       : tl.includes('house')   || tl.includes('villa')  ? 'house'
                       : 'apartment';

    // ── Address ──────────────────────────────────────────────────────────
    const locationEl = article.querySelector('h3.tile__location');
    let address = cleanText(locationEl);
    address = address.replace(/\\s*\\(Athens[^)]*\\)\\s*$/i, '').trim() || 'Athens';

    // ── Price ─────────────────────────────────────────────────────────────
    const priceEl  = article.querySelector('p.price__text');
    const priceRaw = cleanText(priceEl) || linkEl.getAttribute('title') || '';
    const priceM   = priceRaw.match(/€([\\d,.]+)/);
    const price    = priceM ? parseInt(priceM[1].replace(/[.,]/g, '')) : null;
    if (!price || price < 50 || price > 50000) return [];

    // ── Specs from li[title] — floor / bedrooms / bathrooms ───────────────
    // Must check "bathroom" BEFORE "bedroom" because "bathroom" contains "room"
    let floor = null, bedrooms = null, bathrooms = null;
    for (const li of article.querySelectorAll('li[title]')) {
      const t   = (li.getAttribute('title') || '').toLowerCase();
      const txt = cleanText(li);
      const num = parseInt(txt.replace(/[^\\d]/g, ''));
      if (isNaN(num)) continue;
      if (t.includes('floor'))                          floor     = num;
      else if (t.includes('bathroom') || t.includes('bath')) bathrooms = num;
      else if (t.includes('bedroom')  || t.includes('room'))  bedrooms  = num;
    }

    // Fallback: parse from card raw text
    const raw = article.textContent.replace(/\\s+/g, ' ');
    if (bedrooms  === null) { const m = raw.match(/(\\d+)\\s*br\\b/i);  if (m) bedrooms  = parseInt(m[1]); }
    if (bathrooms === null) { const m = raw.match(/(\\d+)\\s*ba\\b/i);  if (m) bathrooms = parseInt(m[1]); }
    if (floor     === null) { const m = raw.match(/(\\d+)\\s*(?:st|nd|rd|th)\\b/i); if (m) floor = parseInt(m[1]); }
    if (bedrooms  === null) bedrooms = 1;

    // ── Description from p.tile__description ──────────────────────────────
    const descEl      = article.querySelector('p.tile__description');
    const description = descEl ? cleanText(descEl).slice(0, 800) : null;

    // ── Amenities from raw text ────────────────────────────────────────────
    const rawL     = raw.toLowerCase();
    const amenities = [];
    if (/parking|garage|γκαράζ/.test(rawL))                       amenities.push('Parking');
    if (/air.?condition|a\\/c|κλιματ/.test(rawL))                 amenities.push('Air Conditioning');
    if (/elevator|lift|ασανσέρ/.test(rawL))                       amenities.push('Elevator');
    if (/balcon|μπαλκόν/.test(rawL))                              amenities.push('Balcony');
    if (/storage|αποθήκη/.test(rawL))                             amenities.push('Storage');
    if (/fireplace|τζάκι/.test(rawL))                             amenities.push('Fireplace');
    if (/garden|yard|κήπο/.test(rawL))                            amenities.push('Garden');

    const isFurnished = /fully.?furnished|επιπλωμέν|furnished/i.test(rawL) ? true
                      : /unfurnished|χωρίς έπιπλ/i.test(rawL)             ? false
                      : null;
    const hasParking  = /parking|garage|γκαράζ/i.test(rawL);

    // ── Listing ID from URL ────────────────────────────────────────────────
    const idM = url.match(/\\/([\\w-]+)\\/?$/);
    const id   = idM ? idM[1] : url;

    return [{
      url, id, titleText, address, price, sqm, bedrooms, bathrooms,
      floor, propertyType, description, amenities, isFurnished, hasParking,
    }];
  });
}
`;

// ─── Captcha wait loop ────────────────────────────────────────────────────────

async function waitForListings(page: any, timeoutSec = 180): Promise<boolean> {
  const deadline = Date.now() + timeoutSec * 1000;
  let prompted   = false;

  while (Date.now() < deadline) {
    const html = await page.content();
    const blocked  = html.includes('Pardon Our Interruption') || html.includes('hcaptcha') || html.includes('h-captcha') || html.includes('onProtectionInitialized');
    const hasCards = html.includes('ordered-element') || html.includes('tile__title');

    if (hasCards && !blocked) return true;

    if (!prompted) {
      console.log('\n  ⚠️  Bot protection detected.');
      console.log('  👆 Please solve the hCaptcha in the Chrome window.');
      console.log('  ⏳ Waiting up to 3 minutes...\n');
      prompted = true;
    }

    const remaining = Math.round((deadline - Date.now()) / 1000);
    process.stdout.write(`\r  [waiting for captcha — ${remaining}s remaining]   `);
    await sleep(3000);
  }

  process.stdout.write('\n');
  return false;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

/** Throws a clear error if the table doesn't exist. Call before launching browser. */
async function ensureTableExists(): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/spitogatos_listings?limit=0`, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Accept':        'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 404) {
    const body = await res.text().catch(() => '');
    console.error('\n❌  The spitogatos_listings table does not exist in Supabase.');
    console.error('    Run the SQL migration first:');
    console.error('    1. Open https://supabase.com → your project → SQL Editor');
    console.error('    2. Paste and run the contents of:');
    console.error('       frontend/lib/supabase/spitogatos_listings.sql');
    console.error('    3. Then re-run the scraper.\n');
    if (body) console.error('    Supabase says:', body.slice(0, 200));
    process.exit(1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    console.error(`\n❌  Supabase pre-flight check failed (${res.status}): ${body.slice(0, 200)}`);
    process.exit(1);
  }

  console.log('  ✓ Supabase table confirmed\n');
}

async function upsertBatch(listings: Listing[]): Promise<{ saved: number; errors: number }> {
  if (!listings.length) return { saved: 0, errors: 0 };

  const rows = listings.map(l => ({
    id: l.id, listing_url: l.listing_url, price_eur: l.price_eur,
    bedrooms: l.bedrooms, bathrooms: l.bathrooms, sqm: l.sqm,
    floor_level: l.floor_level, year_built: null, property_type: l.property_type,
    area: l.area, municipality: l.municipality, region: l.region,
    latitude: null, longitude: null,
    description: l.description, amenities: l.amenities,
    heating_type: null, energy_class: null,
    is_agency: null, is_furnished: l.is_furnished, has_parking: l.has_parking,
    completeness_score: l.completeness,
  }));

  const res = await fetch(`${SUPABASE_URL}/rest/v1/spitogatos_listings`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':         SUPABASE_KEY,
      'Authorization':  `Bearer ${SUPABASE_KEY}`,
      'Prefer':         'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    // Re-surface table-not-found as a fatal error so the caller can abort
    if (res.status === 404) {
      throw new Error(`TABLE_NOT_FOUND: ${err.slice(0, 200)}`);
    }
    console.error(`\n  ⚠️  Supabase ${res.status}: ${err.slice(0, 300)}`);
    return { saved: 0, errors: listings.length };
  }
  return { saved: listings.length, errors: 0 };
}

// ─── Progress ─────────────────────────────────────────────────────────────────

const PROGRESS_FILE = path.resolve(__dirname, '.scrape-progress.json');
interface Progress { completed: string[]; totalSaved: number; }
const loadProgress  = (): Progress => { try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')); } catch { return { completed: [], totalSaved: 0 }; } };
const saveProgress  = (p: Progress) => fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));

// ─── Navigate to next page ────────────────────────────────────────────────────
// Returns the URL we ended up on so the caller can verify it actually changed.

async function goToNextPage(page: any, baseUrl: string, pageNum: number): Promise<string | false> {
  const urlBefore = page.url();
  const next = pageNum + 1;

  // 1. Try clicking the "next" pagination button
  for (const sel of [
    "a[rel='next']",
    'a.pagination__next',
    'li.next > a',
    "a[aria-label='Next page']",
    "a[aria-label='Next']",
    `a[data-page='${next}']`,
    `.pagination a:last-child`,
  ]) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
        await sleep(2000);
        const urlAfter = page.url();
        if (urlAfter !== urlBefore) return urlAfter;
      }
    } catch {}
  }

  // 2. Try common Spitogatos pagination URL patterns
  const stripped = baseUrl.replace(/[?#].*$/, '');   // remove any existing params
  const candidates = [
    `${stripped}?pg=${next}`,                          // ?pg=N  (most common for spitogatos)
    `${stripped}?page=${next}`,                        // ?page=N
    `${stripped}/${next}`,                             // /N
    `${stripped}/page-${next}`,                        // /page-N
  ];

  for (const url of candidates) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(2000);
      const html = await page.content();
      if (html.includes('Pardon Our Interruption')) return false;
      const urlAfter = page.url();
      // If the site redirected us back to page 1 (URL unchanged or matches baseUrl), skip
      if (urlAfter === urlBefore || urlAfter === stripped || urlAfter === baseUrl) continue;
      // Verify the page actually has listings
      if (html.includes('ordered-element') || html.includes('tile__title')) return urlAfter;
    } catch {}
  }

  return false;
}

// ─── Convert raw card data → Listing ─────────────────────────────────────────

function toListingRow(card: any, region: string): Listing | null {
  if (!card.price || !card.url) return null;
  const base: Omit<Listing, 'completeness'> = {
    id:            String(card.id ?? card.url),
    listing_url:   card.url,
    price_eur:     card.price,
    bedrooms:      card.bedrooms ?? null,
    bathrooms:     card.bathrooms ?? null,
    sqm:           card.sqm ?? null,
    floor_level:   card.floor ?? null,
    year_built:    null,
    property_type: card.propertyType ?? 'apartment',
    area:          card.address ?? '',
    municipality:  '',
    region,
    latitude:      null,
    longitude:     null,
    description:   card.description ?? null,
    amenities:     card.amenities ?? [],
    heating_type:  null,
    energy_class:  null,
    is_agency:     null,
    is_furnished:  card.isFurnished ?? null,
    has_parking:   card.hasParking ?? null,
  };
  return { ...base, completeness: completenessScore(base) };
}

// ─── Main scrape ──────────────────────────────────────────────────────────────

async function scrape(areas: ScrapeArea[], dryRun: boolean) {
  const { chromium } = await import('playwright');

  // Fail fast if table doesn't exist — before we even open Chrome
  if (!dryRun) await ensureTableExists();

  const progress   = loadProgress();
  const doneSet    = new Set(progress.completed);
  let   totalSaved = progress.totalSaved;

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║   Spitogatos Scraper${dryRun ? ' — DRY RUN' : ''}                         ║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
  if (totalSaved > 0) console.log(`  ▶  Resuming: ${totalSaved} already saved\n`);

  const browser = await chromium.launch({
    channel:  'chrome',
    headless: false,
    args:     ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    locale:   'en-US',
    viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();

  try {
    for (const area of areas) {
      console.log(`\n🏙  ${area.label}  (up to ${area.pages} pages)`);

      // Navigate to first page
      await page.goto(area.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(4000);

      // Wait for captcha if shown
      const cleared = await waitForListings(page);
      if (!cleared) {
        console.error(`\n  ✗ Could not clear protection for ${area.label} — skipping`);
        continue;
      }
      console.log('  ✓ Page loaded\n');

      // Track listing URLs seen in this area to detect pagination loops
      const seenUrlsThisArea = new Set<string>();
      let currentPageUrl = area.url;
      let newThisArea = 0;

      for (let pageNum = 1; pageNum <= area.pages; pageNum++) {
        const key = `${area.region}-${area.label}-p${pageNum}`;
        if (!dryRun && doneSet.has(key)) { process.stdout.write('·'); continue; }

        // Extract cards from current page using proven DOM selectors
        const cards: any[] = await page.evaluate(eval(PARSE_CARDS_FN) as any);

        if (cards.length === 0) {
          process.stdout.write('∅');
          break; // End of results for this area
        }

        // ── Duplicate / loop detection ──────────────────────────────────────
        // If >60% of cards on this page were already seen, we're looping (same page loaded again).
        const newCards   = cards.filter(c => c.url && !seenUrlsThisArea.has(c.url));
        const dupeCount  = cards.length - newCards.length;
        const dupeRatio  = dupeCount / cards.length;
        if (pageNum > 1 && dupeRatio > 0.6) {
          console.log(`\n  ⚠️  Page ${pageNum}: ${dupeCount}/${cards.length} duplicates — pagination loop detected. Stopping this area.`);
          break;
        }
        cards.forEach(c => c.url && seenUrlsThisArea.add(c.url));

        if (dryRun) {
          console.log(`  Page ${pageNum}: ${cards.length} listings (${newCards.length} new)\n`);
          cards.slice(0, 5).forEach((c, i) => {
            console.log(`  [${i + 1}]`);
            console.log(`    url:       ${c.url}`);
            console.log(`    price:     €${c.price}`);
            console.log(`    bedrooms:  ${c.bedrooms}`);
            console.log(`    bathrooms: ${c.bathrooms}`);
            console.log(`    sqm:       ${c.sqm}`);
            console.log(`    address:   ${c.address}`);
            console.log(`    floor:     ${c.floor}`);
            console.log(`    type:      ${c.propertyType}`);
            console.log(`    amenities: [${c.amenities.join(', ')}]`);
            console.log(`    furnished: ${c.isFurnished}`);
            console.log('');
          });
          console.log(`\n✅  Dry run complete. Run "npm run scrape" for the full crawl.`);
          await browser.close();
          return;
        }

        // Convert and upsert only truly new cards to get accurate counts
        const listings = newCards.flatMap(c => { const l = toListingRow(c, area.region); return l ? [l] : []; });
        let saved = 0, errors = 0;
        if (listings.length > 0) {
          try {
            ({ saved, errors } = await upsertBatch(listings));
          } catch (e: any) {
            if (String(e?.message).startsWith('TABLE_NOT_FOUND')) {
              console.error('\n\n❌  Table not found mid-scrape. Create it in Supabase and re-run.');
              console.error('    frontend/lib/supabase/spitogatos_listings.sql\n');
              process.exit(1);
            }
            console.error(`\n  ⚠️  Upsert error: ${e?.message ?? e}`);
            errors = listings.length;
          }
        }
        totalSaved += saved;
        newThisArea += saved;

        // Only mark page as done when data was actually saved (or nothing new to save)
        if (errors === 0) {
          doneSet.add(key);
          progress.completed = [...doneSet];
        }
        progress.totalSaved = totalSaved;
        saveProgress(progress);

        process.stdout.write(`\r  ${errors ? '⚠' : '✓'} ${area.label} p${pageNum}: +${saved} new (total ${totalSaved})   `);

        if (pageNum >= area.pages) break;

        // Navigate to next page in same session
        const nextUrl = await goToNextPage(page, currentPageUrl, pageNum);
        if (!nextUrl) {
          process.stdout.write(` ← end of results (${newThisArea} new saved)\n`);
          break;
        }
        currentPageUrl = nextUrl;

        // Check if we hit protection again after pagination
        await sleep(1000);
        const html = await page.content();
        if (html.includes('Pardon Our Interruption')) {
          console.log(`\n  ⚠️  Hit protection after page ${pageNum}. Waiting for solve...`);
          const ok = await waitForListings(page);
          if (!ok) break;
        }

        await randDelay();
      }

      console.log('');
    }
  } finally {
    await browser.close();
  }

  if (!dryRun) {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(`║  Done! ${String(totalSaved).padStart(5)} listings saved to Supabase          ║`);
    console.log('╚══════════════════════════════════════════════════════╝\n');
    try { fs.unlinkSync(PROGRESS_FILE); } catch {}
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args   = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const all    = args.includes('--all');
  const areas  = all ? ALL_AREAS : ATHENS_AREAS;

  console.log(`ℹ  Supabase key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'}`);
  if (!dryRun) {
    console.log(`ℹ  Areas: ${areas.map(a => a.label).join(', ')}`);
    console.log(`ℹ  A Chrome window will open — leave it running, solve captcha if shown.`);
    console.log(`ℹ  Ctrl+C at any time — progress is saved and the next run resumes.\n`);
    await sleep(1500);
  }

  await scrape(areas, dryRun);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
