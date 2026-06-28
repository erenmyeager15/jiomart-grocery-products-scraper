export interface ProxyInput {
    useApifyProxy?: boolean;
    apifyProxyGroups?: string[];
    apifyProxyCountry?: string;
    proxyUrls?: string[];
}

export interface ActorInput {
    searchQueries?: string[];
    locationName?: string;
    latitude?: number;
    longitude?: number;
    brands?: string[];
    categories?: string[];
    inStockOnly?: boolean;
    minPrice?: number;
    maxPrice?: number;
    maxResults?: number;
    maxPagesPerQuery?: number;
    proxyConfiguration?: ProxyInput;
}

export interface RequestData {
    searchQuery: string;
}

export interface CapturedPayload {
    url: string;
    json: unknown;
}

export interface LocationSnapshot {
    locationName: string;
    city: string | null;
    state: string | null;
    pincode: string | null;
    storeId: string | null;
    storeCode: string | null;
    deliveryMessage: string | null;
}

export interface ProductRecord {
    source: 'jiomart';
    searchQuery: string;
    position: number;
    productId: string | null;
    title: string;
    brand: string;
    price: number | null;
    mrp: number | null;
    discountPercent: number | null;
    currency: string;
    packSize: string;
    category: string;
    rating: number | null;
    ratingCount: number | null;
    inStock: boolean | null;
    productUrl: string | null;
    imageUrl: string | null;
    scrapedAt: string;
}
