/**
 * xeGrCrawler.ts — Professional, structured xe.gr rental listings crawler
 *
 * Architecture (exactly as described):
 *
 *   Phase 1 — URL Discovery (multiple independent strategies)
 *     A) Google Search  `site:xe.gr/property/d/listings` → listing URLs without hitting xe.gr
 *     B) Bing Search    same query, independent index, different coverage
 *     C) Direct paginated search crawl — deterministic URLs, rate-limited
 *        For each region × property_type: page 1 → N, stop when no new listings
 *
 *   Phase 2 — Detail Scraping
 *     For each discovered URL: fetch listing page (rate-limited 1–2 req/sec)
 *     Extract: price, beds, baths, sqm, floor, type, area, description,
 *              amenities, heating, energy, agency/private, coordinates
 *
 *   Phase 3 — Normalization
 *     Standardize all fields, strip Greek formatting, compute completeness score
 *
 *   Phase 4 — Deduplication
 *     Primary:   URL hash
 *     Secondary: address + sqm + beds fuzzy match (catches reposts)
 *
 * Rate limiting: 0.8–2.2s randomized delay, max 1–2 req/sec
 * Backoff: on 429/503, wait 5s and retry once; on 403, skip the URL
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface XeGrListing {
  id: string;
  listing_url: string;
  price_eur: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sqm: number | null;
  floor_level: number | null;
  year_built: number | null;
  property_type: string;
  area: string;
  municipality: string;
  description: string | null;
  amenities: string[];
  heating_type: string | null;
  energy_class: string | null;
  is_agency: boolean | null;
  is_furnished: boolean | null;
  has_parking: boolean | null;
  lat: number | null;
  lng: number | null;
  days_on_market: number;
  scraped_at: string;
  completeness_score: number; // 0–100
  data_source: 'xe.gr';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DELAY_MIN = 800;
const DELAY_MAX = 2200;
const MAX_DETAIL_PAGES = 30;   // stop after scraping this many detail pages per crawl
const MAX_SEARCH_PAGES  = 6;   // max pagination pages per search query

// xe.gr geo_place_id map (region → id used in search URL)
const XE_GEO_IDS: Record<string, { id: string; label: string; slug: string }> = {
  athens:         { id: '9',  label: 'Attica',       slug: 'attiki'        },
  athina:         { id: '9',  label: 'Attica',       slug: 'attiki'        },
  attica:         { id: '9',  label: 'Attica',       slug: 'attiki'        },
  'central athens': { id: '36', label: 'Central Athens', slug: 'kentro-athinon' },
  kifisia:        { id: '9',  label: 'Attica',       slug: 'kifisia'       },
  glyfada:        { id: '9',  label: 'Attica',       slug: 'glyfada'       },
  marousi:        { id: '9',  label: 'Attica',       slug: 'marousi'       },
  halandri:       { id: '9',  label: 'Attica',       slug: 'halandri'      },
  chalandri:      { id: '9',  label: 'Attica',       slug: 'halandri'      },
  piraeus:        { id: '4',  label: 'Piraeus',      slug: 'peiraia'       },
  peiraeus:       { id: '4',  label: 'Piraeus',      slug: 'peiraia'       },
  thessaloniki:   { id: '2',  label: 'Thessaloniki', slug: 'thessaloniki'  },
  heraklion:      { id: '20', label: 'Heraklion',    slug: 'herakleio'     },
  patras:         { id: '11', label: 'Patras',       slug: 'patra'         },
  volos:          { id: '13', label: 'Volos',        slug: 'volos'         },
  larissa:        { id: '12', label: 'Larissa',      slug: 'larissa'       },
  rhodes:         { id: '25', label: 'Rhodes',       slug: 'rodos'         },
  chania:         { id: '22', label: 'Chania',       slug: 'hania'         },
  corfu:          { id: '30', label: 'Corfu',        slug: 'kerkyra'       },
};

const PROPERTY_TYPES = ['re_residence', 're_maisonette', 're_detached_house'];

// Greek property spec labels (for HTML parsing)
const GR_LABELS: Record<string, string> = {
  'υπνοδωμάτια':     'bedrooms',
  'υπνοδωμάτιο':     'bedrooms',
  'δωμάτια':         'bedrooms',
  'μπάνια':          'bathrooms',
  'μπάνιο':          'bathrooms',
  'τ.μ.':            'sqm',
  'εμβαδόν':         'sqm',
  'όροφος':          'floor',
  'έτος κατ.':       'year_built',
  'έτος κατασκευής': 'year_built',
  'θέρμανση':        'heating',
  'ενεργειακή κλάση': 'energy',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay(): Promise<void> {
  return delay(DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN));
}

function parsePrice(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return isFinite(n) && n >= 50 && n <= 50000 ? Math.round(n) : null;
}

function parseInt2(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? Math.round(raw) : parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? null : n;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ');
}

/** Compute a completeness score (0–100) based on how many key fields are populated */
function computeCompleteness(l: Partial<XeGrListing>): number {
  const checks = [
    l.price_eur != null,
    l.bedrooms  != null,
    l.sqm       != null,
    l.area      != '' && l.area != null,
    l.property_type != '',
    l.bathrooms != null,
    l.floor_level != null,
    l.year_built != null,
    l.description != null && (l.description?.length ?? 0) > 20,
    (l.amenities?.length ?? 0) > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/** Deduplication fingerprint for reposts (same listing, different URL) */
function listingFingerprint(l: Partial<XeGrListing>): string {
  const area  = (l.area ?? '').toLowerCase().replace(/\s+/g, '');
  const sqm   = l.sqm   != null ? Math.round(l.sqm / 5) * 5   : 0;   // bucket to ±5
  const beds  = l.bedrooms ?? 0;
  const price = l.price_eur != null ? Math.round(l.price_eur / 25) * 25 : 0; // bucket to ±25
  return `${area}|${sqm}|${beds}|${price}`;
}

// ─── HTTP layer ───────────────────────────────────────────────────────────────

/** Polite fetch with realistic Chrome headers and automatic backoff on 429/503 */
async function politeGet(url: string, referer?: string, accept = 'html'): Promise<string> {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.122 Safari/537.36',
    'Accept': accept === 'json'
      ? 'application/json, text/plain, */*'
      : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'el-GR,el;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Sec-Ch-Ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': accept === 'json' ? 'empty' : 'document',
    'Sec-Fetch-Mode': accept === 'json' ? 'cors' : 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'cross-site',
    'Sec-Fetch-User': accept === 'json' ? undefined as any : '?1',
    'Upgrade-Insecure-Requests': accept === 'json' ? undefined as any : '1',
    ...(referer ? { Referer: referer } : {
      Referer: 'https://www.google.gr/search?q=%CE%B5%CE%BD%CE%BF%CE%AF%CE%BA%CE%B9%CE%BF+%CE%B4%CE%B9%CE%B1%CE%BC%CE%AD%CF%81%CE%B9%CF%83%CE%BC%CE%B1',
    }),
    ...(accept === 'json' ? { Origin: 'https://www.xe.gr', 'X-Requested-With': 'XMLHttpRequest' } : {}),
  };

  const attempt = async (retrying = false): Promise<string> => {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: headers as Record<string, string>,
      signal: AbortSignal.timeout(25000),
    });

    if (res.status === 429 || res.status === 503) {
      if (retrying) throw new Error(`HTTP ${res.status} (rate limited)`);
      await delay(5000); // back off 5s before retry
      return attempt(true);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  };

  return attempt();
}

