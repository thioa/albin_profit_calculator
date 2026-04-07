import { useState, useEffect, useMemo } from "react";
import { ItemQuality, AlbionCity, ALBION_CITIES } from "../types/albion";
import { VerificationStatus, SortOption } from "../components/features/TopFlipping";
import itemsDataRaw from "../data/items-lite.json";
import { processItems } from "../lib/item-utils";

const itemsData = processItems(itemsDataRaw as any[]);

export function useFilters() {
  const [isPremium, setIsPremium] = useState(() => {
    const saved = localStorage.getItem("albion_is_premium");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [selectedQualities, setSelectedQualities] = useState<ItemQuality[]>(() => {
    const saved = localStorage.getItem("albion_qualities");
    return saved !== null ? JSON.parse(saved) : [1];
  });

  const [selectedCities, setSelectedCities] = useState<AlbionCity[]>(() => {
    const saved = localStorage.getItem("albion_cities");
    return saved !== null ? JSON.parse(saved) : [...ALBION_CITIES];
  });

  const [maxAgeHours, setMaxAgeHours] = useState<number>(() => {
    const saved = localStorage.getItem("albion_max_age");
    return saved !== null ? JSON.parse(saved) : 24;
  });

  const [hideSuspicious, setHideSuspicious] = useState<boolean>(() => {
    const saved = localStorage.getItem("albion_hide_suspicious");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [allowedStatuses, setAllowedStatuses] = useState<VerificationStatus[]>(() => {
    const saved = localStorage.getItem("albion_allowed_statuses");
    return saved !== null ? JSON.parse(saved) : ['verified', 'unknown'];
  });

  const [preferredEnchantments, setPreferredEnchantments] = useState<number[]>(() => {
    const saved = localStorage.getItem("albion_preferred_enchantments");
    return saved !== null ? JSON.parse(saved) : [0, 1, 2, 3, 4];
  });

  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem("albion_selected_categories");
    return saved !== null ? JSON.parse(saved) : ["All"];
  });

  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(() => {
    const saved = localStorage.getItem("albion_selected_sub_category");
    return saved || "All";
  });

  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem("albion_sort_by");
    return (saved as SortOption) || 'profit';
  });

  const [buyPrice, setBuyPrice] = useState<number>(0);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem("albion_is_premium", JSON.stringify(isPremium));
    localStorage.setItem("albion_qualities", JSON.stringify(selectedQualities));
    localStorage.setItem("albion_cities", JSON.stringify(selectedCities));
    localStorage.setItem("albion_max_age", JSON.stringify(maxAgeHours));
    localStorage.setItem("albion_hide_suspicious", JSON.stringify(hideSuspicious));
    localStorage.setItem("albion_allowed_statuses", JSON.stringify(allowedStatuses));
    localStorage.setItem("albion_preferred_enchantments", JSON.stringify(preferredEnchantments));
    localStorage.setItem("albion_selected_categories", JSON.stringify(selectedCategories));
    localStorage.setItem("albion_selected_sub_category", selectedSubCategory);
    localStorage.setItem("albion_sort_by", sortBy);
  }, [isPremium, selectedQualities, selectedCities, maxAgeHours, hideSuspicious, allowedStatuses, preferredEnchantments, selectedCategories, selectedSubCategory, sortBy]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    cats.add("All");
    itemsData.forEach(item => {
      if (item.category && item.category !== "Unknown") cats.add(item.category);
    });
    return Array.from(cats).sort();
  }, []);

  const subCategories = useMemo(() => {
    const subs = new Set<string>();
    subs.add("All");
    itemsData.forEach(item => {
      if (!selectedCategories.includes("All") && !selectedCategories.includes(item.category)) return;
      if (item.subCategory && item.subCategory !== "Unknown") subs.add(item.subCategory);
    });
    return Array.from(subs).sort();
  }, [selectedCategories]);

  return {
    isPremium,
    setIsPremium,
    selectedQualities,
    setSelectedQualities,
    selectedCities,
    setSelectedCities,
    maxAgeHours,
    setMaxAgeHours,
    hideSuspicious,
    setHideSuspicious,
    allowedStatuses,
    setAllowedStatuses,
    preferredEnchantments,
    setPreferredEnchantments,
    selectedCategories,
    setSelectedCategories,
    selectedSubCategory,
    setSelectedSubCategory,
    sortBy,
    setSortBy,
    buyPrice,
    setBuyPrice,
    categories,
    subCategories,
  };
}
