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
    locationName: string;
    city: string | null;
    state: string | null;
    pincode: string | null;
    storeId: string | null;
    storeCode: string | null;
    position: number;
    productId: string;
    skuCode: string | null;
    productName: string;
    brand: string | null;
    packSize: string | null;
    currentPrice: number;
    marketPrice: number | null;
    discountPercent: number | null;
    savingsAmount: number | null;
    currency: string;
    inStock: boolean;
    sellable: boolean | null;
    minOrderQuantity: number | null;
    maxQuantityInOrder: number | null;
    category: string | null;
    subcategory: string | null;
    leafCategory: string | null;
    department: string | null;
    countryOfOrigin: string | null;
    journey: string | null;
    sellerId: string | null;
    rating: number | null;
    ratingBucket: string | null;
    variantsCount: number | null;
    imageUrl: string | null;
    productUrl: string;
    deliveryMessage: string | null;
    scrapedAt: string;
}
