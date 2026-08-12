import { gotScraping } from 'got-scraping';
import type { CapturedPayload } from './types.js';

const BASE_URL = 'https://www.jiomart.com';
const PRODUCTS_PATH = '/ext/vertex/application/api/v1.0/products';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT_MS = 60_000;

/** JioMart's catalogue endpoint returns twenty products per page. */
export const PAGE_SIZE = 20;

export interface LocationInput {
    pincode: string;
    city?: string | null;
    state?: string | null;
}

export interface FetchPageOptions extends LocationInput {
    query: string;
    pageNo: number;
    proxyUrl?: string;
}

export interface FetchPageResult {
    payload: CapturedPayload | null;
    statusCode: number;
    bodyText: string;
}

/**
 * JioMart resolves the serving catalogue from this header, not from cookies or
 * geolocation. The pincode is the only field it acts on; city and state are sent for
 * fidelity but are ignored by the API.
 */
export function buildLocationHeader(location: LocationInput): string {
    return JSON.stringify({
        country: 'INDIA',
        country_iso_code: 'IN',
        city: (location.city ?? '').toUpperCase() || undefined,
        pincode: location.pincode,
        state: (location.state ?? '').toUpperCase() || undefined,
    });
}

export function buildProductsEndpoint(query: string, pageNo: number): string {
    const endpoint = new URL(PRODUCTS_PATH, BASE_URL);
    endpoint.searchParams.set('q', query);
    endpoint.searchParams.set('page_no', String(pageNo));
    endpoint.searchParams.set('page_size', String(PAGE_SIZE));
    return endpoint.toString();
}

export function buildSearchReferer(query: string): string {
    return `${BASE_URL}/search/${encodeURIComponent(query)}`;
}

/**
 * Requests one catalogue page over plain HTTP. No browser, cookie warm-up, bearer token
 * or request signature is required: the public endpoint answers on the location header
 * alone, which keeps a run to a few tens of kilobytes.
 */
export async function fetchProductsPage(options: FetchPageOptions): Promise<FetchPageResult> {
    const { query, pageNo, proxyUrl, ...location } = options;
    const url = buildProductsEndpoint(query, pageNo);

    const response = await gotScraping({
        url,
        proxyUrl,
        headers: {
            'user-agent': USER_AGENT,
            accept: 'application/json, text/plain, */*',
            'accept-language': 'en-IN,en;q=0.9',
            origin: BASE_URL,
            referer: buildSearchReferer(query),
            'x-location-detail': buildLocationHeader(location),
        },
        responseType: 'text',
        throwHttpErrors: false,
        timeout: { request: REQUEST_TIMEOUT_MS },
    });

    const bodyText = response.body ?? '';
    let payload: CapturedPayload | null = null;

    if (response.statusCode < 400 && bodyText) {
        try {
            payload = { url, json: JSON.parse(bodyText) as unknown };
        } catch {
            payload = null;
        }
    }

    return { payload, statusCode: response.statusCode, bodyText };
}
