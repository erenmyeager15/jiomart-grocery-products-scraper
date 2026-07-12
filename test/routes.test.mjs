import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractProducts, isProductsApiUrl } from '../dist/routes.js';

const LOCATION = {
    locationName: 'Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    storeId: null,
    storeCode: null,
    deliveryMessage: null,
};

const payload = (json) => [{ url: 'https://www.jiomart.com/ext/vertex/application/api/v1.0/products', json }];

test('extracts a product from the known JioMart payload shape', () => {
    const json = {
        items: [
            {
                type: 'product',
                name: 'India Gate Basmati Rice 5 kg',
                uid: 590001234,
                slug: 'india-gate-basmati-rice-5-kg',
                brand: { name: 'India Gate' },
                price: { effective: { min: 725 }, marked: { min: 900 }, currency_code: 'INR' },
                medias: [{ url: '//www.jiomart.com/images/product/590001234.jpg' }],
                sellable: true,
                instock_variants: { item_id: [1, 2] },
                hierarchy: { l1_category: { name: 'Staples' } },
            },
        ],
    };
    const products = extractProducts(payload(json), 'rice', LOCATION);
    assert.equal(products.length, 1);
    const p = products[0];
    assert.equal(p.title, 'India Gate Basmati Rice 5 kg');
    assert.equal(p.productId, '590001234');
    assert.equal(p.brand, 'India Gate');
    assert.equal(p.price, 725);
    assert.equal(p.mrp, 900);
    assert.equal(p.discountPercent, 19);
    assert.equal(p.currency, 'INR');
    assert.equal(p.category, 'Staples');
    assert.equal(p.inStock, true);
    assert.equal(p.productUrl, 'https://www.jiomart.com/p/india-gate-basmati-rice-5-kg');
    assert.equal(p.imageUrl, 'https://www.jiomart.com/images/product/590001234.jpg');
    assert.equal(p.packSize, '5 kg');
});

test('extracts a product from a drifted payload shape (nested container, alternate fields)', () => {
    const json = {
        data: {
            products: [
                {
                    title: 'Aashirvaad Atta 10 kg',
                    sku_code: 'ABC123',
                    sellingPrice: 545,
                    mrp: 600,
                    brand_name: 'Aashirvaad',
                    image_url: 'https://www.jiomart.com/images/atta.jpg',
                    in_stock: true,
                    category_name: 'Atta & Flours',
                },
            ],
        },
    };
    const products = extractProducts(payload(json), 'atta', LOCATION);
    assert.equal(products.length, 1);
    const p = products[0];
    assert.equal(p.title, 'Aashirvaad Atta 10 kg');
    assert.equal(p.productId, 'ABC123');
    assert.equal(p.price, 545);
    assert.equal(p.mrp, 600);
    assert.equal(p.brand, 'Aashirvaad');
    assert.equal(p.category, 'Atta & Flours');
    assert.equal(p.inStock, true);
    assert.equal(p.imageUrl, 'https://www.jiomart.com/images/atta.jpg');
    assert.equal(p.packSize, '10 kg');
});

test('returns no rows for empty or non-product payloads (never fabricates data)', () => {
    assert.deepEqual(extractProducts(payload({ items: [] }), 'rice', LOCATION), []);
    assert.deepEqual(extractProducts(payload({ items: [{ type: 'banner', title: 'Ad' }] }), 'rice', LOCATION), []);
    assert.deepEqual(extractProducts(payload({}), 'rice', LOCATION), []);
    assert.deepEqual(extractProducts([{ url: 'x', json: null }], 'rice', LOCATION), []);
});

test('isProductsApiUrl matches product APIs across version drift but not the HTML page', () => {
    assert.equal(isProductsApiUrl('https://www.jiomart.com/ext/vertex/application/api/v1.0/products'), true);
    assert.equal(isProductsApiUrl('https://www.jiomart.com/ext/vertex/application/api/v2.3/products?q=rice'), true);
    assert.equal(isProductsApiUrl('https://www.jiomart.com/catalog/products/list'), true);
    assert.equal(isProductsApiUrl('https://www.jiomart.com/products?q=rice'), false);
    assert.equal(isProductsApiUrl('https://www.jiomart.com/api/v1/cart'), false);
});
