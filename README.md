# JioMart Product Scraper: Prices & Stock

Scrape public JioMart location-specific grocery and product listings for price monitoring, assortment research, stock checks, and retail reporting. The Actor opens JioMart in a browser session, applies your delivery-area location, captures the structured product responses used by the public page, and saves clean product rows to an Apify Dataset.

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

This Actor uses Apify Pay Per Event with platform usage paid by the user. As of the latest live check, active pricing is:

| Event | Price |
| --- | ---: |
| `product-scraped` | `$0.003` per saved product |
| `apify-actor-start` | `$0.001` per GB start event |

The default memory is 2 GB, so the startup event charge is approximately `$0.002` for the default run. Platform usage such as browser compute and Residential India proxy traffic is billed separately by Apify. Prices can change only through Apify's pricing process, so treat the live Console pricing as the source of truth before running large jobs.

Cost-control tips:

- Start with one query, for example `rice` or `milk`.
- Keep `maxResults: 1` for the first run, then scale gradually.
- Keep `maxPagesPerQuery: 1` unless you need deeper coverage.
- Use the current fields `maxResults` and `maxPagesPerQuery`; older fields such as `maxProducts` or `pagesPerQuery` are ignored.
- Keep Residential India proxy enabled for location-specific reliability, but remember it can add platform usage cost.

## Input Fields

| Field | Type | Description |
| --- | --- | --- |
| `searchQueries` | string[] | One to five JioMart searches such as `rice`, `milk`, or `atta` |
| `locationName` | string | Human-readable location label for your run |
| `latitude` / `longitude` | number | Delivery-area coordinates for JioMart's location-aware catalog |
| `brands` | string[] | Optional exact brand filters, case-insensitive |
| `categories` | string[] | Optional category text filters |
| `inStockOnly` | boolean | Save only products available in the detected store |
| `minPrice` / `maxPrice` | number | Optional INR price range |
| `maxResults` | integer | Maximum unique products to save, up to 500 |
| `maxPagesPerQuery` | integer | Maximum result payloads processed per search query |
| `proxyConfiguration` | object | Apify Proxy settings. Residential India is recommended |

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

- JioMart prices, stock, delivery windows, and available products vary by detected location.
- Some products do not expose ratings, discounts, or complete metadata. Missing values are saved as `null` or `N/A`.
- The Actor fails blocked or empty zero-result runs instead of silently reporting success with no saved products.
- JioMart can change its public website, API responses, or protection rules. Residential India proxy is recommended for cloud runs.

## Responsible Use

This Actor is not affiliated with, endorsed by, or sponsored by JioMart or Reliance Retail. Use it only for lawful purposes and in compliance with applicable website terms, privacy laws, and local regulations. Do not use it to collect private account data, personal data, or non-public information.

## License

Apache License 2.0. See [LICENSE](LICENSE).
