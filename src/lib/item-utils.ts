import { AlbionItem } from "../types/albion";

// Pre-computed regex patterns for better performance
const PATTERNS = {
  mounts: {
    id: /_MOUNT_/,
    name: /(horse|ox|stag|moose|dire)/i
  },
  weapons: {
    id: /(_MAIN_|_2H_|_OFF_)/,
    sword: /_SWORD/,
    axe: /_AXE/,
    mace: /_MACE/,
    hammer: /_HAMMER/,
    spear: /_SPEAR/,
    bow: /_BOW/,
    crossbow: /_CROSSBOW/,
    staff: /_STAFF/,
    fire: /FIRE/,
    holy: /HOLY/,
    curse: /CURSE/,
    frost: /FROST/,
    arcane: /ARCANE/,
    nature: /NATURE/
  },
  armor: {
    id: /(_HEAD_|_ARMOR_|_SHOES_)/,
    plate: /_PLATE_/,
    leather: /_LEATHER_/,
    cloth: /_CLOTH_/
  },
  accessories: {
    bag: /_BAG/,
    cape: /_CAPE/
  },
  consumables: {
    potion: /_POTION_/,
    meal: /_MEAL_/,
    food: /_FOOD_/,
    cooked: /_COOKED_/
  },
  farm: {
    animal: /_ANIMAL_/,
    egg: /_EGG_/,
    milk: /_MILK_/,
    meat: /_MEAT_/,
    farm: /_FARM_/
  },
  resources: {
    wood: /_WOOD/,
    planks: /_PLANKS/,
    rock: /_ROCK/,
    stoneblock: /_STONEBLOCK/,
    ore: /_ORE/,
    metalbar: /_METALBAR/,
    fiber: /_FIBER/,
    hide: /_HIDE/,
    leather: /_LEATHER/
  },
  tools: {
    id: /_TOOL_/,
    pick: /_PICK/,
    axe: /_AXE/,
    sickle: /_SICKLE/,
    knife: /_KNIFE/
  }
};

// Cached results for already categorized items
const categorizationCache = new Map<string, AlbionItem>();

/**
 * Categorizes an item based on its ID and Name.
 * This is a fallback when the category/subCategory fields are "Unknown".
 */
