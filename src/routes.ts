import type { CapturedPayload, LocationSnapshot, ProductRecord } from './types.js';

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const asObject = (value: unknown): JsonObject | null => (isObject(value) ? value : null);

const asString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const cleaned = value.replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned.toLowerCase() === 'proxied content') return null;
    return cleaned;
};

const textOrNA = (value: unknown): string => asString(value) ?? 'N/A';

const asNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]/g, '');
        if (!cleaned || cleaned === '-' || cleaned === '.') return null;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const firstString = (value: unknown): string | null => {
    if (Array.isArray(value)) return asString(value[0]);
    return asString(value);
};

const getPath = (value: unknown, path: string[]): unknown => {
    let current: unknown = value;
    for (const key of path) {
        if (!isObject(current)) return undefined;
        current = current[key];
    }
    return current;
};

/** Returns the first finite number found across the given candidate paths. */
const pickNumber = (item: JsonObject, paths: string[][]): number | null => {
    for (const path of paths) {
        const found = asNumber(getPath(item, path));
        if (found !== null) return found;
    }
    return null;
};

/** Returns the first non-empty string found across the given candidate paths. */
const pickString = (item: JsonObject, paths: string[][]): string | null => {
    for (const path of paths) {
        const found = asString(getPath(item, path));
        if (found !== null) return found;
    }
    return null;
};

const normalizeUrl = (url: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`;
    if (url.startsWith('https://')) return url;
    return `https://www.jiomart.com${url.startsWith('/') ? '' : '/'}${url}`;
};

// ---------------------------------------------------------------------------
// Tolerant field resolvers. JioMart shifts its internal payload shape between
// builds, so each field is resolved from the known path first, then fallbacks.
// Every resolver only returns REAL values (or null) - nothing is fabricated.
// ---------------------------------------------------------------------------
const PRICE_PATHS: string[][] = [
    ['price', 'effective', 'min'],
    ['price', 'effective'],
    ['price', 'selling', 'min'],
    ['price', 'selling'],
    ['price', 'min'],
    ['sellingPrice'],
    ['selling_price'],
    ['sale_price'],
    ['final_price'],
    ['effective_price'],
    ['price'],
];

const MARKET_PRICE_PATHS: string[][] = [
    ['price', 'marked', 'min'],
    ['price', 'marked'],
    ['mrp'],
    ['marked_price'],
    ['price', 'max'],
];

const NAME_PATHS: string[][] = [['name'], ['title'], ['product_name'], ['product', 'name']];

const resolvePrice = (item: JsonObject): number | null => pickNumber(item, PRICE_PATHS);
const resolveMarketPrice = (item: JsonObject): number | null => pickNumber(item, MARKET_PRICE_PATHS);
const resolveName = (item: JsonObject): string | null => pickString(item, NAME_PATHS);

const resolveBrand = (item: JsonObject): string | null => (
    pickString(item, [['brand', 'name'], ['brand'], ['brand_name']])
);

const resolveSlug = (item: JsonObject): string | null => (
    pickString(item, [['slug'], ['seo', 'slug'], ['url_key']])
);

const resolveProductUrl = (item: JsonObject, slug: string | null): string | null => {
    if (slug) return normalizeUrl(`/p/${slug}`);
    return normalizeUrl(pickString(item, [['url'], ['product_url'], ['action', 'url']]));
};

const resolveImageUrl = (item: JsonObject): string | null => {
    const medias = Array.isArray(item.medias) ? item.medias : [];
    const firstMedia = asObject(medias[0]);
    const fromMedia = asString(firstMedia?.url);
    if (fromMedia) return normalizeUrl(fromMedia);

    const images = Array.isArray(item.images) ? item.images : [];
    const firstImage = images[0];
    const fromImages = isObject(firstImage) ? asString(firstImage.url) : asString(firstImage);
    if (fromImages) return normalizeUrl(fromImages);

    return normalizeUrl(pickString(item, [['image'], ['image_url'], ['imageUrl']]));
};

const resolveCategory = (item: JsonObject): string | null => {
    const l1 = asObject(getPath(item, ['hierarchy', 'l1_category']));
    const attributes = asObject(item.attributes);
    return asString(l1?.name)
        ?? firstString(attributes?.['l1-category'])
        ?? pickString(item, [['category'], ['category_name'], ['l1_category']]);
};

const resolveRating = (item: JsonObject): number | null => (
    pickNumber(item, [['rating'], ['rating', 'average'], ['avg_rating'], ['ratings', 'average']])
);

