import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { AlbionCity, AlbionItem, ItemQuality, ALBION_CITIES } from "../types/albion";
import { VerificationStatus, SortOption } from "../components/features/TopFlipping";
import itemsDataRaw from "../data/items-lite.json";
import { processItems } from "../lib/item-utils";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);

// ─── Types ──────────────────────────────────────────────────────────
export interface FilterContextValue {
  // Cities & Quality
  selectedCities: AlbionCity[];
  setSelectedCities: (v: AlbionCity[]) => void;
  selectedQualities: ItemQuality[];
  setSelectedQualities: (v: ItemQuality[]) => void;

  // Enchantments
  preferredEnchantments: number[];
  setPreferredEnchantments: (v: number[]) => void;
  handleEnchantmentChange: (level: number) => void;
  getEnchantmentColor: (level: number, isActive: boolean) => string;
  getBaseIdAndEnchantment: (id: string) => { baseId: string; enchantment: number };

  // Categories
  selectedCategories: string[];
  setSelectedCategories: (v: string[]) => void;
  selectedSubCategory: string;
  setSelectedSubCategory: (v: string) => void;
  categories: string[];
  subCategories: string[];

  // Sorting & Filters
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  maxAgeHours: number;
  setMaxAgeHours: (v: number) => void;
  allowedStatuses: VerificationStatus[];
  setAllowedStatuses: (v: VerificationStatus[]) => void;
  hideSuspicious: boolean;
  setHideSuspicious: (v: boolean) => void;

  // Buy price (for Single Item)
  buyPrice: number;
  setBuyPrice: (v: number) => void;
  buyCity: string | null;
  setBuyCity: (v: string | null) => void;

  // Quality list (for dropdowns)
  qualities: { value: number; label: string }[];

  // Dropdown visibility
  showStatusFilter: boolean; setShowStatusFilter: (v: boolean) => void;
  showCategoryFilter: boolean; setShowCategoryFilter: (v: boolean) => void;
  showQualityFilter: boolean; setShowQualityFilter: (v: boolean) => void;
  showSortFilter: boolean; setShowSortFilter: (v: boolean) => void;
  showSubFilter: boolean; setShowSubFilter: (v: boolean) => void;
  showMaxAgeFilter: boolean; setShowMaxAgeFilter: (v: boolean) => void;
}