export function categorizeItem(item: AlbionItem): AlbionItem {
  // Return cached result if available
  if (categorizationCache.has(item.id)) {
    return categorizationCache.get(item.id)!;
  }

  if (item.category !== "Unknown" && item.subCategory !== "Unknown") {
    categorizationCache.set(item.id, item);
    return item;
  }

  const id = item.id;
  const name = item.name;

  let category = item.category;
  let subCategory = item.subCategory;

  // Mounts
  if (PATTERNS.mounts.id.test(id) || PATTERNS.mounts.name.test(name)) {
    category = "Mounts";
    if (/horse/i.test(name)) subCategory = "Riding Horse";
    else if (/ox/i.test(name)) subCategory = "Transport Ox";
    else if (/(stag|moose)/i.test(name)) subCategory = "Rare Mount";
    else subCategory = "Other Mount";
  }
  // Weapons
  else if (PATTERNS.weapons.id.test(id)) {
    category = "Weapons";
    if (PATTERNS.weapons.sword.test(id)) subCategory = "Swords";
    else if (PATTERNS.weapons.axe.test(id)) subCategory = "Axes";
    else if (PATTERNS.weapons.mace.test(id)) subCategory = "Maces";
    else if (PATTERNS.weapons.hammer.test(id)) subCategory = "Hammers";
    else if (PATTERNS.weapons.spear.test(id)) subCategory = "Spears";
    else if (PATTERNS.weapons.bow.test(id)) subCategory = "Bows";
    else if (PATTERNS.weapons.crossbow.test(id)) subCategory = "Crossbows";
    else if (PATTERNS.weapons.staff.test(id)) {
      if (PATTERNS.weapons.fire.test(id)) subCategory = "Fire Staffs";
      else if (PATTERNS.weapons.holy.test(id)) subCategory = "Holy Staffs";
      else if (PATTERNS.weapons.curse.test(id)) subCategory = "Cursed Staffs";
      else if (PATTERNS.weapons.frost.test(id)) subCategory = "Frost Staffs";
      else if (PATTERNS.weapons.arcane.test(id)) subCategory = "Arcane Staffs";
      else if (PATTERNS.weapons.nature.test(id)) subCategory = "Nature Staffs";
      else subCategory = "Staffs";
    }
    else subCategory = "Other Weapon";
  }
  // Armor
  else if (PATTERNS.armor.id.test(id)) {
    category = "Armor";
    if (PATTERNS.armor.plate.test(id)) subCategory = "Plate Armor";
    else if (PATTERNS.armor.leather.test(id)) subCategory = "Leather Armor";
    else if (PATTERNS.armor.cloth.test(id)) subCategory = "Cloth Armor";
    else subCategory = "Other Armor";
  }
  // Accessories
  else if (PATTERNS.accessories.bag.test(id) || PATTERNS.accessories.cape.test(id)) {
    category = "Accessories";
    if (PATTERNS.accessories.bag.test(id)) subCategory = "Bags";
    else if (PATTERNS.accessories.cape.test(id)) subCategory = "Capes";
  }
  // Consumables (Food & Potions)
  else if (PATTERNS.consumables.potion.test(id) || PATTERNS.consumables.meal.test(id) || PATTERNS.consumables.food.test(id) || PATTERNS.consumables.cooked.test(id)) {
    category = "Consumables";
    if (PATTERNS.consumables.potion.test(id)) subCategory = "Potions";
    else subCategory = "Food";
  }
  // Farm & Animals
  else if (PATTERNS.farm.animal.test(id) || PATTERNS.farm.egg.test(id) || PATTERNS.farm.milk.test(id) || PATTERNS.farm.meat.test(id) || PATTERNS.farm.farm.test(id)) {
    category = "Farm";
    if (PATTERNS.farm.animal.test(id)) subCategory = "Animals";
    else if (PATTERNS.farm.egg.test(id) || PATTERNS.farm.milk.test(id) || PATTERNS.farm.meat.test(id)) subCategory = "Animal Products";
    else subCategory = "Farm Products";
  }
  // Resources
  else if (PATTERNS.resources.wood.test(id) || PATTERNS.resources.planks.test(id) || PATTERNS.resources.rock.test(id) || PATTERNS.resources.stoneblock.test(id) || PATTERNS.resources.ore.test(id) || PATTERNS.resources.metalbar.test(id) || PATTERNS.resources.fiber.test(id) || PATTERNS.resources.hide.test(id) || PATTERNS.resources.leather.test(id)) {
    category = "Resources";
    if (PATTERNS.resources.wood.test(id) || PATTERNS.resources.planks.test(id)) subCategory = "Wood";
    else if (PATTERNS.resources.rock.test(id) || PATTERNS.resources.stoneblock.test(id)) subCategory = "Stone";
    else if (PATTERNS.resources.ore.test(id) || PATTERNS.resources.metalbar.test(id)) subCategory = "Ore";
    else if (PATTERNS.resources.fiber.test(id)) subCategory = "Fiber";
    else if (PATTERNS.resources.hide.test(id) || PATTERNS.resources.leather.test(id)) subCategory = "Hide";
  }
  // Gathering Tools
  else if (PATTERNS.tools.id.test(id)) {
    category = "Gathering Tools";
    if (PATTERNS.tools.pick.test(id)) subCategory = "Pickaxe";
    else if (PATTERNS.tools.axe.test(id)) subCategory = "Woodaxe";
    else if (PATTERNS.tools.sickle.test(id)) subCategory = "Sickle";
    else if (PATTERNS.tools.knife.test(id)) subCategory = "Skinning Knife";
    else if (PATTERNS.weapons.hammer.test(id)) subCategory = "Stone Hammer";
    else subCategory = "Other Tool";
  }

  const result = {
    ...item,
    category: category === "Unknown" ? "Other" : category,
    subCategory: subCategory === "Unknown" ? "Other" : subCategory
  };

  categorizationCache.set(item.id, result);
  return result;
}

/**
 * Processes a list of items and categorizes them.
 * Uses batch processing with cache warming for better performance.
 */
export function processItems(items: AlbionItem[]): AlbionItem[] {
  // Warm up cache for all items
  return items.map(categorizeItem);
}

/**
 * Clears the categorization cache (useful for testing or memory management)
 */
export function clearCategorizationCache(): void {
  categorizationCache.clear();
}

/**
 * Returns cache statistics (useful for debugging)
 */
export function getCategorizationCacheStats(): { size: number } {
  return { size: categorizationCache.size };
}