const resolveInStock = (item: JsonObject): boolean | null => {
    const sellableRaw = item.sellable ?? item.in_stock ?? item.available ?? item.is_available;
    const sellable = typeof sellableRaw === 'boolean' ? sellableRaw : null;
    const stockVariantIds = getPath(item, ['instock_variants', 'item_id']);
    return sellable !== false && (!Array.isArray(stockVariantIds) || stockVariantIds.length > 0);
};

const resolveProductId = (item: JsonObject, name: string, price: number, slug: string | null): string => {
    const rawProductId = item.uid ?? item.sku_code ?? item.item_code ?? item.id ?? item.product_id ?? item.product_code;
    return (
        (typeof rawProductId === 'string' && rawProductId.trim())
        || (typeof rawProductId === 'number' && Number.isFinite(rawProductId) ? String(rawProductId) : null)
        || (slug ? `slug:${slug}` : null)
        || `fallback:${name.toLowerCase().replace(/\s+/g, '-')}:${price}`
    );
};

const hasIdSignal = (item: JsonObject): boolean => (
    item.uid !== undefined
    || item.sku_code !== undefined
    || item.item_code !== undefined
    || item.id !== undefined
    || item.product_id !== undefined
    || item.product_code !== undefined
    || asString(item.slug) !== null
    || item.type === 'product'
);

/** A candidate is a product only if it has a real name, a real price, and a product identity. */
const isProductItem = (value: JsonObject): boolean => (
    resolveName(value) !== null && resolvePrice(value) !== null && hasIdSignal(value)
);

// ---------------------------------------------------------------------------
// Container discovery: JioMart nests the product array under different keys
// across builds, so search the known keys, then shallow-scan for an array of
// product-like objects.
// ---------------------------------------------------------------------------
const CONTAINER_PATHS: string[][] = [
    ['items'],
    ['data', 'items'],
    ['products'],
    ['data', 'products'],
    ['results'],
    ['data', 'results'],
    ['response', 'items'],
    ['catalog', 'items'],
    ['data', 'catalog', 'items'],
];

const looksLikeProductArray = (value: unknown): value is unknown[] => (
    Array.isArray(value) && value.some((entry) => isObject(entry) && isProductItem(entry))
);

const searchForProductArray = (node: unknown, depth: number): unknown[] | null => {
    if (depth > 4) return null;
    if (looksLikeProductArray(node)) return node;
    if (Array.isArray(node)) {
        for (const entry of node) {
            const found = searchForProductArray(entry, depth + 1);
            if (found) return found;
        }
        return null;
    }
    if (isObject(node)) {
        for (const entry of Object.values(node)) {
            const found = searchForProductArray(entry, depth + 1);
            if (found) return found;
        }
    }
    return null;
};

const findItemsArray = (root: JsonObject | null): unknown[] => {
    if (!root) return [];
    for (const path of CONTAINER_PATHS) {
        const candidate = getPath(root, path);
        if (looksLikeProductArray(candidate)) return candidate;
    }
    return searchForProductArray(root, 0) ?? [];
};

const QUERY_STOP_WORDS = new Set(['and', 'for', 'from', 'online', 'pack', 'product', 'products', 'the', 'with']);

const normalizeMatchText = (value: string): string => value
    .toLowerCase()
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildQueryTokens = (query: string): string[] => (
    [...new Set(normalizeMatchText(query).split(' '))]
        .filter((token) => token.length >= 2 && !QUERY_STOP_WORDS.has(token))
);

const tokenMatchesWords = (token: string, words: Set<string>): boolean => {
    if (words.has(token)) return true;
    const singularToken = token.endsWith('s') && token.length > 3 ? token.slice(0, -1) : token;
    if (words.has(singularToken)) return true;
    return [...words].some((word) => word.endsWith('s') && word.length > 3 && word.slice(0, -1) === singularToken);
};

const matchesProductQuery = (item: JsonObject, queryTokens: string[]): boolean => {
    if (queryTokens.length === 0) return true;
    const searchable = [resolveName(item), resolveBrand(item), resolveCategory(item), resolveSlug(item)]
        .filter((value): value is string => Boolean(value))
        .join(' ');
    const words = new Set(normalizeMatchText(searchable).split(' ').filter(Boolean));
    return queryTokens.some((token) => tokenMatchesWords(token, words));
};

export const countRelevantProductPayloads = (payloads: CapturedPayload[], searchQuery: string): number => {
    const queryTokens = buildQueryTokens(searchQuery);
    return payloads.reduce((count, payload) => {
        const items = findItemsArray(asObject(payload.json));
        return count + (items.some((item) => isObject(item) && isProductItem(item) && matchesProductQuery(item, queryTokens)) ? 1 : 0);
    }, 0);
};