/** Google Search — returns xe.gr listing URLs from index, completely bypasses Cloudflare */
async function googleSearchXeGr(
  city: string,
  bedrooms: number,
  page = 0,
): Promise<string[]> {
  const terms = [
    `site:xe.gr/property/d/listings ενοίκιο ${city} ${bedrooms} υπνοδωμάτια`,
    `site:xe.gr/property/d/listings ενοίκιο διαμέρισμα ${city}`,
    `xe.gr ενοίκιο ${bedrooms}BR ${city} apartments`,
  ];
  const query = terms[page % terms.length];
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&start=${page * 10}&hl=el&gl=gr`;

  const html = await politeGet(googleUrl, undefined, 'html');

  const urls: string[] = [];
  // Google wraps real result links in href="/url?q=..." or direct href="https://..."
  const hrefRe = /href="(https?:\/\/(?:www\.)?xe\.gr\/property\/d\/listings\/\d+[^"&]*)"/gi;
  const altRe  = /href="\/url\?q=(https?:\/\/(?:www\.)?xe\.gr\/property\/d\/listings\/\d+[^&"]+)/gi;
  const seen   = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = hrefRe.exec(html)) !== null) {
    const u = m[1].split('?')[0].replace(/\/$/, '') + '/';
    if (!seen.has(u)) { seen.add(u); urls.push(u); }
  }
  while ((m = altRe.exec(html)) !== null) {
    const u = decodeURIComponent(m[1]).split('?')[0].replace(/\/$/, '') + '/';
    if (!seen.has(u)) { seen.add(u); urls.push(u); }
  }
  return urls;
}

/** Bing Search — independent index, different coverage from Google */
async function bingSearchXeGr(
  city: string,
  bedrooms: number,
  page = 0,
): Promise<string[]> {
  const query    = `site:xe.gr/property/d/listings ενοίκιο ${city} ${bedrooms} υπνοδωμάτια`;
  const bingUrl  = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20&first=${page * 10}&setlang=el-GR&cc=GR`;

  const html = await politeGet(bingUrl, undefined, 'html');

  const urls: string[] = [];
  const re   = /href="(https?:\/\/(?:www\.)?xe\.gr\/property\/d\/listings\/\d+[^"?#]*)"/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const u = m[1].replace(/\/$/, '') + '/';
    if (!seen.has(u)) { seen.add(u); urls.push(u); }
  }
  return urls;
}

