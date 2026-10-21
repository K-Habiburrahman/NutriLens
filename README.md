# NutriLens — Food Health Analyzer

A browser-based food-label analyzer built with HTML, CSS and JavaScript. Search packaged products, review nutrition data from supported food databases, or upload a nutrition-label image for browser-side OCR.

## Features

- Searches Open Food Facts with India-tagged results prioritized and global fallback.
- Searches USDA FoodData Central through a Vercel serverless function when configured.
- Links to the official Indian Food Composition Tables (IFCT 2017) published by ICMR–National Institute of Nutrition for reference on Indian raw foods.
- Product images, brand, barcode and available nutrition metadata.
- Nutrition fields mapped to editable values per 100 g/ml where available.
- Browser-side OCR using Tesseract.js for labels not found in a database.
- Transparent educational scoring and nutrient observations.

## Run locally

1. Extract the project folder.
2. For frontend-only testing, serve the folder using a local HTTP server; do not open `index.html` using `file://`.
3. The USDA integration is a Vercel serverless function in `api/usda.mjs`; it requires `USDA_API_KEY`. Deploy to Vercel or run with the Vercel CLI to test the full integration.
4. Search a product and confirm its name, brand, barcode and printed label before using values. Alternatively, upload a clear PNG, JPG or WEBP nutrition-label image.

An internet connection is required for external data sources and the Tesseract.js CDN.

## Data sources

### Open Food Facts

- Documentation: https://openfoodfacts.github.io/documentation/
- Used for product-name searches and available branded product records.
- Read access does not require an API key.
- India tagging is a best-effort filter, not a guarantee of origin or accuracy. Product records may be incomplete or user-submitted.
- The app retains a global fallback if no India-tagged matches are found.
- NutriLens calls Open Food Facts through `api/off.mjs`, a Vercel serverless proxy, to avoid direct browser-origin CORS issues. The upstream service can still be unavailable or rate-limited.

### USDA FoodData Central

- API guide: https://fdc.nal.usda.gov/api-guide.html
- Search endpoint: `https://api.nal.usda.gov/fdc/v1/foods/search`
- NutriLens calls `/api/usda`, a Vercel serverless function that keeps the USDA API key on the server.
- Obtain a key from USDA FoodData Central and set it in Vercel: **Project Settings → Environment Variables → `USDA_API_KEY`**. Redeploy after adding the variable.
- For local testing with Vercel CLI, add `USDA_API_KEY=your_key` to a local `.env` file (do not commit it). Add `.env` to `.gitignore`.
- If the key is missing, the app displays a configuration message and other available sources can still be used.
- FoodData Central includes generic and branded food records, but Indian packaged-product coverage varies. Nutrient fields can be absent. Always verify against the package label.

### Indian Food Composition Tables (IFCT 2017)

- Official reference PDF: https://www.nin.res.in/ebooks/IFCT2017_16122024.pdf
- IFCT 2017 was published by the Indian Council of Medical Research–National Institute of Nutrition (ICMR–NIN) and reports nutrient composition for 528 key Indian foods.
- IFCT is a reference publication, not a public live product-search API. In this version, it is linked in the interface for manual reference; its PDF has **not** been silently converted into an app database.
- IFCT is primarily useful for raw foods and ingredients. Do not substitute a raw ingredient's nutrient values for a branded packaged product's label.
- To add searchable IFCT results later, create a structured dataset from a permitted source, carefully transcribe/validate the required values, preserve IFCT food codes and citations, and review reuse/licensing conditions. Do not invent missing nutrient values.

## Nutrition field mapping

- Energy is shown in kcal per 100 g/ml when the source provides compatible data.
- Sugars, saturated fat, protein, fibre and total fat are mapped when available.
- Sodium is displayed in mg. If a source reports salt instead of sodium, the app may derive an estimate; check the original label.
- Missing values remain blank; they are not assumed to be zero.
- Nutrient fields from different databases may use different definitions or food states. Compare like with like and review the source record.

## API authentication and secrets

- Open Food Facts read-only lookup does not require a private key.
- USDA credentials are used only by `api/usda.mjs` via the server-side `USDA_API_KEY` environment variable.
- Never put private keys, passwords or tokens in `script.js`, HTML, or any browser-delivered file. Never commit `.env` or real credentials.
- Both data proxies only permit GET requests and limit query length; responses are cached briefly.

## Nutrition score and safety limitations

The score is an educational heuristic, not a clinically validated tool, official Nutri-Score, FSSAI certification, or medical assessment. It is not a substitute for checking ingredients, allergens, serving sizes or the printed label. Do not use the app for diagnosis, allergy safety decisions, or medical advice.

## Privacy

- Search terms are sent to the selected external data providers.
- Uploaded label images are processed in the browser and are not uploaded to a project-owned server.
- Tesseract.js and its language data are downloaded from a CDN.

## Project files

- `index.html` — page structure and source links
- `style.css` — layout and styling
- `script.js` — product search, OCR, extraction and scoring
- `api/off.mjs` — server-side Open Food Facts proxy for Vercel
- `api/usda.mjs` — server-side USDA search proxy for Vercel

## Troubleshooting

- **USDA says it is not configured:** Add `USDA_API_KEY` in Vercel Project Settings → Environment Variables, then redeploy.
- **Product search fails:** Test the deployed site, inspect the Network tab, and check whether the provider is reachable. The app uses a same-origin Vercel proxy; inspect the relevant `/api/off` or `/api/usda` response for provider errors.
- **No Indian product match appears:** Coverage and country tags may be incomplete. Try a shorter name or upload the printed label.
- **Tesseract.js tracking-prevention warning:** It may be a browser privacy warning. If OCR fails to load, try another browser/session or self-host the OCR assets.
- **Local `file://` CORS errors:** Run through a local HTTP server or Vercel CLI instead of opening the HTML file directly.

## Third-party services

- Open Food Facts: https://openfoodfacts.org/
- USDA FoodData Central: https://fdc.nal.usda.gov/
- ICMR–NIN IFCT 2017: https://www.nin.res.in/ebooks/IFCT2017_16122024.pdf
- Tesseract.js: https://github.com/naptha/tesseract.js

Review each source's current terms, licensing and attribution requirements before commercial use.
