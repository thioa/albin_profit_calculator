import { AlbionItem } from "../types/albion";

/**
 * Categorizes an item based on its ID and Name.
 * This is a fallback when the category/subCategory fields are "Unknown".
 */
export function categorizeItem(item: AlbionItem): AlbionItem {
  if (item.category !== "Unknown" && item.subCategory !== "Unknown") {
    return item;
  }

  const id = item.id.toUpperCase();
  const name = item.name.toLowerCase();

  let category = item.category;
  let subCategory = item.subCategory;

  // Mounts
  if (id.includes("_MOUNT_") || name.includes("horse") || name.includes("ox") || name.includes("stag") || name.includes("moose") || name.includes("dire")) {
    category = "Mounts";
    if (name.includes("horse")) subCategory = "Riding Horse";
    else if (name.includes("ox")) subCategory = "Transport Ox";
    else if (name.includes("stag") || name.includes("moose")) subCategory = "Rare Mount";
    else subCategory = "Other Mount";
  }
  // Weapons
  else if (id.includes("_MAIN_") || id.includes("_2H_") || id.includes("_OFF_")) {
    category = "Weapons";
    if (id.includes("_SWORD")) subCategory = "Swords";
    else if (id.includes("_AXE")) subCategory = "Axes";
    else if (id.includes("_MACE")) subCategory = "Maces";
    else if (id.includes("_HAMMER")) subCategory = "Hammers";
    else if (id.includes("_SPEAR")) subCategory = "Spears";
    else if (id.includes("_BOW")) subCategory = "Bows";
    else if (id.includes("_CROSSBOW")) subCategory = "Crossbows";
    else if (id.includes("_STAFF")) {
      if (id.includes("FIRE")) subCategory = "Fire Staffs";
      else if (id.includes("HOLY")) subCategory = "Holy Staffs";
      else if (id.includes("CURSE")) subCategory = "Cursed Staffs";
      else if (id.includes("FROST")) subCategory = "Frost Staffs";
      else if (id.includes("ARCANE")) subCategory = "Arcane Staffs";
      else if (id.includes("NATURE")) subCategory = "Nature Staffs";
      else subCategory = "Staffs";
    }
    else subCategory = "Other Weapon";
  }
  // Armor
  else if (id.includes("_HEAD_") || id.includes("_ARMOR_") || id.includes("_SHOES_")) {
    category = "Armor";
    if (id.includes("_PLATE_")) subCategory = "Plate Armor";
    else if (id.includes("_LEATHER_")) subCategory = "Leather Armor";
    else if (id.includes("_CLOTH_")) subCategory = "Cloth Armor";
    else subCategory = "Other Armor";
  }
  // Accessories
  else if (id.includes("_BAG") || id.includes("_CAPE")) {
    category = "Accessories";
    if (id.includes("_BAG")) subCategory = "Bags";
    else if (id.includes("_CAPE")) subCategory = "Capes";
  }
  // Consumables (Food & Potions)
  else if (id.includes("_POTION_") || id.includes("_MEAL_") || id.includes("_FOOD_") || id.includes("_COOKED_")) {
    category = "Consumables";
    if (id.includes("_POTION_")) subCategory = "Potions";
    else if (id.includes("_MEAL_") || id.includes("_FOOD_") || id.includes("_COOKED_")) subCategory = "Food";
  }
  // Farm & Animals
  else if (id.includes("_FARM_") || id.includes("_ANIMAL_") || id.includes("_EGG_") || id.includes("_MILK_") || id.includes("_MEAT_")) {
    category = "Farm";
    if (id.includes("_ANIMAL_")) subCategory = "Animals";
    else if (id.includes("_EGG_") || id.includes("_MILK_") || id.includes("_MEAT_")) subCategory = "Animal Products";
    else subCategory = "Farm Products";
  }
  // Resources
  else if (id.includes("_WOOD") || id.includes("_ROCK") || id.includes("_ORE") || id.includes("_FIBER") || id.includes("_HIDE") || id.includes("_PLANKS") || id.includes("_STONEBLOCK") || id.includes("_METALBAR") || id.includes("_CLOTH") || id.includes("_LEATHER")) {
    category = "Resources";
    if (id.includes("_WOOD") || id.includes("_PLANKS")) subCategory = "Wood";
    else if (id.includes("_ROCK") || id.includes("_STONEBLOCK")) subCategory = "Stone";
    else if (id.includes("_ORE") || id.includes("_METALBAR")) subCategory = "Ore";
    else if (id.includes("_FIBER") || id.includes("_CLOTH")) subCategory = "Fiber";
    else if (id.includes("_HIDE") || id.includes("_LEATHER")) subCategory = "Hide";
  }
  // Gathering Tools
  else if (id.includes("_TOOL_")) {
    category = "Gathering Tools";
    if (id.includes("_PICK")) subCategory = "Pickaxe";
    else if (id.includes("_AXE")) subCategory = "Woodaxe";
    else if (id.includes("_SICKLE")) subCategory = "Sickle";
    else if (id.includes("_KNIFE")) subCategory = "Skinning Knife";
    else if (id.includes("_HAMMER")) subCategory = "Stone Hammer";
    else subCategory = "Other Tool";
  }

  return {
    ...item,
    category: category === "Unknown" ? "Other" : category,
    subCategory: subCategory === "Unknown" ? "Other" : subCategory
  };
}

/**
 * Processes a list of items and categorizes them.
 */
export function processItems(items: AlbionItem[]): AlbionItem[] {
  return items.map(categorizeItem);
}
