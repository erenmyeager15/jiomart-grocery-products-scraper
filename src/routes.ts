import type { CapturedPayload, LocationSnapshot, ProductRecord } from './types.js';

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const asObject = (value: unknown): JsonObject | null => (isObject(value) ? value : null);

const asString = (value: unknown): string | null => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);

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

const parseIntegerString = (value: unknown): number | null => {
    const parsed = asNumber(value);
    return parsed === null ? null : Math.round(parsed);
};

const getPath = (value: unknown, path: string[]): unknown => {
    let current: unknown = value;
    for (const key of path) {
        if (!isObject(current)) return undefined;
        current = current[key];
    }
    return current;
};

const normalizeUrl = (url: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://www.jiomart.com${url.startsWith('/') ? '' : '/'}${url}`;
};

const parseDiscountPercent = (value: unknown, currentPrice: number, marketPrice: number | null): number | null => {
    const direct = asNumber(value);
    if (direct !== null) return Math.round(direct);
    if (marketPrice !== null && marketPrice > currentPrice && marketPrice > 0) {
        return Math.round(((marketPrice - currentPrice) / marketPrice) * 100);
    }
    return null;
};

const parseVariantsCount = (item: JsonObject): number | null => {
    const instockItemIds = getPath(item, ['instock_variants', 'item_id']);
    if (Array.isArray(instockItemIds)) return instockItemIds.length;
    const sizes = item.sizes;
    if (Array.isArray(sizes)) return sizes.length;
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

const extractStoreIdFromUrl = (url: string): string | null => {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/store_ids:([0-9]+)/);
    return match?.[1] ?? null;
};

const isProductItem = (value: JsonObject): boolean => (
    value.type === 'product'
    && (asString(value.name) !== null)
    && asNumber(getPath(value, ['price', 'effective', 'min'])) !== null
);

export const buildHomeUrl = (query: string): string => (
    `https://www.jiomart.com/?search=${encodeURIComponent(query)}`
);

export const buildProductsUrl = (query: string): string => (
    `https://www.jiomart.com/products?q=${encodeURIComponent(query)}`
);

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
    let position = 0;

    for (const payload of payloads) {
        const root = asObject(payload.json);
        const items = Array.isArray(root?.items) ? root.items : [];
        const payloadStoreId = extractStoreIdFromUrl(payload.url);

        for (const rawItem of items) {
            if (!isObject(rawItem) || !isProductItem(rawItem)) continue;

            const productId = String(rawItem.uid ?? rawItem.sku_code ?? rawItem.item_code);
            if (products.has(productId)) continue;

            const productName = asString(rawItem.name);
            const currentPrice = asNumber(getPath(rawItem, ['price', 'effective', 'min']));
            if (!productName || currentPrice === null) continue;

            const marketPrice = asNumber(getPath(rawItem, ['price', 'marked', 'min']));
            const savingsAmount = marketPrice !== null && marketPrice > currentPrice
                ? Number((marketPrice - currentPrice).toFixed(2))
                : null;
            const brand = asString(getPath(rawItem, ['brand', 'name']));
            const hierarchy = asObject(rawItem.hierarchy);
            const l1 = asObject(hierarchy?.l1_category);
            const l2 = asObject(hierarchy?.l2_category);
            const l3 = asObject(hierarchy?.l3_category);
            const department = asObject(hierarchy?.department);
            const attributes = asObject(rawItem.attributes);
            const medias = Array.isArray(rawItem.medias) ? rawItem.medias : [];
            const firstMedia = asObject(medias[0]);
            const slug = asString(rawItem.slug);
            const productUrl = normalizeUrl(slug ? `/p/${slug}` : null) ?? 'https://www.jiomart.com/';
            const sellable = typeof rawItem.sellable === 'boolean' ? rawItem.sellable : null;
            const stockVariantIds = getPath(rawItem, ['instock_variants', 'item_id']);
            const inStock = sellable !== false && (!Array.isArray(stockVariantIds) || stockVariantIds.length > 0);

            position += 1;
            products.set(productId, {
                source: 'jiomart',
                searchQuery,
                locationName: location.locationName,
                city: location.city,
                state: location.state,
                pincode: location.pincode,
                storeId: location.storeId ?? payloadStoreId,
                storeCode: location.storeCode,
                position,
                productId,
                skuCode: asString(rawItem.sku_code) ?? asString(rawItem.item_code),
                productName,
                brand,
                packSize: extractPackSize(rawItem, attributes, productName),
                currentPrice,
                marketPrice,
                discountPercent: parseDiscountPercent(rawItem.discount, currentPrice, marketPrice),
                savingsAmount,
                currency: asString(getPath(rawItem, ['price', 'currency_code'])) ?? 'INR',
                inStock,
                sellable,
                minOrderQuantity: asNumber(getPath(rawItem, ['moq', 'minimum'])),
                maxQuantityInOrder: parseIntegerString(attributes?.['max-qty-in-order']),
                category: asString(l1?.name) ?? firstString(attributes?.['l1-category']),
                subcategory: asString(l2?.name) ?? firstString(attributes?.['l2-category']),
                leafCategory: asString(l3?.name) ?? firstString(attributes?.['l3-category']),
                department: asString(department?.name),
                countryOfOrigin: asString(rawItem.country_of_origin),
                journey: asString(rawItem.journey),
                sellerId: rawItem.seller_id === undefined || rawItem.seller_id === null ? null : String(rawItem.seller_id),
                rating: asNumber(rawItem.rating),
                ratingBucket: asString(rawItem.rating_bucket),
                variantsCount: parseVariantsCount(rawItem),
                imageUrl: normalizeUrl(asString(firstMedia?.url)),
                productUrl,
                deliveryMessage: location.deliveryMessage,
                scrapedAt: new Date().toISOString(),
            });
        }
    }

    return [...products.values()];
};
