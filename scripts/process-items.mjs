import fs from 'fs';
import axios from 'axios';

// Root items.json has full data including craftingrequirements (XML-derived, @-prefixed keys)
const ITEMS_RAW_URL = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json';
// Formatted items.json has the localized names but no crafting data
const ITEMS_FORMATTED_URL = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';

// Keys that should NOT be recursed into — these contain ingredient/resource refs,
// not actual item definitions. Recursing into them causes ghost duplicates.
const SKIP_KEYS = new Set([
  'craftingrequirements',
  'craftresource',
  'enchantments',
  'upgraderequirements',
  'salvageable',
  'repairrequirements',
]);

/**
 * Recursively traverse the nested items.json structure to collect all item objects.
 * Uses a Map to deduplicate by @uniquename — first complete occurrence wins.
 */
function collectItems(obj, result = new Map()) {
  if (!obj || typeof obj !== 'object') return result;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectItems(item, result);
    }
    return result;
  }

  // If this object has a @uniquename and is NOT already seen, capture it
  if (obj['@uniquename']) {
    const id = obj['@uniquename'];
    if (!result.has(id)) {
      result.set(id, obj);
    }
  }

  // Recurse into child properties, skipping known non-item structural keys
  for (const key of Object.keys(obj)) {
    if (key.startsWith('@')) continue;      // skip attribute keys like @tier
    if (SKIP_KEYS.has(key)) continue;       // skip craftresource etc.
    const child = obj[key];
    if (child && typeof child === 'object') {
      collectItems(child, result);
    }
  }

  return result;
}

/**
 * Parse craftingrequirements from a raw item object.
 * Returns an array of { id, count } for each required resource.
 */
function parseCraftingRecipe(item) {
  const reqs = item['craftingrequirements'];
  if (!reqs) return [];

  // Can be a single object or array
  const reqArray = Array.isArray(reqs) ? reqs : [reqs];

  const ingredients = [];
  for (const req of reqArray) {
    const resources = req['craftresource'];
    if (!resources) continue;

    const resArray = Array.isArray(resources) ? resources : [resources];
    for (const res of resArray) {
      const id = res['@uniquename'];
      const count = parseInt(res['@count'] || '0', 10);
      if (id) {
        ingredients.push({ id, count });
      }
    }
  }

  return ingredients;
}

async function processItems() {
  console.log('Fetching raw items.json from GitHub (17MB, please wait)...');
  try {
    const [rawResponse, formattedResponse] = await Promise.all([
      axios.get(ITEMS_RAW_URL, { timeout: 120000 }),
      axios.get(ITEMS_FORMATTED_URL, { timeout: 120000 }),
    ]);

    const rawData = rawResponse.data;
    const formattedItems = formattedResponse.data;

    // Build a lookup map from uniqueName -> localized name from formatted data
    console.log(`Building name lookup from ${formattedItems.length} formatted items...`);
    const nameMap = {};
    for (const item of formattedItems) {
      if (item.UniqueName && item.LocalizedNames && item.LocalizedNames['EN-US']) {
        nameMap[item.UniqueName] = item.LocalizedNames['EN-US'];
      }
    }

    // Recursively collect all raw items (deduplicated by @uniquename via Map)
    console.log('Collecting items from raw data...');
    const itemMap = collectItems(rawData);
    console.log(`Found ${itemMap.size} unique raw items (before filtering)`);

    // Filter and map
    const filteredItems = [];
    for (const [id, item] of itemMap) {
      // Filter by T1-T8
      const isTiered = /^T[1-8]_/.test(id);
      // Exclude quest items
      const isQuest = id.includes('QUESTITEM');
      // Must have a localized name
      const hasName = !!nameMap[id];

      if (!isTiered || isQuest || !hasName) continue;

      const tierMatch = id.match(/^T(\d)/);
      const tier = tierMatch ? parseInt(tierMatch[1]) : 0;
      const enchantMatch = id.match(/@(\d)$/);
      const enchantment = enchantMatch ? parseInt(enchantMatch[1]) : 0;

      filteredItems.push({
        id,
        name: nameMap[id],
        tier,
        enchantment,
        weight: parseFloat(item['@weight'] || '0'),
        itemValue: parseInt(item['@itemvalue'] || item['@itemValue'] || '0'),
        category: item['@shopcategory'] || 'Unknown',
        subCategory: item['@shopsubcategory1'] || item['@shopsubcategory'] || 'Unknown',
        craftingRecipe: parseCraftingRecipe(item),
        icon: `https://render.albiononline.com/v1/item/${id}.png`
      });
    }

    const withRecipes = filteredItems.filter(i => i.craftingRecipe.length > 0);
    console.log(`Processed ${filteredItems.length} items, ${withRecipes.length} have crafting recipes`);

    // Sample a few refined materials for verification
    const sample = filteredItems.filter(i => i.id.includes('LEATHER') && i.tier === 3);
    if (sample.length > 0) {
      console.log('Sample T3 LEATHER check:', JSON.stringify(sample[0], null, 2));
    }

    console.log('Saving to src/data/items-lite.json...');
    if (!fs.existsSync('src/data')) {
      fs.mkdirSync('src/data', { recursive: true });
    }
    fs.writeFileSync('src/data/items-lite.json', JSON.stringify(filteredItems, null, 2));
    console.log('Success!');
  } catch (error) {
    console.error('Error processing items:', error.message);
    if (error.response) {
      console.error('HTTP status:', error.response.status);
    }
  }
}

processItems();
