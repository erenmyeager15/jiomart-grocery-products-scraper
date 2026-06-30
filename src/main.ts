import { Actor, log } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { normalizeInput } from './input.js';
import { buildHomeUrl, buildProductsUrl, extractProducts, isBlockedPage } from './routes.js';
import type { ActorInput, CapturedPayload, LocationSnapshot, RequestData } from './types.js';

await Actor.init();

const input = (await Actor.getInput<ActorInput>()) ?? {};
const normalizedInput = normalizeInput(input);
const searchQueries = normalizedInput.searchQueries;
const requestedLocationName = normalizedInput.locationName;
const latitude = normalizedInput.latitude;
const longitude = normalizedInput.longitude;
const brands = new Set(normalizedInput.brands.map((value) => value.toLowerCase()));
const categories = new Set(normalizedInput.categories.map((value) => value.toLowerCase()));
const inStockOnly = normalizedInput.inStockOnly;
const minPrice = normalizedInput.minPrice;
const maxPrice = normalizedInput.maxPrice;
const maxResults = normalizedInput.maxResults;
const maxPagesPerQuery = normalizedInput.maxPagesPerQuery;

const proxyConfiguration = await Actor.createProxyConfiguration(normalizedInput.proxyConfiguration);

const seenProductKeys = new Set<string>();
let savedCount = 0;
let spendingLimitReached = false;
let fatalBillingError: Error | null = null;
let failedRequestCount = 0;

const requests = searchQueries.map((searchQuery) => ({
    url: buildHomeUrl(searchQuery),
    uniqueKey: `jiomart-${searchQuery.toLowerCase()}`,
    userData: { searchQuery } satisfies RequestData,
}));

