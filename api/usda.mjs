// Vercel serverless function: USDA FoodData Central search proxy.
// Configure USDA_API_KEY in Vercel Project Settings > Environment Variables.
// Never put the API key in browser JavaScript.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const query = String(req.query?.query || '').trim().slice(0, 120);
  if (query.length < 2) return res.status(400).json({ error: 'Enter at least 2 characters to search USDA.' });
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'USDA is not configured yet. Add USDA_API_KEY in Vercel Environment Variables.' });
  try {
    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('query', query);
    url.searchParams.set('pageSize', '8');
    url.searchParams.set('api_key', apiKey);
    const upstream = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!upstream.ok) return res.status(upstream.status === 429 ? 429 : 502).json({ error: `USDA FoodData Central request failed (${upstream.status}).` });
    const data = await upstream.json();
    const foods = (data.foods || []).map(food => {
      const nutrients = food.foodNutrients || [];
      const find = (...names) => {
        const item = nutrients.find(n => names.some(name => String(n.nutrientName || '').toLowerCase() === name.toLowerCase()));
        return Number.isFinite(Number(item?.value)) ? Number(item.value) : null;
      };
      const energy = find('Energy');
      const sugar = find('Sugars, Total Including NLEA', 'Sugars, total');
      const satFat = find('Fatty acids, total saturated');
      const sodium = find('Sodium, Na');
      const protein = find('Protein');
      const fiber = find('Fiber, total dietary');
      const fat = find('Total lipid (fat)');
      return {
        product_name: food.description || 'Unnamed food',
        brands: food.brandOwner || food.brandName || food.dataType || 'USDA food record',
        code: food.gtinUpc || String(food.fdcId || ''),
        nutriments: {
          'energy-kcal_100g': energy,
          'sugars_100g': sugar,
          'saturated-fat_100g': satFat,
          'sodium_100g': sodium === null ? null : sodium / 1000,
          'proteins_100g': protein,
          'fiber_100g': fiber,
          'fat_100g': fat
        },
        sourceLabel: 'USDA FoodData Central',
        sourceUrl: `https://fdc.nal.usda.gov/food-details/${encodeURIComponent(food.fdcId || '')}/nutrients`,
        nutriscore_grade: null,
        fdcId: food.fdcId
      };
    });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ products: foods });
  } catch (error) {
    return res.status(502).json({ error: 'Unable to reach USDA FoodData Central right now.' });
  }
}