/** Direct paginated xe.gr search — deterministic URLs, one page at a time with delay */
async function directSearchPage(
  areaId: string,
  propertyType: string,
  bedrooms: number,
  page: number,
): Promise<string[]> {
  const url = [
    'https://www.xe.gr/property/results',
    `?transaction_name=rent`,
    `&item_type=${encodeURIComponent(propertyType)}`,
    `&geo_place_ids%5B%5D=${areaId}`,
    `&minimum_rooms=${bedrooms}`,
    `&maximum_rooms=${bedrooms}`,
    `&page=${page}`,
    `&sort_by=date`,           // newest first — better for incremental crawl
  ].join('');

  const html = await politeGet(url, 'https://www.xe.gr/property/results');

  // xe.gr embeds listings as window.XE or similar state objects
  // Also try extracting listing URLs directly from the HTML
  const urls: string[] = [];
  const seen = new Set<string>();

  // Pattern A: listing URLs in the HTML (href to /property/d/listings/{id}/)
  const hrefRe = /href="(\/property\/d\/listings\/\d+\/?)"/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    const u = `https://www.xe.gr${m[1].replace(/\/$/, '')}/`;
    if (!seen.has(u)) { seen.add(u); urls.push(u); }
  }

  // Pattern B: data-adid attributes — each card has a listing ID
  const adidRe = /data-adid="(\d+)"/gi;
  while ((m = adidRe.exec(html)) !== null) {
    const u = `https://www.xe.gr/property/d/listings/${m[1]}/`;
    if (!seen.has(u)) { seen.add(u); urls.push(u); }
  }

  // Pattern C: JSON state objects embedded in <script> tags
  const stateRe = /window\.__(?:XE|SEARCH_RESULTS|APP_DATA|INITIAL_STATE)__?\s*=\s*({[\s\S]*?});?\s*(?:window\.|<\/script>)/;
  const sm = html.match(stateRe);
  if (sm) {
    try {
      const state = JSON.parse(sm[1]);
      const items: any[] = state?.results ?? state?.ads ?? state?.listings ?? state?.search?.results ?? [];
      for (const item of items) {
        const id = item?.id ?? item?.adid ?? item?.ad_id;
        const urlPath = item?.url ?? item?.permalink ?? '';
        if (id) {
          const u = urlPath
            ? (urlPath.startsWith('http') ? urlPath : `https://www.xe.gr${urlPath}`)
            : `https://www.xe.gr/property/d/listings/${id}/`;
          if (!seen.has(u)) { seen.add(u); urls.push(u); }
        }
      }
    } catch {}
  }

  return urls;
}

// ─── Detail page scraper ──────────────────────────────────────────────────────

