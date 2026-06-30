import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeInput } from '../dist/input.js';
import { buildHomeUrl, buildProductsUrl, extractProducts, isBlockedPage } from '../dist/routes.js';

const location = {
    locationName: 'Mumbai, Maharashtra, 400001',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    storeId: 'store-1',
    storeCode: 'jm-1',
    deliveryMessage: 'Delivery in 30 mins',
};

const jiomartPayload = {
    items: [
        {
            type: 'product',
            uid: '107490320',
            name: 'INARI RICE Gold XXL Rozana Standard Basmati Rice 10kg',
            slug: 'inari-rice-gold-xxl-rozana-standard-basmati-rice-10-kg-mpwjcv-107490320',
            brand: { name: 'INARI RICE' },
            price: {
                effective: { min: '1290' },
                marked: { min: '1699' },
                currency_code: 'INR',
            },
            discount: '24',
            sellable: true,
            instock_variants: { item_id: ['107490320'] },
            hierarchy: {
                l1_category: { name: 'Cooking Essentials' },
            },
            attributes: {
                'product-size': 'OS',
            },
            medias: [
                { url: '//cdn1.jiomartjcp.com/v2/catalog-cloud/jiomart/example.jpg' },
            ],
        },
        {
            type: 'product',
            uid: '107490320',
            name: 'Duplicate rice item',
            price: {
                effective: { min: 1290 },
            },
        },
    ],
};

test('normalizes default input to one low-cost Mumbai rice run', () => {
    const input = normalizeInput({});

    assert.deepEqual(input.searchQueries, ['rice']);
    assert.equal(input.locationName, 'Mumbai');
    assert.equal(input.latitude, 19.076);
    assert.equal(input.longitude, 72.8777);
    assert.deepEqual(input.brands, []);
    assert.deepEqual(input.categories, []);
    assert.equal(input.inStockOnly, true);
    assert.equal(input.minPrice, 0);
    assert.equal(input.maxPrice, 1000000);
    assert.equal(input.maxResults, 1);
    assert.equal(input.maxPagesPerQuery, 1);
    assert.equal(input.proxyConfiguration.useApifyProxy, true);
    assert.deepEqual(input.proxyConfiguration.apifyProxyGroups, ['RESIDENTIAL']);
    assert.equal(input.proxyConfiguration.apifyProxyCountry, 'IN');
});

test('rejects oversized or invalid input values', () => {
    assert.throws(
        () => normalizeInput({ searchQueries: ['a', 'b', 'c', 'd', 'e', 'f'] }),
        /at most 5/,
    );
    assert.throws(
        () => normalizeInput({ searchQueries: ['rice'], categories: Array.from({ length: 21 }, (_, index) => `cat-${index}`) }),
        /categories/,
    );
    assert.throws(
        () => normalizeInput({ searchQueries: ['rice'], maxResults: 0 }),
        /between 1 and 500/,
    );
    assert.throws(
        () => normalizeInput({ searchQueries: ['rice'], latitude: 120 }),
        /latitude/,
    );
    assert.throws(
        () => normalizeInput({ searchQueries: ['rice'], minPrice: 100, maxPrice: 50 }),
        /maxPrice/,
    );
});

test('builds JioMart URLs and detects challenge pages', () => {
    assert.equal(buildHomeUrl('basmati rice'), 'https://www.jiomart.com/?search=basmati%20rice');
    assert.equal(buildProductsUrl('basmati rice'), 'https://www.jiomart.com/products?q=basmati%20rice');
    assert.equal(isBlockedPage('Just a moment...', ''), true);
    assert.equal(isBlockedPage('JioMart', 'fresh groceries and products'), false);
});

test('extracts and deduplicates JioMart products from structured payloads', () => {
    const products = extractProducts([{ url: 'https://www.jiomart.com/products?q=rice', json: jiomartPayload }], 'rice', location);

    assert.equal(products.length, 1);
    assert.equal(products[0].source, 'jiomart');
    assert.equal(products[0].searchQuery, 'rice');
    assert.equal(products[0].position, 1);
    assert.equal(products[0].productId, '107490320');
    assert.equal(products[0].title, 'INARI RICE Gold XXL Rozana Standard Basmati Rice 10kg');
    assert.equal(products[0].brand, 'INARI RICE');
    assert.equal(products[0].price, 1290);
    assert.equal(products[0].mrp, 1699);
    assert.equal(products[0].discountPercent, 24);
    assert.equal(products[0].currency, 'INR');
    assert.equal(products[0].packSize, '10 kg');
    assert.equal(products[0].category, 'Cooking Essentials');
    assert.equal(products[0].rating, null);
    assert.equal(products[0].ratingCount, null);
    assert.equal(products[0].inStock, true);
    assert.equal(
        products[0].productUrl,
        'https://www.jiomart.com/p/inari-rice-gold-xxl-rozana-standard-basmati-rice-10-kg-mpwjcv-107490320',
    );
    assert.equal(products[0].imageUrl, 'https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomart/example.jpg');
});
