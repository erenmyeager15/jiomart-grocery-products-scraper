# JioMart Grocery Scraper - Products & Prices

Collect public JioMart grocery and product catalog data for price monitoring, market research, assortment tracking, and quick-commerce analytics. Search multiple keywords and export clean records with product names, brands, pack sizes, current prices, MRP, discounts, categories, stock status, store metadata, images, and product URLs. Export to JSON, CSV, Excel, or HTML, or pull results through the Apify API. No JioMart login or API key is required.

## What It Extracts

- Product ID, SKU, product name, brand, and pack size
- Current price, MRP, discount percentage, savings, and currency
- Stock/sellable status, MOQ, max order quantity, seller ID, and journey
- Category, subcategory, leaf category, department, and country of origin
- Detected city, state, pincode, store ID, store code, and delivery message
- Rating fields when exposed by JioMart, product image, product URL, and scrape timestamp

## Use Cases

- Monitor JioMart grocery prices, MRP, and discounts by search query
- Track FMCG assortment and category coverage for Indian retail research
- Compare grocery pack sizes, brands, and pricing across quick-commerce products
- Build product catalogs, dashboards, and competitive price reports
- Watch stock availability and store-level product changes over time

## Pricing

| Event | Price | 1,000 products | 10,000 products |
| --- | ---: | ---: | ---: |
| `product-scraped` | $0.003/product | $3.00 | $30.00 |

You are charged only after a clean product record is saved. The Actor stops requesting more pages when the run's maximum charge is reached.

## Input

| Field | Type | Description |
| --- | --- | --- |
| `searchQueries` | string[] | JioMart searches such as `atta`, `milk`, or `rice` |
| `locationName` | string | Human-readable location label |
| `latitude` / `longitude` | number | Delivery-area coordinates for JioMart's location-aware catalog |
| `brands` | string[] | Optional exact brand filter |
| `categories` | string[] | Optional category text filter |
| `inStockOnly` | boolean | Save only available products |
| `minPrice` / `maxPrice` | number | Optional INR price range |
| `maxResults` | integer | Maximum unique products, up to 500 |
| `maxPagesPerQuery` | integer | Maximum result payloads per query |
| `proxyConfiguration` | object | India residential proxy configuration |

## How to Scrape JioMart (Step by Step)

1. Add one or more product searches to `searchQueries`.
2. Enter a location label and its latitude and longitude.
3. Optionally filter by brand, category, stock status, or price range.
4. Set the maximum number of products and start the Actor.
5. Open the Dataset to export results or consume them through the API.

## Sample Output

```json
{
  "source": "jiomart",
  "searchQuery": "atta",
  "locationName": "MUMBAI, MAHARASHTRA, 400001",
  "city": "MUMBAI",
  "state": "MAHARASHTRA",
  "pincode": "400001",
  "storeId": "3442",
  "storeCode": "T6HZ",
  "position": 1,
  "productId": "7508748",
  "skuCode": "490750659",
  "productName": "Aashirvaad Superior Whole Wheat MP Atta 1 kg",
  "brand": "aashirvaad",
  "packSize": "1 kg",
  "currentPrice": 59,
  "marketPrice": 67,
  "discountPercent": 12,
  "savingsAmount": 8,
  "currency": "INR",
  "inStock": true,
  "sellable": true,
  "minOrderQuantity": 1,
  "maxQuantityInOrder": 4,
  "category": "Cooking Essentials",
  "subcategory": "Atta, Flours & Sooji",
  "leafCategory": "Atta",
  "department": "Groceries",
  "countryOfOrigin": "India",
  "journey": "quickcommerce",
  "sellerId": "1",
  "rating": 0,
  "ratingBucket": "0",
  "variantsCount": 4,
  "imageUrl": "https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/example.jpg",
  "productUrl": "https://www.jiomart.com/p/aashirvaad-superior-whole-wheat-mp-atta-1-kg-mffmuf-7508748",
  "deliveryMessage": "Delivery in 10 to 30 mins",
  "scrapedAt": "2026-06-13T09:35:00.000Z"
}
```

## How It Works

The Actor opens JioMart's public website in Chromium, lets the site initialize its location-aware store session, performs the requested searches, and captures the structured product responses used by the page. It parses products from those responses, removes duplicates, applies your filters, and saves each accepted product to the Dataset.

## Known Limits

- JioMart prices, stock, delivery windows, and store IDs vary by location and can change frequently.
- Some products do not expose ratings, discounts, or all metadata; those fields remain `null` rather than being fabricated.
- The site can change its public interface or protection rules. India residential proxy traffic is recommended.
- Results represent public catalog information visible in the browser session at scrape time.

## Responsible Use

Use this Actor only for lawful purposes and in compliance with applicable website terms, robots rules, privacy laws, and local regulations. Do not use it to collect or resell personal data.

## License

Apache License 2.0. See [LICENSE](LICENSE).
