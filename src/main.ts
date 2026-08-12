import { Actor, log } from 'apify';
import { fetchProductsPage } from './jiomartApi.js';
import { normalizeInput } from './input.js';
import { countRelevantProductPayloads, extractProducts, isBlockedPage } from './routes.js';
import type { ActorInput, CapturedPayload, LocationSnapshot, ProductRecord } from './types.js';

await Actor.init();

const input = (await Actor.getInput<ActorInput>()) ?? {};
const normalizedInput = normalizeInput(input);
const {
    searchQueries,
    locationName,
    pincode,
    state,
    inStockOnly,
    minPrice,
    maxPrice,
    maxResults,
    maxPagesPerQuery,
} = normalizedInput;
const brands = new Set(normalizedInput.brands.map((value) => value.toLowerCase()));
const categories = new Set(normalizedInput.categories.map((value) => value.toLowerCase()));

const proxyConfiguration = await Actor.createProxyConfiguration(normalizedInput.proxyConfiguration);

/** Kept for the record shape; JioMart resolves the catalogue from the pincode alone. */
const location: LocationSnapshot = {
    locationName,
    city: locationName,
    state: state ?? null,
    pincode,
    storeId: null,
    storeCode: null,
    deliveryMessage: null,
};

const seenProductKeys = new Set<string>();
let savedCount = 0;
let spendingLimitReached = false;
let fatalBillingError: Error | null = null;
const skippedQueries: Array<{ query: string; reason: string }> = [];

log.info('Starting JioMart scrape', {
    searchQueries,
    locationName,
    pincode,
    maxResults,
    maxPagesPerQuery,
});

/** Collects catalogue pages for one query, stopping once enough products are available. */
async function collectPayloads(query: string, queryIndex: number, remaining: number): Promise<CapturedPayload[]> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const payloads: CapturedPayload[] = [];
        try {
            const proxyUrl = await proxyConfiguration?.newUrl(`jiomart_${queryIndex}_${attempt}`);

            for (let pageNo = 1; pageNo <= maxPagesPerQuery; pageNo += 1) {
                const page = await fetchProductsPage({
                    query,
                    pageNo,
                    proxyUrl,
                    pincode,
                    city: locationName,
                    state,
                });

                if (page.statusCode >= 400) {
                    if (pageNo === 1) throw new Error(`JioMart products API returned HTTP ${page.statusCode}`);
                    log.warning(`Stopping "${query}" at page ${pageNo}: HTTP ${page.statusCode}`);
                    break;
                }
                if (isBlockedPage('', page.bodyText)) {
                    throw new Error('JioMart products API returned a challenge response');
                }
                if (!page.payload) {
                    if (pageNo === 1) throw new Error('JioMart products API returned an unreadable response');
                    break;
                }

                const before = extractProducts(payloads, query, location).length;
                payloads.push(page.payload);
                const after = extractProducts(payloads, query, location).length;

                // No new products means the catalogue is exhausted for this query.
                if (after === before) break;
                if (after >= remaining) break;
            }

            if (countRelevantProductPayloads(payloads, query) === 0) {
                throw new Error(`JioMart returned no products relevant to "${query}"`);
            }
            return payloads;
        } catch (error) {
            lastError = error;
            log.warning(`JioMart attempt ${attempt}/3 failed for "${query}"`, { error: String(error) });
            if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
        }
    }

    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    skippedQueries.push({ query, reason });
    log.warning(`Skipping "${query}" after repeated failures`, { reason });
    return [];
}

for (const [queryIndex, searchQuery] of searchQueries.entries()) {
    if (savedCount >= maxResults || spendingLimitReached || fatalBillingError) break;

    const payloads = await collectPayloads(searchQuery, queryIndex, maxResults - savedCount);
    if (payloads.length === 0) continue;

    const products: ProductRecord[] = extractProducts(payloads, searchQuery, location);
    log.info(`Parsed JioMart search "${searchQuery}"`, {
        pagesFetched: payloads.length,
        productsFound: products.length,
    });

    for (const product of products) {
        if (savedCount >= maxResults || spendingLimitReached) break;

        const seenKey = product.productId ?? product.productUrl
            ?? `${product.source}:${product.searchQuery}:${product.position}:${product.title}`;
        if (seenProductKeys.has(seenKey)) continue;
        if (brands.size > 0 && product.brand !== 'N/A' && !brands.has(product.brand.toLowerCase())) continue;
        const categoryText = product.category === 'N/A' ? '' : product.category.toLowerCase();
        if (categories.size > 0 && ![...categories].some((category) => categoryText.includes(category))) continue;
        if (inStockOnly && !product.inStock) continue;
        if (product.price === null || product.price < minPrice || product.price > maxPrice) continue;

        try {
            // Push and charge atomically so records beyond the user's charge limit are not
            // saved for free and billing failures stop the run immediately.
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
                break;
            }
        } catch (error) {
            fatalBillingError = error instanceof Error ? error : new Error(String(error));
            spendingLimitReached = true;
            await Actor.setStatusMessage('Stopped because product output billing failed.');
            log.error('Stopping JioMart run because dataset push with product-scraped charge failed.', {
                error: fatalBillingError.message,
            });
            break;
        }
    }

    if (!spendingLimitReached && !fatalBillingError) {
        await Actor.setStatusMessage(`Saved ${savedCount}/${maxResults} JioMart products`);
        const moreQueriesLeft = queryIndex < searchQueries.length - 1;
        if (moreQueriesLeft && savedCount < maxResults) {
            await new Promise((resolve) => setTimeout(resolve, 400 + Math.floor(Math.random() * 600)));
        }
    }
}

if (fatalBillingError) throw fatalBillingError;

if (savedCount === 0 && !spendingLimitReached) {
    const reasons = skippedQueries.map((item) => `${item.query}: ${item.reason}`).join('; ');
    throw new Error(`JioMart scrape finished with zero products saved.${reasons ? ` Skipped: ${reasons}` : ''} The source may be blocked, empty, or filtered out.`);
}

if (skippedQueries.length > 0) log.warning('Some JioMart queries were skipped', { skippedQueries });
if (!spendingLimitReached) await Actor.setStatusMessage(`Finished with ${savedCount} unique products`);
log.info(`JioMart scrape finished with ${savedCount} unique products.`);

await Actor.exit();