// ─── Context ────────────────────────────────────────────────────────
const FilterContext = createContext<FilterContextValue | null>(null);

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used inside <FilterProvider>");
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────
export function FilterProvider({ children }: { children: ReactNode }) {
  // Persistent state — load from localStorage on init
  const [selectedQualities, setSelectedQualities] = useState<ItemQuality[]>(() => {
    const s = localStorage.getItem("albion_qualities");
    return s ? JSON.parse(s) : [1];
  });
  const [selectedCities, setSelectedCities] = useState<AlbionCity[]>(() => {
    const s = localStorage.getItem("albion_cities");
    return s ? JSON.parse(s) : [...ALBION_CITIES];
  });
  const [maxAgeHours, setMaxAgeHours] = useState<number>(() => {
    const s = localStorage.getItem("albion_max_age");
    return s ? JSON.parse(s) : 24;
  });
  const [hideSuspicious, setHideSuspicious] = useState<boolean>(() => {
    const s = localStorage.getItem("albion_hide_suspicious");
    return s ? JSON.parse(s) : true;
  });
  const [allowedStatuses, setAllowedStatuses] = useState<VerificationStatus[]>(() => {
    const s = localStorage.getItem("albion_allowed_statuses");
    return s ? JSON.parse(s) : ['verified', 'unknown'];
  });
  const [preferredEnchantments, setPreferredEnchantments] = useState<number[]>(() => {
    const s = localStorage.getItem("albion_preferred_enchantments");
    return s ? JSON.parse(s) : [0, 1, 2, 3, 4];
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const s = localStorage.getItem("albion_selected_categories");
    return s ? JSON.parse(s) : ["All"];
  });
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(() => {
    return localStorage.getItem("albion_selected_sub_category") || "All";
  });
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    return (localStorage.getItem("albion_sort_by") as SortOption) || 'profit';
  });

  // Not persisted
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [buyCity, setBuyCity] = useState<string | null>(null);

  // Dropdown open/close state
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showQualityFilter, setShowQualityFilter] = useState(false);
  const [showSortFilter, setShowSortFilter] = useState(false);
  const [showSubFilter, setShowSubFilter] = useState(false);
  const [showMaxAgeFilter, setShowMaxAgeFilter] = useState(false);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem("albion_qualities", JSON.stringify(selectedQualities));
    localStorage.setItem("albion_cities", JSON.stringify(selectedCities));
    localStorage.setItem("albion_max_age", JSON.stringify(maxAgeHours));
    localStorage.setItem("albion_hide_suspicious", JSON.stringify(hideSuspicious));
    localStorage.setItem("albion_allowed_statuses", JSON.stringify(allowedStatuses));
    localStorage.setItem("albion_preferred_enchantments", JSON.stringify(preferredEnchantments));
    localStorage.setItem("albion_selected_categories", JSON.stringify(selectedCategories));
    localStorage.setItem("albion_selected_sub_category", selectedSubCategory);
    localStorage.setItem("albion_sort_by", sortBy);
  }, [selectedQualities, selectedCities, maxAgeHours, hideSuspicious, allowedStatuses,
      preferredEnchantments, selectedCategories, selectedSubCategory, sortBy]);

  // Computed category/subcategory lists
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

  // Enchantment helpers
  const getBaseIdAndEnchantment = (id: string) => {
    const parts = id.split("@");
    return { baseId: parts[0], enchantment: parts.length > 1 ? parseInt(parts[1]) : 0 };
  };

  const handleEnchantmentChange = (level: number) => {
    setPreferredEnchantments(prev => {
      if (prev.includes(level)) {
        return prev.length > 1 ? prev.filter(e => e !== level) : prev;
      }
      return [...prev, level];
    });
  };

  const getEnchantmentColor = (level: number, isActive: boolean) => {
    if (!isActive) return "bg-gray-800 text-primary/60 hover:bg-gray-700 hover:text-white";
    switch (level) {
      case 1: return "bg-green-600 text-white shadow-glow-green";
      case 2: return "bg-blue-600 text-white shadow-glow-blue";
      case 3: return "bg-blue-600 text-white shadow-glow-blue";
      case 4: return "bg-yellow-500 text-black shadow-glow-yellow";
      default: return "bg-primary text-black shadow-glow-primary";
    }
  };

  const qualities = [
    { value: 1, label: "Normal" },
    { value: 2, label: "Good" },
    { value: 3, label: "Outstanding" },
    { value: 4, label: "Excellent" },
    { value: 5, label: "Masterpiece" },
  ];

  return (
    <FilterContext.Provider value={{
      selectedCities, setSelectedCities,
      selectedQualities, setSelectedQualities,
      preferredEnchantments, setPreferredEnchantments,
      handleEnchantmentChange, getEnchantmentColor, getBaseIdAndEnchantment,
      selectedCategories, setSelectedCategories,
      selectedSubCategory, setSelectedSubCategory,
      categories, subCategories,
      sortBy, setSortBy,
      maxAgeHours, setMaxAgeHours,
      allowedStatuses, setAllowedStatuses,
      hideSuspicious, setHideSuspicious,
      buyPrice, setBuyPrice,
      buyCity, setBuyCity,
      qualities,
      showStatusFilter, setShowStatusFilter,
      showCategoryFilter, setShowCategoryFilter,
      showQualityFilter, setShowQualityFilter,
      showSortFilter, setShowSortFilter,
      showSubFilter, setShowSubFilter,
      showMaxAgeFilter, setShowMaxAgeFilter,
    }}>
      {children}
    </FilterContext.Provider>
  );
}
