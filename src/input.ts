import type { ActorInput, ProxyInput } from './types.js';

export interface NormalizedInput {
    searchQueries: string[];
    locationName: string;
    latitude: number;
    longitude: number;
    pincode: string;
    state: string | null;
    brands: string[];
    categories: string[];
    inStockOnly: boolean;
    minPrice: number;
    maxPrice: number;
    maxResults: number;
    maxPagesPerQuery: number;
    proxyConfiguration: ProxyInput;
}

const DEFAULT_PROXY_CONFIGURATION: ProxyInput = {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    apifyProxyCountry: 'IN',
};

function fail(message: string, field?: string): never {
    throw new Error(field ? `Field "${field}": ${message}` : message);
}

function asString(value: unknown, fieldName: string, defaultValue: string): string {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value !== 'string') fail('must be a string.', fieldName);
    const trimmed = value.trim();
    if (!trimmed) fail('must not be empty.', fieldName);
    return trimmed;
}

function asStringArray(value: unknown, fieldName: string, defaultValue: string[], minItems: number, maxItems: number): string[] {
    if (value === undefined || value === null) return [...defaultValue];
    if (!Array.isArray(value)) fail('must be an array of strings.', fieldName);

    const result = value.map((item) => {
        if (typeof item !== 'string') fail('all items must be strings.', fieldName);
        const trimmed = item.trim();
        if (!trimmed) fail('items must not be empty.', fieldName);
        return trimmed;
    });

    if (result.length < minItems) fail(`must contain at least ${minItems} item(s).`, fieldName);
    if (result.length > maxItems) fail(`must contain at most ${maxItems} items.`, fieldName);
    return [...new Set(result)];
}

function asNumberInRange(value: unknown, fieldName: string, defaultValue: number, min: number, max: number): number {
    if (value === undefined || value === null || value === '') return defaultValue;
    const parsed = typeof value === 'string' ? Number(value) : value;
    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) fail('must be a number.', fieldName);
    if (parsed < min || parsed > max) fail(`must be between ${min} and ${max}.`, fieldName);
    return parsed;
}

function asIntInRange(value: unknown, fieldName: string, defaultValue: number, min: number, max: number): number {
    const parsed = asNumberInRange(value, fieldName, defaultValue, min, max);
    if (!Number.isInteger(parsed)) fail('must be an integer.', fieldName);
    return parsed;
}

function asBoolean(value: unknown, fieldName: string, defaultValue: boolean): boolean {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    fail('must be a boolean.', fieldName);
}

function asPincode(value: unknown): string {
    if (value === undefined || value === null || value === '') return '400001';
    const text = typeof value === 'number' ? String(value) : value;
    if (typeof text !== 'string') fail('must be a 6-digit Indian pincode.', 'pincode');
    const trimmed = text.trim();
    if (!/^[1-9][0-9]{5}$/.test(trimmed)) fail('must be a 6-digit Indian pincode.', 'pincode');
    return trimmed;
}

function asProxyConfiguration(value: unknown): ProxyInput {
    if (value === undefined || value === null || value === '') return { ...DEFAULT_PROXY_CONFIGURATION };
    if (typeof value !== 'object' || Array.isArray(value)) fail('must be a proxy configuration object.', 'proxyConfiguration');
    return value as ProxyInput;
}

export function normalizeInput(raw: ActorInput = {}): NormalizedInput {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Input must be a JSON object.');

    const minPrice = asNumberInRange(raw.minPrice, 'minPrice', 0, 0, 1_000_000);
    const maxPrice = asNumberInRange(raw.maxPrice, 'maxPrice', 1_000_000, 0, 1_000_000);
    if (maxPrice < minPrice) fail('must be greater than or equal to minPrice.', 'maxPrice');

    return {
        searchQueries: asStringArray(raw.searchQueries, 'searchQueries', ['rice'], 1, 5),
        locationName: asString(raw.locationName, 'locationName', 'Mumbai'),
        latitude: asNumberInRange(raw.latitude, 'latitude', 19.076, -90, 90),
        longitude: asNumberInRange(raw.longitude, 'longitude', 72.8777, -180, 180),
        // JioMart resolves the serving catalogue from the pincode, so this is what
        // actually controls regional prices and stock.
        pincode: asPincode(raw.pincode),
        state: raw.state === undefined || raw.state === null || raw.state === ''
            ? null
            : asString(raw.state, 'state', ''),
        brands: asStringArray(raw.brands, 'brands', [], 0, 20),
        categories: asStringArray(raw.categories, 'categories', [], 0, 20),
        inStockOnly: asBoolean(raw.inStockOnly, 'inStockOnly', true),
        minPrice,
        maxPrice,
        // Defaults return a useful page of results. A one-product run costs about the same
        // to produce as fifty, so a tiny default bills far less than it costs to serve.
        maxResults: asIntInRange(raw.maxResults, 'maxResults', 50, 1, 500),
        maxPagesPerQuery: asIntInRange(raw.maxPagesPerQuery, 'maxPagesPerQuery', 3, 1, 40),
        proxyConfiguration: asProxyConfiguration(raw.proxyConfiguration),
    };
}
