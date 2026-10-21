// Vercel serverless proxy for Open Food Facts.
// This avoids browser-origin CORS issues and keeps provider requests server-side.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const terms = String(req.query?.search_terms || '').trim().slice(0, 120);
  if (terms.length < 2) return res.status(400).json({ error: 'Enter at least 2 characters to search.' });
  const params = new URLSearchParams({
    search_terms: terms,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '12',
    fields: 'product_name,brands,nutriments,nutriscore_grade,nutrition_grades,code,image_front_url,quantity,categories,countries,countries_tags'
  });
  const countries = String(req.query?.countries_tags || '');
  if (countries === 'en:india') params.set('countries_tags', 'en:india');
  try {
    const upstream = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'NutriLens/1.0 (food-label analyzer)' }
    });
    if (!upstream.ok) return res.status(502).json({ error: `Open Food Facts request failed (${upstream.status}).` });
    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch {
    return res.status(502).json({ error: 'Unable to reach Open Food Facts right now.' });
  }
}