const parseJson = (value: string | null): Record<string, unknown> | null => {
    if (!value) return null;
    try {
        const parsed: unknown = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
};

const readLocationSnapshot = async (page: any): Promise<LocationSnapshot> => {
    const snapshot = await page.evaluate(() => {
        const parse = (value: string | null): Record<string, unknown> | null => {
            if (!value) return null;
            try {
                const parsed = JSON.parse(value) as unknown;
                return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
                    ? parsed as Record<string, unknown>
                    : null;
            } catch {
                return null;
            }
        };
        return {
            pin: window.localStorage.getItem('pin'),
            stores: window.localStorage.getItem('jio_qc_stores'),
            delivery: window.localStorage.getItem('nms_delivery_config_info'),
        };
    });

    const pin = parseJson(snapshot.pin);
    const stores = parseJson(snapshot.stores);
    const groceries = stores && typeof stores.GROCERIES === 'object' && stores.GROCERIES !== null
        ? stores.GROCERIES as Record<string, unknown>
        : null;
    const delivery = parseJson(snapshot.delivery);
    const deliveryPromise = delivery && typeof delivery.delivery_promise === 'object' && delivery.delivery_promise !== null
        ? delivery.delivery_promise as Record<string, unknown>
        : null;
    const address = groceries && typeof groceries.address === 'object' && groceries.address !== null
        ? groceries.address as Record<string, unknown>
        : null;

    const city = (pin?.city ?? address?.city) as string | undefined;
    const state = (pin?.state ?? address?.state) as string | undefined;
    const pincode = (pin?.pincode ?? address?.pincode) as string | undefined;
    const storeId = (groceries?.uid ?? delivery?.store_ids) as string | number | undefined;
    const storeCode = (groceries?.code ?? delivery?.store_code) as string | undefined;
    const deliveryMessage = deliveryPromise?.message as string | undefined;
    const detectedName = [city, state, pincode].filter(Boolean).join(', ');

    return {
        locationName: detectedName || requestedLocationName,
        city: city ?? null,
        state: state ?? null,
        pincode: pincode ?? null,
        storeId: storeId === undefined || storeId === null ? null : String(storeId),
        storeCode: storeCode ?? null,
        deliveryMessage: deliveryMessage ?? null,
    };
};

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    headless: false,
    maxConcurrency: 1,
    minConcurrency: 1,
    maxRequestRetries: 3,
    maxSessionRotations: 3,
    retryOnBlocked: true,
    navigationTimeoutSecs: 90,
    requestHandlerTimeoutSecs: 300,
    maxRequestsPerCrawl: requests.length,
    sessionPoolOptions: {
        maxPoolSize: 30,
        blockedStatusCodes: [],
        sessionOptions: { maxUsageCount: 10 },
    },
    browserPoolOptions: { useFingerprints: true },
    launchContext: {
        useChrome: true,
        launchOptions: {
            args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'],
        },
    },
    preNavigationHooks: [async ({ page }, gotoOptions) => {
        await page.context().grantPermissions(['geolocation'], { origin: 'https://www.jiomart.com' });
        await page.context().setGeolocation({ latitude, longitude });
        await page.setExtraHTTPHeaders({
            'accept-language': 'en-IN,en;q=0.9',
        });
        page.setDefaultTimeout(15_000);
        if (gotoOptions) gotoOptions.waitUntil = 'domcontentloaded';
        await page.waitForTimeout(1_000 + Math.floor(Math.random() * 2_000));
    }],
    requestHandler: async ({ page, request, session }) => {
        if (fatalBillingError) throw fatalBillingError;
        if (savedCount >= maxResults || spendingLimitReached) return;

        const { searchQuery } = request.userData as RequestData;
        const payloads: CapturedPayload[] = [];
        const responseTasks = new Set<Promise<void>>();

        const responseHandler = (response: any): void => {
            const url = response.url();
            if (response.status() !== 200 || !url.includes('/ext/vertex/application/api/v1.0/products')) return;
            const task = response.json()
                .then((json: unknown) => { payloads.push({ url, json }); })
                .catch(() => undefined)
                .finally(() => { responseTasks.delete(task); });
            responseTasks.add(task);
        };

        page.on('response', responseHandler);
        await page.waitForLoadState('domcontentloaded', { timeout: 90_000 }).catch(() => undefined);
        await page.waitForTimeout(3_000);

        let title = await page.title();
        let body = await page.locator('body').innerText().catch(() => '');
        if (isBlockedPage(title, body)) {
            session?.markBad();
            throw new Error(`JioMart challenge page detected for ${request.url}`);
        }

        const searchInput = page.locator('input[placeholder*="Search"], input[type="text"]').first();
        if (await searchInput.count()) {
            await searchInput.fill(searchQuery);
            await Promise.all([
                page.waitForURL(/\/products\?q=/, { timeout: 30_000 }).catch(() => undefined),
                searchInput.press('Enter'),
            ]);
        }

        await page.waitForTimeout(6_000);

        if (payloads.length === 0) {
            await page.goto(buildProductsUrl(searchQuery), { waitUntil: 'domcontentloaded', timeout: 90_000 });
            await page.waitForTimeout(6_000);
        }

        let idleRounds = 0;
        for (let round = 0; round < maxPagesPerQuery * 3 && payloads.length < maxPagesPerQuery; round += 1) {
            const before = payloads.length;
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(1_500 + Math.floor(Math.random() * 1_500));
            idleRounds = payloads.length === before ? idleRounds + 1 : 0;
            if (idleRounds >= 3) break;
        }

        await Promise.allSettled([...responseTasks]);
        page.off('response', responseHandler);

        title = await page.title();
        body = await page.locator('body').innerText().catch(() => '');
        if (isBlockedPage(title, body)) {
            session?.markBad();
            throw new Error(`JioMart challenge page detected after search for "${searchQuery}".`);
        }

        const location = await readLocationSnapshot(page);
        const products = extractProducts(payloads.slice(0, maxPagesPerQuery), searchQuery, location);
        if (products.length === 0) {
            session?.markBad();
            throw new Error(`No JioMart product records found for "${searchQuery}".`);
        }

        for (const product of products) {
            if (savedCount >= maxResults || spendingLimitReached) break;
            const seenKey = product.productId ?? product.productUrl ?? `${product.source}:${product.searchQuery}:${product.position}:${product.title}`;
            if (seenProductKeys.has(seenKey)) continue;
            if (brands.size > 0 && product.brand !== 'N/A' && !brands.has(product.brand.toLowerCase())) continue;
            const categoryText = product.category === 'N/A' ? '' : product.category.toLowerCase();
            if (categories.size > 0 && ![...categories].some((category) => categoryText.includes(category))) continue;
            if (inStockOnly && !product.inStock) continue;
            if (product.price === null || product.price < minPrice || product.price > maxPrice) continue;

            try {
                const chargeResult = await Actor.pushData(product, 'product-scraped');
                const recordWasSaved = chargeResult.chargedCount > 0 || !chargeResult.eventChargeLimitReached;

                if (recordWasSaved) {
                    seenProductKeys.add(seenKey);
                    savedCount += 1;
                }

                if (chargeResult.eventChargeLimitReached) {
                    spendingLimitReached = true;
                    await Actor.setStatusMessage(`Stopped at the user's spending limit after ${savedCount} products`);
                    log.info('User spending limit reached; stopping before more requests are made.');
                    await crawler.autoscaledPool?.abort();
                    break;
                }
            } catch (error) {
                fatalBillingError = error instanceof Error ? error : new Error(String(error));
                spendingLimitReached = true;
                await Actor.setStatusMessage('Stopped because product output billing failed.');
                log.error('Stopping JioMart run because dataset push with product-scraped charge failed.', {
                    error: fatalBillingError.message,
                });
                await crawler.autoscaledPool?.abort();
                throw fatalBillingError;
            }
        }

        log.info(`Processed JioMart search "${searchQuery}"`, {
            payloadsCaptured: payloads.length,
            productsFound: products.length,
            totalSaved: savedCount,
            location,
        });
        if (!spendingLimitReached) {
            await Actor.setStatusMessage(`Saved ${savedCount}/${maxResults} JioMart products`);
        }
    },
    failedRequestHandler: async ({ request }, error) => {
        failedRequestCount += 1;
        log.error(`JioMart request failed after retries: ${request.url}`, { error: String(error) });
    },
});

await crawler.run(requests);
if (fatalBillingError) throw fatalBillingError;
if (savedCount === 0 && failedRequestCount > 0) {
    throw new Error(`JioMart scrape failed: ${failedRequestCount} request(s) failed and no products were saved.`);
}
if (savedCount === 0 && !spendingLimitReached) {
    throw new Error('JioMart scrape finished with zero products saved. The source may be blocked, empty, or filtered out.');
}
if (!spendingLimitReached) await Actor.setStatusMessage(`Finished with ${savedCount} unique products`);
log.info(`JioMart scrape finished with ${savedCount} unique products.`);

await Actor.exit();