/** Extract all available fields from a single xe.gr listing detail page */
async function scrapeListingDetail(url: string): Promise<Partial<XeGrListing> | null> {
  let html: string;
  try {
    html = await politeGet(url, 'https://www.xe.gr/property/results');
  } catch {
    return null;
  }

  // Skip Cloudflare challenge pages
  if (
    html.includes('Just a moment') ||
    html.includes('cf-challenge') ||
    html.includes('Verifying you are human') ||
    html.length < 2000
  ) {
    return null;
  }

  const listing: Partial<XeGrListing> = {
    listing_url: url,
    amenities:   [],
    data_source: 'xe.gr',
    scraped_at:  new Date().toISOString(),
  };

  // Extract listing ID from URL
  const idM = url.match(/\/listings?\/(\d+)/);
  if (idM) listing.id = idM[1];

  // ── Method 1: JSON-LD (Schema.org) ─────────────────────────────────────────
  const jldRe = /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let jm: RegExpExecArray | null;
  while ((jm = jldRe.exec(html)) !== null) {
    try {
      const ld = JSON.parse(jm[1]);
      const objs = Array.isArray(ld) ? ld : [ld];
      for (const obj of objs) {
        if (obj['@type'] === 'Accommodation' || obj['@type'] === 'RealEstateListing' || obj['@type'] === 'Apartment' || obj.offers) {
          listing.price_eur   ??= parsePrice(obj.offers?.price ?? obj.priceRange) ?? undefined;
          listing.description ??= stripHtml(obj.description ?? '').substring(0, 1000) || undefined;
          listing.area        ??= obj.address?.addressLocality ?? obj.address?.neighborhood ?? undefined;
          listing.municipality ??= obj.address?.addressRegion ?? undefined;
          if (obj.geo) {
            listing.lat ??= parseFloat(obj.geo.latitude)  || undefined as any;
            listing.lng ??= parseFloat(obj.geo.longitude) || undefined as any;
          }
        }
      }
    } catch {}
  }

  // ── Method 2: window.XE / window.__XE__ / window.listing global state ──────
  const windowPatterns = [
    /window\.__?XE__?\s*=\s*({[\s\S]{50,}?});?\s*(?:window\.|<\/script>)/,
    /window\.__LISTING__\s*=\s*({[\s\S]{50,}?});?\s*(?:window\.|<\/script>)/,
    /window\.listingData\s*=\s*({[\s\S]{50,}?});?\s*(?:window\.|<\/script>)/,
    /window\.__APP_DATA__\s*=\s*({[\s\S]{50,}?});?\s*(?:window\.|<\/script>)/,
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]{50,}?});?\s*(?:window\.|<\/script>)/,
    /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]{50,}?});?\s*(?:window\.|<\/script>)/,
  ];

  for (const pattern of windowPatterns) {
    const wm = html.match(pattern);
    if (!wm) continue;
    try {
      const state = JSON.parse(wm[1]);
      // The listing data might be nested under various keys
      const ad = state?.ad ?? state?.listing ?? state?.property ?? state?.item ??
                 state?.adDetails ?? state?.currentAd ?? state;

      listing.price_eur   ??= parsePrice(ad?.price?.value ?? ad?.price?.amount ?? ad?.price ?? ad?.monthly_rent ?? ad?.rent) ?? undefined;
      listing.bedrooms    ??= parseInt2(ad?.number_of_rooms ?? ad?.rooms ?? ad?.bedrooms ?? ad?.characteristics?.rooms) ?? undefined;
      listing.bathrooms   ??= parseInt2(ad?.number_of_bathrooms ?? ad?.bathrooms ?? ad?.characteristics?.bathrooms) ?? undefined;
      listing.sqm         ??= parseFloat(String(ad?.size_in_sqm ?? ad?.size ?? ad?.area ?? ad?.sq_meters ?? '')) || undefined;
      listing.floor_level ??= parseInt2(ad?.floor ?? ad?.floor_level ?? ad?.characteristics?.floor) ?? undefined;
      listing.year_built  ??= parseInt2(ad?.year_of_construction ?? ad?.year_built ?? ad?.construction_year) ?? undefined;
      listing.property_type ??= ad?.item_type_description ?? ad?.property_type ?? ad?.category ?? undefined;
      listing.area        ??= ad?.geo_place?.name ?? ad?.location?.area ?? ad?.address?.area ?? ad?.area_name ?? undefined;
      listing.municipality ??= ad?.location?.municipality ?? ad?.address?.municipality ?? undefined;
      listing.description ??= stripHtml(ad?.description ?? '').substring(0, 1000) || undefined;
      listing.heating_type ??= ad?.heating_type ?? ad?.characteristics?.heating ?? undefined;
      listing.energy_class ??= ad?.energy_class ?? ad?.characteristics?.energy_class ?? undefined;
      listing.is_agency   ??= typeof ad?.is_agency === 'boolean' ? ad.is_agency : (ad?.agency != null ? true : undefined);
      listing.is_furnished ??= ad?.furnished ?? ad?.characteristics?.furnished ?? undefined;
      listing.has_parking ??= ad?.parking ?? ad?.characteristics?.parking ?? undefined;
      if (ad?.geo_point) {
        listing.lat ??= ad.geo_point.lat ?? ad.geo_point.latitude;
        listing.lng ??= ad.geo_point.lon ?? ad.geo_point.lng ?? ad.geo_point.longitude;
      }
      // Amenities / characteristics
      const chars = ad?.characteristics ?? ad?.amenities ?? ad?.features ?? [];
      if (Array.isArray(chars) && chars.length > 0) {
        const amenityStrings = chars
          .map((c: any) => (typeof c === 'string' ? c : c?.name ?? c?.label ?? c?.description ?? ''))
          .filter(Boolean);
        if (amenityStrings.length > 0) {
          listing.amenities = [...(listing.amenities ?? []), ...amenityStrings];
        }
      }
    } catch {}
  }

  // ── Method 3: __NEXT_DATA__ (in case xe.gr migrates to Next.js) ─────────────
  const ndM = html.match(/<script\s+id="__NEXT_DATA__"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (ndM) {
    try {
      const nd = JSON.parse(ndM[1]);
      const props = nd?.props?.pageProps ?? {};
      const ad = props?.ad ?? props?.listing ?? props?.property ?? {};

      listing.price_eur   ??= parsePrice(ad?.price?.value ?? ad?.price ?? ad?.rent) ?? undefined;
      listing.bedrooms    ??= parseInt2(ad?.number_of_rooms ?? ad?.rooms) ?? undefined;
      listing.bathrooms   ??= parseInt2(ad?.bathrooms ?? ad?.number_of_bathrooms) ?? undefined;
      listing.sqm         ??= parseFloat(String(ad?.size_in_sqm ?? ad?.size ?? '')) || undefined;
      listing.floor_level ??= parseInt2(ad?.floor) ?? undefined;
      listing.year_built  ??= parseInt2(ad?.year_of_construction) ?? undefined;
      listing.area        ??= ad?.geo_place?.name ?? ad?.area_name ?? undefined;
      listing.description ??= stripHtml(ad?.description ?? '').substring(0, 1000) || undefined;
    } catch {}
  }

  // ── Method 4: Meta tags ─────────────────────────────────────────────────────
  const metaPrice = html.match(/<meta\s+(?:property|name)="(?:og:price:amount|product:price:amount)"[^>]*content="([^"]+)"/i);
  listing.price_eur ??= parsePrice(metaPrice?.[1]) ?? undefined;

  const metaDesc = html.match(/<meta\s+(?:property|name)="(?:og:description|description)"[^>]*content="([^"]+)"/i);
  if (metaDesc && !listing.description) {
    listing.description = decodeHtmlEntities(metaDesc[1]).substring(0, 1000);
  }

  // ── Method 5: HTML structured data parsing ─────────────────────────────────
  // xe.gr detail pages have a spec table/list: label → value pairs
  // Pattern: <span class="...label...">Υπνοδωμάτια</span>...<span>3</span>
  const specRe = /(?:class="[^"]*(?:label|key|title)[^"]*"|class="[^"]*characteristic[^"]*")(?:[^>]*>|>)<[^/][^>]*>([^<]{3,40})<\/[^>]+>[\s\S]{0,100}?<(?:[^>]*>){0,3}([^<]{1,30})</gi;
  let sm: RegExpExecArray | null;
  while ((sm = specRe.exec(html)) !== null) {
    const labelRaw = sm[1].toLowerCase().trim().replace(/\s+/g, ' ');
    const valueRaw = sm[2].trim();
    const field = GR_LABELS[labelRaw];
    if (!field) continue;
    switch (field) {
      case 'bedrooms':  listing.bedrooms    ??= parseInt2(valueRaw) ?? undefined; break;
      case 'bathrooms': listing.bathrooms   ??= parseInt2(valueRaw) ?? undefined; break;
      case 'sqm':       listing.sqm         ??= parseFloat(valueRaw.replace(',', '.')) || undefined; break;
      case 'floor':     listing.floor_level ??= parseInt2(valueRaw) ?? undefined; break;
      case 'year_built':listing.year_built  ??= parseInt2(valueRaw) ?? undefined; break;
      case 'heating':   listing.heating_type ??= valueRaw; break;
      case 'energy':    listing.energy_class ??= valueRaw; break;
    }
  }

  // Fallback HTML price extraction (covers unstructured pages)
  if (!listing.price_eur) {
    const pricePatterns = [
      /(?:class="[^"]*(?:price|rent|μηνιαίο)[^"]*"[^>]*>)[^<\d]*(\d[\d.,]+)/i,
      /(\d[\d.,]+)\s*€\s*\/\s*(?:μήνα|month)/i,
      /€\s*(\d[\d.,]+)/,
    ];
    for (const p of pricePatterns) {
      const pm = html.match(p);
      if (pm) {
        listing.price_eur = parsePrice(pm[1].replace(/\./g, '').replace(',', '.')) ?? undefined;
        if (listing.price_eur) break;
      }
    }
  }

  // Breadcrumb area extraction (xe.gr shows "Attica > Athens > Kolonaki")
  if (!listing.area) {
    const bcRe = /<(?:nav|ol|ul)[^>]*(?:class="[^"]*breadcrumb[^"]*"|aria-label="breadcrumb")[^>]*>([\s\S]*?)<\/(?:nav|ol|ul)>/i;
    const bcM  = html.match(bcRe);
    if (bcM) {
      const crumbs = bcM[1].match(/<(?:a|li|span)[^>]*>([^<]{2,40})<\/(?:a|li|span)>/gi) ?? [];
      const texts  = crumbs.map(c => stripHtml(c).trim()).filter(t => t.length > 2 && t.length < 40);
      if (texts.length >= 2) {
        listing.municipality ??= texts[texts.length - 2];
        listing.area         ??= texts[texts.length - 1];
      }
    }
  }

  // Amenities from list items (parking, elevator, A/C, etc.)
  const amenityBlockRe = /<(?:ul|div)[^>]*(?:class="[^"]*(?:amenities|features|characteristics)[^"]*")[^>]*>([\s\S]*?)<\/(?:ul|div)>/gi;
  let abm: RegExpExecArray | null;
  while ((abm = amenityBlockRe.exec(html)) !== null) {
    const items = abm[1].match(/<(?:li|span|div)[^>]*>([^<]{3,60})<\/(?:li|span|div)>/g) ?? [];
    const texts = items.map(i => stripHtml(i).trim()).filter(Boolean);
    if (texts.length > 0) {
      listing.amenities = [...(listing.amenities ?? []), ...texts];
    }
  }

  // ── Normalize collected values ──────────────────────────────────────────────
  // Deduplicate amenities
  listing.amenities = [...new Set(listing.amenities ?? [])].slice(0, 20);

  // Normalize property type
  if (listing.property_type) {
    const pt = listing.property_type.toLowerCase();
    if (pt.includes('apart') || pt.includes('διαμέρ') || pt.includes('re_residence')) {
      listing.property_type = 'apartment';
    } else if (pt.includes('maisonnette') || pt.includes('μεζονέτ')) {
      listing.property_type = 'maisonette';
    } else if (pt.includes('house') || pt.includes('μονοκατ') || pt.includes('villa') || pt.includes('βίλα')) {
      listing.property_type = 'house';
    }
  }
  listing.property_type ??= 'apartment';

  // Set defaults
  listing.area         ??= '';
  listing.municipality ??= '';
  listing.days_on_market ??= 0;
  listing.completeness_score = computeCompleteness(listing);

  // Must have at minimum a price to be useful
  if (!listing.price_eur) return null;

  return listing;
}