const parseDiscountPercent = (value: unknown, currentPrice: number, marketPrice: number | null): number | null => {
    const direct = asNumber(value);
    if (direct !== null) return Math.round(direct);
    if (marketPrice !== null && marketPrice > currentPrice && marketPrice > 0) {
        return Math.round(((marketPrice - currentPrice) / marketPrice) * 100);
    }
    return null;
};

const isPlaceholderPackSize = (value: string | null): boolean => (
    value === null || ['os', 'one size', 'one-size', 'na', 'n/a'].includes(value.toLowerCase())
);

const extractPackSizeFromTitle = (title: string): string | null => {
    const match = title.match(/(?:^|[^0-9.])(\d+(?:\.\d+)?\s*(?:kg|kgs|g|gm|gram|grams|ml|l|ltr|litre|litres|liter|liters|pcs|pc|pieces|pack|packs)\b)/i);
    if (!match) return null;
    return match[1]
        .replace(/\s+/g, ' ')
        .replace(/(\d(?:\.\d+)?)\s*([A-Za-z]+)/, '$1 $2')
        .replace(/\bkgs?\b/i, 'kg')
        .replace(/\bgm\b/i, 'g')
        .replace(/\bgrams?\b/i, 'g')
        .replace(/\bml\b/i, 'ml')
        .replace(/\b(?:l|ltr|litres?|liters?)\b/i, 'L')
        .replace(/\b(?:pc|pcs|pieces)\b/i, 'pcs')
        .trim();
};

const extractPackSize = (item: JsonObject, attributes: JsonObject | null, productName: string): string | null => {
    const structuredSize = firstString(attributes?.['product-size']) ?? firstString(item.sizes);
    if (!isPlaceholderPackSize(structuredSize)) return structuredSize;
    return extractPackSizeFromTitle(productName) ?? structuredSize;
};

export const buildHomeUrl = (query: string): string => (
    `https://www.jiomart.com/?search=${encodeURIComponent(query)}`
);

export const buildProductsUrl = (query: string): string => (
    `https://www.jiomart.com/products?q=${encodeURIComponent(query)}`
);

/**
 * Matches JioMart product JSON API responses while tolerating path/version
 * drift (e.g. api version bumps or renamed segments). Excludes the HTML
 * `/products?q=` navigation page, which contains "product" but no API segment.
 */
export const isProductsApiUrl = (url: string): boolean => {
    const lower = url.toLowerCase();
    if (!lower.includes('product')) return false;
    return lower.includes('/api/')
        || lower.includes('/vertex/')
        || lower.includes('/catalog')
        || lower.includes('/mst/');
};

export const isBlockedPage = (title: string, body: string): boolean => {
    const text = `${title}\n${body}`.toLowerCase();
    return [
        'access denied',
        'request blocked',
        'verify you are human',
        'just a moment',
        'captcha',
    ].some((marker) => text.includes(marker));
};

export const extractProducts = (
    payloads: CapturedPayload[],
    searchQuery: string,
    location: LocationSnapshot,
): ProductRecord[] => {
    const products = new Map<string, ProductRecord>();
    const queryTokens = buildQueryTokens(searchQuery);
    let position = 0;

    for (const payload of payloads) {
        const root = asObject(payload.json);
        const items = findItemsArray(root);
        for (const rawItem of items) {
            if (!isObject(rawItem) || !isProductItem(rawItem) || !matchesProductQuery(rawItem, queryTokens)) continue;

            const productName = resolveName(rawItem);
            const currentPrice = resolvePrice(rawItem);
            if (!productName || currentPrice === null) continue;

            const slug = resolveSlug(rawItem);
            const productId = resolveProductId(rawItem, productName, currentPrice, slug);
            if (products.has(productId)) continue;

            const marketPrice = resolveMarketPrice(rawItem);
            const attributes = asObject(rawItem.attributes);

            position += 1;
            products.set(productId, {
                source: 'jiomart',
                searchQuery: textOrNA(searchQuery),
                position,
                productId,
                title: productName,
                brand: textOrNA(resolveBrand(rawItem)),
                price: currentPrice,
                mrp: marketPrice,
                discountPercent: parseDiscountPercent(rawItem.discount, currentPrice, marketPrice),
                currency: asString(getPath(rawItem, ['price', 'currency_code'])) ?? asString(rawItem.currency) ?? 'INR',
                packSize: textOrNA(extractPackSize(rawItem, attributes, productName)),
                category: textOrNA(resolveCategory(rawItem)),
                rating: resolveRating(rawItem),
                ratingCount: null,
                inStock: resolveInStock(rawItem),
                productUrl: resolveProductUrl(rawItem, slug),
                imageUrl: resolveImageUrl(rawItem),
                scrapedAt: new Date().toISOString(),
            });
        }
    }

    return [...products.values()];
};
