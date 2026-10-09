# JioMart Product Scraper: Prices & Stock

Scrape public JioMart location-specific grocery and product listings for price monitoring, assortment research, stock checks, and retail reporting. The Actor requests JioMart's public catalog endpoint, applies your delivery pincode, and saves clean product rows to an Apify Dataset without running a browser.

It extracts product titles, brands, pack sizes, prices, MRP, discounts, categories, stock status, images, product URLs, and scrape timestamps. Export results as JSON, CSV, Excel, HTML, or consume them through the Apify API. No JioMart login or API key is required.

## Quick Start

Use this one-result sample to verify output at low cost:

```json
{
  "searchQueries": ["rice"],
  "locationName": "Mumbai",
  "latitude": 19.076,
  "longitude": 72.8777,
  "brands": [],
  "categories": [],
  "inStockOnly": true,
  "minPrice": 0,
  "maxPrice": 1000000,
  "maxResults": 1,
  "maxPagesPerQuery": 1,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"],
    "apifyProxyCountry": "IN"
  }
}
```

For larger runs, increase `maxResults` gradually and keep `maxPagesPerQuery` low until you confirm the catalog coverage for your query and location.

## What It Extracts

- Source, search query, result position, and product ID
- Product title, brand, pack size, and category
- Price, MRP, discount percentage, and currency
- Rating when JioMart exposes it, stock status, image URL, and product URL
- ISO scrape timestamp for reporting and change tracking

## Use Cases

- Monitor JioMart grocery prices, MRP, discounts, and availability
- Track FMCG brand presence and pack-size coverage by search term
- Compare JioMart catalog data with other grocery or quick-commerce sources
- Build product dashboards, market snapshots, and price intelligence reports
- Watch public product listings for stock and assortment changes over time

## Pricing And Cost Control

This Actor uses Apify Pay Per Event. As verified on 10 October 2026, active pricing is:

| Event | Price |
| --- | ---: |
| `product-scraped` | `$0.001` per saved product ($1/1,000) |
| `apify-actor-start` | `$0.00005` per start event through 1 GB |

The default memory is 512 MB. Platform usage is included in the current PPE configuration. The Actor tries direct HTTP access before using a configured proxy fallback, which avoids Residential transfer when the public endpoint is reachable directly. Treat the live Console Pricing tab as authoritative before large jobs.

Cost-control tips:

- Start with one query, for example `rice` or `milk`.
- Keep `maxResults: 1` for the first verification run. For recurring work, batches of 20-50 products share fixed startup and any fallback cost more efficiently.
- Keep `maxPagesPerQuery: 1` unless you need deeper coverage.
- Use the current fields `maxResults` and `maxPagesPerQuery`; older fields such as `maxProducts` or `pagesPerQuery` are ignored.
- Keep the Residential India option only as a fallback when reliability matters. Direct access is always attempted first; selecting no proxy prevents all proxy use.

## Input Fields

| Field | Type | Description |
| --- | --- | --- |
| `searchQueries` | string[] | One to five JioMart searches such as `rice`, `milk`, or `atta` |
| `locationName` | string | Human-readable location label for your run |
| `pincode` | string | Six-digit Indian delivery pincode that controls the regional catalog |
| `latitude` / `longitude` | number | Legacy saved-task compatibility fields; the current catalog path uses pincode |
| `brands` | string[] | Optional exact brand filters, case-insensitive |
| `categories` | string[] | Optional category text filters |
| `inStockOnly` | boolean | Save only products available in the detected store |
| `minPrice` / `maxPrice` | number | Optional INR price range |
| `maxResults` | integer | Maximum unique products to save, up to 500 |
| `maxPagesPerQuery` | integer | Maximum result payloads processed per search query |
| `proxyConfiguration` | object | Optional fallback settings; direct access is attempted first |

## Sample Output

```json
{
  "source": "jiomart",
  "searchQuery": "rice",
  "position": 1,
  "productId": "107490320",
  "title": "INARI RICE Gold XXL Rozana Standard Basmati Rice 10 kg",
  "brand": "INARI RICE",
  "price": 1290,
  "mrp": 1699,
  "discountPercent": 24,
  "currency": "INR",
  "packSize": "10 kg",
  "category": "Cooking Essentials",
  "rating": null,
  "ratingCount": null,
  "inStock": true,
  "productUrl": "https://www.jiomart.com/p/inari-rice-gold-xxl-rozana-standard-basmati-rice-10-kg-mpwjcv-107490320",
  "imageUrl": "https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomart/example.jpg",
  "scrapedAt": "2026-06-21T13:13:05.000Z"
}
```

## Reliability Notes

- Catalog rows are accepted only when the product title, brand, category, or slug matches the requested search terms. Recommendations and unrelated sponsored payloads are discarded instead of being returned as search results.

- JioMart prices, stock, delivery windows, and available products vary by detected location.
- Some products do not expose ratings, discounts, or complete metadata. Missing values are saved as `null` or `N/A`.
- A readable catalog with no matching rows, or rows removed by explicit filters, finishes successfully with an empty dataset and a transparent `OUTPUT` summary. Blocked, unreadable, or structurally changed source responses still fail visibly.
- JioMart can change its public website, API responses, or protection rules. A configured Residential India proxy is used only as a bounded fallback after direct access fails.

## Responsible Use

This Actor is not affiliated with, endorsed by, or sponsored by JioMart or Reliance Retail. Use it only for lawful purposes and in compliance with applicable website terms, privacy laws, and local regulations. Do not use it to collect private account data, personal data, or non-public information.

## License

Apache License 2.0. See [LICENSE](LICENSE).