// ─── Main crawl orchestrator ──────────────────────────────────────────────────

export interface XeGrCrawlOptions {
  maxResults?:      number;   // stop collecting after this many valid listings (default 25)
  maxSearchPages?:  number;   // max pagination pages for direct crawl (default 6)
  skipDetailPages?: boolean;  // if true, only collect URLs + any metadata from search snippets
  onProgress?:      (msg: string) => void;
}

/**
 * Main entry point.
 *
 * Runs all URL discovery strategies in parallel, then scrapes detail pages
 * sequentially with rate limiting.  Returns deduplicated, normalized listings.
 */
export async function crawlXeGr(
  city:     string,
  bedrooms: number,
  opts:     XeGrCrawlOptions = {},
): Promise<XeGrListing[]> {
  const {
    maxResults      = 25,
    maxSearchPages  = MAX_SEARCH_PAGES,
    skipDetailPages = false,
    onProgress      = () => {},
  } = opts;

  const cityKey  = city.toLowerCase().trim();
  const geo      = XE_GEO_IDS[cityKey] ?? XE_GEO_IDS.athens;
  const urlSet   = new Set<string>();

  onProgress(`[xe.gr] Starting URL discovery for "${city}" (${bedrooms}BR)...`);

  // ── Phase 1A: Google search (2 pages) in parallel ─────────────────────────
  const googlePromises = [0, 1].map(async page => {
    try {
      await delay(page * 1500); // stagger
      const urls = await googleSearchXeGr(city, bedrooms, page);
      onProgress(`[xe.gr] Google p${page + 1}: ${urls.length} URLs found`);
      return urls;
    } catch (e) {
      onProgress(`[xe.gr] Google p${page + 1} failed: ${(e as Error).message}`);
      return [] as string[];
    }
  });

  // ── Phase 1B: Bing search (2 pages) in parallel ───────────────────────────
  const bingPromises = [0, 1].map(async page => {
    try {
      await delay(page * 1800 + 500); // offset from Google
      const urls = await bingSearchXeGr(city, bedrooms, page);
      onProgress(`[xe.gr] Bing p${page + 1}: ${urls.length} URLs found`);
      return urls;
    } catch (e) {
      onProgress(`[xe.gr] Bing p${page + 1} failed: ${(e as Error).message}`);
      return [] as string[];
    }
  });

  // Wait for all search engine results
  const searchResults = await Promise.allSettled([...googlePromises, ...bingPromises]);
  for (const r of searchResults) {
    if (r.status === 'fulfilled') r.value.forEach(u => urlSet.add(u));
  }

  onProgress(`[xe.gr] Search engines: ${urlSet.size} unique URLs`);

  // ── Phase 1C: Direct paginated crawl — each property type, pages 1..N ─────
  // Do this sequentially with proper rate limiting
  for (const propType of PROPERTY_TYPES) {
    for (let page = 1; page <= maxSearchPages; page++) {
      try {
        const prevSize = urlSet.size;
        const urls = await directSearchPage(geo.id, propType, bedrooms, page);

        urls.forEach(u => urlSet.add(u));
        const added = urlSet.size - prevSize;
        onProgress(`[xe.gr] Direct ${propType} p${page}: +${added} URLs (total ${urlSet.size})`);

        // Stop pagination: no new listings found on this page
        if (added === 0 && page > 1) break;

        // Rate limit: wait before next page
        await randomDelay();

        // Stop if we already have more than enough URL candidates
        if (urlSet.size >= maxResults * 3) break;
      } catch (e) {
        onProgress(`[xe.gr] Direct ${propType} p${page} failed: ${(e as Error).message}`);
        break; // On any error, stop this property type's pagination
      }
    }
  }

  onProgress(`[xe.gr] URL discovery complete: ${urlSet.size} candidates`);

  if (urlSet.size === 0) {
    onProgress('[xe.gr] No URLs discovered — all strategies failed');
    return [];
  }

  if (skipDetailPages) {
    // Return stubs with just URL (caller will handle detail scraping)
    return [...urlSet].slice(0, maxResults).map(url => ({
      id: url.match(/\/listings?\/(\d+)/)?.[1] ?? url,
      listing_url: url,
      price_eur: 0,
      bedrooms: null, bathrooms: null, sqm: null,
      floor_level: null, year_built: null,
      property_type: 'apartment',
      area: geo.label, municipality: '',
      description: null, amenities: [],
      heating_type: null, energy_class: null,
      is_agency: null, is_furnished: null, has_parking: null,
      lat: null, lng: null,
      days_on_market: 0,
      scraped_at: new Date().toISOString(),
      completeness_score: 10,
      data_source: 'xe.gr' as const,
    }));
  }

  // ── Phase 2: Scrape detail pages sequentially with rate limiting ───────────
  const listings: XeGrListing[] = [];
  const urlFingerprints  = new Set<string>();  // for URL-based dedup
  const bodyFingerprints = new Set<string>();  // for repost dedup

  let processed = 0;
  const urlList = [...urlSet];

  for (const url of urlList) {
    if (listings.length >= maxResults) break;
    if (processed > 0) await randomDelay(); // rate limit between requests

    onProgress(`[xe.gr] Detail ${processed + 1}/${Math.min(urlList.length, MAX_DETAIL_PAGES)}: ${url}`);

    try {
      const detail = await scrapeListingDetail(url);
      processed++;

      if (!detail?.price_eur) {
        onProgress(`[xe.gr] ✗ No price extracted from ${url}`);
        continue;
      }

      // Dedup by URL
      const urlKey = url;
      if (urlFingerprints.has(urlKey)) continue;
      urlFingerprints.add(urlKey);

      // Dedup by content fingerprint (catches reposts with same specs)
      const fp = listingFingerprint(detail);
      if (bodyFingerprints.has(fp)) continue;
      bodyFingerprints.add(fp);

      const full: XeGrListing = {
        id:           detail.id ?? url.match(/\/listings?\/(\d+)/)?.[1] ?? `xe-${Date.now()}`,
        listing_url:  url,
        price_eur:    detail.price_eur,
        bedrooms:     detail.bedrooms ?? null,
        bathrooms:    detail.bathrooms ?? null,
        sqm:          detail.sqm ?? null,
        floor_level:  detail.floor_level ?? null,
        year_built:   detail.year_built ?? null,
        property_type: detail.property_type ?? 'apartment',
        area:         detail.area ?? geo.label,
        municipality: detail.municipality ?? '',
        description:  detail.description ?? null,
        amenities:    detail.amenities ?? [],
        heating_type: detail.heating_type ?? null,
        energy_class: detail.energy_class ?? null,
        is_agency:    detail.is_agency ?? null,
        is_furnished: detail.is_furnished ?? null,
        has_parking:  detail.has_parking ?? null,
        lat:          detail.lat ?? null,
        lng:          detail.lng ?? null,
        days_on_market: detail.days_on_market ?? 0,
        scraped_at:   detail.scraped_at ?? new Date().toISOString(),
        completeness_score: detail.completeness_score ?? 0,
        data_source:  'xe.gr',
      };

      listings.push(full);
      onProgress(`[xe.gr] ✓ ${full.id}: €${full.price_eur}/mo, ${full.bedrooms ?? '?'}BR, ${full.sqm ?? '?'}m², ${full.area} (score: ${full.completeness_score})`);
    } catch (e) {
      processed++;
      onProgress(`[xe.gr] ✗ Error scraping ${url}: ${(e as Error).message}`);
    }

    // Hard stop at MAX_DETAIL_PAGES to avoid runaway scraping
    if (processed >= MAX_DETAIL_PAGES) break;
  }

  // ── Phase 3: Sort by completeness — best data first ────────────────────────
  listings.sort((a, b) => b.completeness_score - a.completeness_score);

  onProgress(`[xe.gr] Done: ${listings.length} listings (from ${processed} pages scraped, ${urlSet.size} URLs found)`);
  return listings;
}

/**
 * Convert a XeGrListing to the common comp shape used by ScraperProvider.
 * This is the bridge between the professional crawler and the market data engine.
 */
export function xeGrListingToComp(l: XeGrListing): any {
  return {
    id:           l.id,
    rent:         l.price_eur,
    bedrooms:     l.bedrooms,
    bathrooms:    l.bathrooms,
    sqm:          l.sqm,
    sqft:         null,
    property_type: l.property_type,
    address:      [l.area, l.municipality].filter(Boolean).join(', ') || 'Greece',
    source_url:   l.listing_url,
    days_on_market: l.days_on_market,
    status:       'active',
    data_source:  'xe.gr',
    _lat:         l.lat,
    _lng:         l.lng,
    // Extra fields passed through for display in the comparables table
    floor_level:  l.floor_level,
    year_built:   l.year_built,
    heating_type: l.heating_type,
    energy_class: l.energy_class,
    is_agency:    l.is_agency,
    amenities:    l.amenities,
    completeness_score: l.completeness_score,
  };
}
