import { useState, useEffect, useMemo } from "react";
import { AlbionItem, AlbionPrice, ALBION_CITIES, ItemQuality, AlbionCity, AlbionServer } from "../types/albion";
import { fetchPrices, fetchHistory } from "../lib/albion-api";
import SearchBar from "./SearchBar";
import PriceCard from "./PriceCard";
import CityFilter from "./CityFilter";
import MarketOpportunities, { VerificationStatus, SortOption } from "./MarketOpportunities";
import HighValueSales from "./HighValueSales";
import CraftingCalculator from "./CraftingCalculator";
import RefiningCalculator from "./RefiningCalculator";
import CookingCalculator from "./CookingCalculator";
import Library from "./Library";
import { Loader2, Settings, Info, AlertCircle, Globe, Search, TrendingUp, Clock, Filter, Check, ChevronDown, Sparkles, DollarSign, Hammer, Pickaxe, ChefHat, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import itemsDataRaw from "../data/items-lite.json";
import { processItems } from "../lib/item-utils";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);

export default function PriceChecker({ server }: { server: AlbionServer }) {
  const [activeTab, setActiveTab] = useState<"search" | "opportunities" | "high-value" | "crafting" | "refining" | "cooking" | "library">("search");
  const [selectedItem, setSelectedItem] = useState<AlbionItem | null>(null);
  const [prices, setPrices] = useState<AlbionPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingItem, setPendingItem] = useState<{ item: AlbionItem; targetTab: string; timestamp: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Persistent Filters
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
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [buyCity, setBuyCity] = useState<string | null>(null);
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

  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showQualityFilter, setShowQualityFilter] = useState(false);
  const [showSortFilter, setShowSortFilter] = useState(false);

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

  const getBaseIdAndEnchantment = (id: string) => {
    const parts = id.split("@");
    return {
      baseId: parts[0],
      enchantment: parts.length > 1 ? parseInt(parts[1]) : 0
    };
  };

  const handleEnchantmentChange = (level: number) => {
    let newEnchantments: number[];
    if (preferredEnchantments.includes(level)) {
      if (preferredEnchantments.length > 1) {
        newEnchantments = preferredEnchantments.filter(e => e !== level);
      } else {
        newEnchantments = preferredEnchantments;
      }
    } else {
      newEnchantments = [...preferredEnchantments, level];
    }
    setPreferredEnchantments(newEnchantments);
  };

  const getEnchantmentColor = (level: number, isActive: boolean) => {
    if (!isActive) return "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white";
    switch (level) {
      case 1: return "bg-green-600 text-white shadow-[0_0_10px_rgba(22,163,74,0.3)]";
      case 2: return "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]";
      case 3: return "bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]";
      case 4: return "bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]";
      default: return "bg-[#D4AF37] text-black shadow-[0_0_10px_rgba(212,175,55,0.3)]";
    }
  };

  const qualities = [
    { value: 1, label: "Normal" },
    { value: 2, label: "Good" },
    { value: 3, label: "Outstanding" },
    { value: 4, label: "Excellent" },
    { value: 5, label: "Masterpiece" },
  ];

  useEffect(() => {
    if (selectedItem) {
      loadPrices();
    }
  }, [selectedItem, selectedQualities, selectedCities, server]);

  useEffect(() => {
    if (buyCity) {
      const sourcePrice = prices.find(p => p.city === buyCity);
      if (sourcePrice && sourcePrice.sell_price_min > 0) {
        setBuyPrice(sourcePrice.sell_price_min);
      }
    }
  }, [buyCity, prices]);

  const loadPrices = async () => {
    if (!selectedItem) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPrices(selectedItem.id, selectedCities, selectedQualities, server);
      
      // Fetch history for all selected cities and qualities to provide context
      let historyData: any[] = [];
      try {
        historyData = await fetchHistory(selectedItem.id, selectedCities, selectedQualities, server);
        console.log(`Fetched history for ${selectedItem.id}:`, historyData.length, "entries found");
      } catch (hErr) {
        console.error("Failed to fetch history context", hErr);
      }

      // Sort by city to keep order consistent based on selection
      const sorted = selectedCities.map(city => {
        const found = data.find(p => p.city === city);
        const targetQuality = found ? found.quality : (selectedQualities[0] || 1);
        
        // Find history for this city and quality with robust matching
        const history = historyData.find(h => {
          const hLoc = h.location.toLowerCase().replace(/\s/g, "");
          const cLoc = city.toLowerCase().replace(/\s/g, "");
          return hLoc === cLoc && h.quality === targetQuality;
        });
        
        // Calculate historical average
        let historical_avg = undefined;
        let historical_count = 0;
        if (history && history.data && history.data.length > 0) {
          const sum = history.data.reduce((acc: number, curr: any) => acc + curr.avg_price, 0);
          historical_avg = Math.round(sum / history.data.length);
          historical_count = history.data.reduce((acc: number, curr: any) => acc + curr.item_count, 0);
        }

        return {
          ...(found || {
            item_id: selectedItem.id,
            city,
            quality: selectedQualities[0] || 1,
            sell_price_min: 0,
            sell_price_min_date: "",
            sell_price_max: 0,
            sell_price_max_date: "",
            buy_price_min: 0,
            buy_price_min_date: "",
            buy_price_max: 0,
            buy_price_max_date: "",
          }),
          historical_avg,
          historical_count
        };
      });
      setPrices(sorted);
    } catch (err) {
      setError("Failed to fetch market data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleAddCraftItem = (e: Event) => {
      const customEvent = e as CustomEvent<{ item: AlbionItem; targetTab: string; timestamp: number }>;
      if (['crafting', 'refining', 'cooking'].includes(customEvent.detail.targetTab)) {
        setActiveTab(customEvent.detail.targetTab as any);
        setPendingItem(customEvent.detail);
      }
    };
    window.addEventListener('albion_add_craft_item', handleAddCraftItem);
    return () => window.removeEventListener('albion_add_craft_item', handleAddCraftItem);
  }, []);

  const lowestSellPrice = Math.min(
    ...prices
      .filter(p => p.sell_price_min > 0)
      .map(p => p.sell_price_min)
  );

  return (
    <div className="space-y-12">
      <section className="text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic">
            Market <span className="text-[#D4AF37]">Insight</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Real-time price tracking and profit calculation for the Albion Online economy.
          </p>
        </motion.div>

        <div className="flex flex-col gap-6">
          <div className="flex justify-center gap-4 mb-4">
            <button 
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest transition-all ${
                activeTab === "search" 
                ? "bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]" 
                : "bg-[#1e1e1e] text-gray-400 border border-gray-800 hover:border-gray-600"
              }`}
            >
              <Search className="w-4 h-4" />
              Single Item
            </button>
            <button 
              onClick={() => setActiveTab("opportunities")}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest transition-all ${
                activeTab === "opportunities" 
                ? "bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]" 
                : "bg-[#1e1e1e] text-gray-400 border border-gray-800 hover:border-gray-600"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Top Flips
            </button>
            <button 
              onClick={() => setActiveTab("high-value")}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest transition-all ${
                activeTab === "high-value" 
                ? "bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]" 
                : "bg-[#1e1e1e] text-gray-400 border border-gray-800 hover:border-gray-600"
              }`}
            >
              <DollarSign className="w-4 h-4" />
              High Value
            </button>
            <button 
              onClick={() => setActiveTab("crafting")}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest transition-all ${
                activeTab === "crafting" 
                ? "bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]" 
                : "bg-[#1e1e1e] text-gray-400 border border-gray-800 hover:border-gray-600"
              }`}
            >
              <Hammer className="w-4 h-4" />
              Crafting
            </button>
            <button 
              onClick={() => setActiveTab("refining")}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest transition-all ${
                activeTab === "refining" 
                ? "bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]" 
                : "bg-[#1e1e1e] text-gray-400 border border-gray-800 hover:border-gray-600"
              }`}
            >
              <Pickaxe className="w-4 h-4" />
              Refining
            </button>
            <button 
              onClick={() => setActiveTab("cooking")}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest transition-all ${
                activeTab === "cooking" 
                ? "bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]" 
                : "bg-[#1e1e1e] text-gray-400 border border-gray-800 hover:border-gray-600"
              }`}
            >
              <ChefHat className="w-4 h-4" />
              Cooking
            </button>
            <button 
              onClick={() => setActiveTab("library")}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest transition-all ${
                activeTab === "library" 
                ? "bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]" 
                : "bg-[#1e1e1e] text-gray-400 border border-gray-800 hover:border-gray-600"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Library
            </button>
          </div>

          {activeTab === "search" && (
            <SearchBar onSelect={(item) => {
              setSelectedItem(item);
            }} />
          )}
          
          {activeTab !== "crafting" && activeTab !== "refining" && activeTab !== "cooking" && activeTab !== "library" && (
            <div className="flex flex-wrap justify-center items-center gap-4 text-sm">
              {/* Common Filters */}
              <CityFilter selectedCities={selectedCities} onChange={setSelectedCities} />
              
              <div className="flex items-center gap-2 bg-[#1e1e1e] p-1 rounded-lg border border-gray-800">
                <Sparkles className="w-3 h-3 text-[#D4AF37] ml-2" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mr-2">Enchant</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((level) => {
                    // Check if this enchantment level is valid for the CURRENTLY selected item if one exists
                    let exists = true;
                    if (selectedItem) {
                      const { baseId } = getBaseIdAndEnchantment(selectedItem.id);
                      const targetId = level === 0 ? baseId : `${baseId}@${level}`;
                      exists = (itemsData as AlbionItem[]).some(item => item.id === targetId);
                    }

                    return (
                      <button
                        key={level}
                        disabled={!exists}
                        onClick={() => handleEnchantmentChange(level)}
                        className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold transition-all ${
                          getEnchantmentColor(level, preferredEnchantments.includes(level))
                        } ${!exists ? "opacity-20 cursor-not-allowed" : ""}`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowQualityFilter(!showQualityFilter)}
                className={`flex items-center gap-3 p-2 px-4 rounded-lg border transition-all ${
                  showQualityFilter 
                  ? "bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]" 
                  : "bg-[#1e1e1e] border-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="font-bold uppercase tracking-wider text-xs">Quality</span>
                <span className="bg-gray-800 text-white px-1.5 py-0.5 rounded text-[10px]">{selectedQualities.length}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showQualityFilter ? 'rotate-180' : ''}`} />
              </button>

              {showQualityFilter && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowQualityFilter(false)} />
                  <div className="absolute top-full mt-2 left-0 w-48 bg-[#1e1e1e] border border-gray-800 rounded-xl shadow-2xl z-50 p-2 overflow-hidden">
                    {qualities.map((q) => (
                      <button
                        key={q.value}
                        onClick={() => {
                          const val = q.value as ItemQuality;
                          if (selectedQualities.includes(val)) {
                            if (selectedQualities.length > 1) {
                              setSelectedQualities(selectedQualities.filter(x => x !== val));
                            }
                          } else {
                            setSelectedQualities([...selectedQualities, val]);
                          }
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
                      >
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-300">
                          {q.label}
                        </span>
                        {selectedQualities.includes(q.value as ItemQuality) && (
                          <Check className="w-4 h-4 text-[#D4AF37]" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Tab Specific Filters */}
            {activeTab === "search" ? (
              <div className="flex items-center gap-3 bg-[#1e1e1e] p-2 rounded-lg border border-gray-800">
                <span className="text-gray-400 font-medium px-2 italic">Buy Price:</span>
                <input 
                  type="number"
                  value={buyPrice || ""}
                  onChange={(e) => setBuyPrice(Number(e.target.value))}
                  placeholder="0"
                  className="bg-transparent text-white focus:outline-none w-24 font-mono text-right pr-2"
                />
              </div>
            ) : (
              <>
                <div className="relative">
                  <button 
                    onClick={() => setShowSortFilter(!showSortFilter)}
                    className={`flex items-center gap-3 p-2 px-4 rounded-lg border transition-all ${
                      showSortFilter 
                      ? "bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]" 
                      : "bg-[#1e1e1e] border-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-bold uppercase tracking-wider text-xs">Sort: {sortBy.toUpperCase()}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showSortFilter ? 'rotate-180' : ''}`} />
                  </button>

                  {showSortFilter && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSortFilter(false)} />
                      <div className="absolute top-full mt-2 left-0 w-48 bg-[#1e1e1e] border border-gray-800 rounded-xl shadow-2xl z-50 p-2 overflow-hidden">
                        {[
                          { id: 'profit', label: 'Profit' },
                          { id: 'roi', label: 'ROI %' },
                          { id: 'demand', label: 'Demand' },
                          { id: 'freshness', label: 'Freshness' }
                        ].map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              setSortBy(option.id as SortOption);
                              setShowSortFilter(false);
                            }}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
                          >
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-300">
                              {option.label}
                            </span>
                            {sortBy === option.id && (
                              <Check className="w-4 h-4 text-[#D4AF37]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="relative">
                  <button 
                    onClick={() => setShowStatusFilter(!showStatusFilter)}
                    className={`flex items-center gap-3 p-2 px-4 rounded-lg border transition-all ${
                      showStatusFilter 
                      ? "bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]" 
                      : "bg-[#1e1e1e] border-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="font-bold uppercase tracking-wider text-xs">Verification</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showStatusFilter ? 'rotate-180' : ''}`} />
                  </button>

                  {showStatusFilter && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowStatusFilter(false)} />
                      <div className="absolute top-full mt-2 right-0 w-48 bg-[#1e1e1e] border border-gray-800 rounded-xl shadow-2xl z-50 p-2 overflow-hidden">
                        {[
                          { id: 'verified', label: 'Verified', color: 'text-green-500' },
                          { id: 'unknown', label: 'Unknown', color: 'text-gray-400' },
                          { id: 'suspicious', label: 'Suspicious', color: 'text-red-500' }
                        ].map((status) => (
                          <button
                            key={status.id}
                            onClick={() => {
                              const s = status.id as VerificationStatus;
                              if (allowedStatuses.includes(s)) {
                                if (allowedStatuses.length > 1) {
                                  setAllowedStatuses(allowedStatuses.filter(x => x !== s));
                                }
                              } else {
                                setAllowedStatuses([...allowedStatuses, s]);
                              }
                            }}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
                          >
                            <span className={`text-xs font-bold uppercase tracking-widest ${status.color}`}>
                              {status.label}
                            </span>
                            {allowedStatuses.includes(status.id as VerificationStatus) && (
                              <Check className="w-4 h-4 text-[#D4AF37]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="relative">
                  <button 
                    onClick={() => setShowStatusFilter(!showStatusFilter)}
                    className={`flex items-center gap-3 p-2 px-4 rounded-lg border transition-all ${
                      showStatusFilter 
                      ? "bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]" 
                      : "bg-[#1e1e1e] border-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="font-bold uppercase tracking-wider text-xs">Categories</span>
                    <span className="bg-gray-800 text-white px-1.5 py-0.5 rounded text-[10px]">{selectedCategories.includes("All") ? "All" : selectedCategories.length}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showStatusFilter ? 'rotate-180' : ''}`} />
                  </button>

                  {showStatusFilter && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowStatusFilter(false)} />
                      <div className="absolute top-full mt-2 left-0 w-56 bg-[#1e1e1e] border border-gray-800 rounded-xl shadow-2xl z-50 p-2 overflow-hidden">
                        <div className="max-h-64 overflow-y-auto custom-scrollbar">
                          {categories.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => {
                                if (cat === "All") {
                                  setSelectedCategories(["All"]);
                                } else {
                                  let newCats = selectedCategories.filter(c => c !== "All");
                                  if (newCats.includes(cat)) {
                                    if (newCats.length > 1) {
                                      newCats = newCats.filter(c => c !== cat);
                                    } else {
                                      newCats = ["All"];
                                    }
                                  } else {
                                    newCats = [...newCats, cat];
                                  }
                                  setSelectedCategories(newCats);
                                }
                                setSelectedSubCategory("All");
                              }}
                              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
                            >
                              <span className="text-xs font-bold uppercase tracking-widest text-gray-300">
                                {cat}
                              </span>
                              {selectedCategories.includes(cat) && (
                                <Check className="w-4 h-4 text-[#D4AF37]" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 bg-[#1e1e1e] p-2 rounded-lg border border-gray-800">
                  <Filter className="w-4 h-4 text-indigo-400 ml-2" />
                  <span className="text-gray-400 font-medium whitespace-nowrap">Sub:</span>
                  <select 
                    value={selectedSubCategory}
                    onChange={(e) => setSelectedSubCategory(e.target.value)}
                    className="bg-transparent text-white focus:outline-none cursor-pointer pr-2 font-bold text-xs"
                  >
                    {subCategories.map(sub => (
                      <option key={sub} value={sub} className="bg-[#1e1e1e]">{sub}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 bg-[#1e1e1e] p-2 rounded-lg border border-gray-800">
                  <Clock className="w-4 h-4 text-blue-400 ml-2" />
                  <span className="text-gray-400 font-medium whitespace-nowrap">Max Age:</span>
                  <select 
                    value={maxAgeHours}
                    onChange={(e) => setMaxAgeHours(Number(e.target.value))}
                    className="bg-transparent text-white focus:outline-none cursor-pointer pr-2 font-bold"
                  >
                    <option value={1} className="bg-[#1e1e1e]">1 Hour</option>
                    <option value={6} className="bg-[#1e1e1e]">6 Hours</option>
                    <option value={12} className="bg-[#1e1e1e]">12 Hours</option>
                    <option value={24} className="bg-[#1e1e1e]">24 Hours</option>
                    <option value={0} className="bg-[#1e1e1e]">Any Age</option>
                  </select>
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </section>

      <AnimatePresence mode="wait">
        {activeTab === "opportunities" ? (
          <motion.div
            key="opportunities"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <MarketOpportunities 
              server={server} 
              selectedCities={selectedCities} 
              qualities={selectedQualities} 
              maxAgeHours={maxAgeHours}
              hideSuspicious={hideSuspicious}
              allowedStatuses={allowedStatuses}
              preferredEnchantments={preferredEnchantments}
              selectedCategories={selectedCategories}
              selectedSubCategory={selectedSubCategory}
              sortBy={sortBy}
            />
          </motion.div>
        ) : activeTab === "high-value" ? (
          <motion.div
            key="high-value"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <HighValueSales server={server} />
          </motion.div>
        ) : activeTab === "crafting" ? (
          <motion.div
            key="crafting"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <CraftingCalculator server={server} injectedItem={pendingItem} onItemInjected={() => setPendingItem(null)} />
          </motion.div>
        ) : activeTab === "refining" ? (
          <motion.div
            key="refining"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <RefiningCalculator server={server} injectedItem={pendingItem} onItemInjected={() => setPendingItem(null)} />
          </motion.div>
        ) : activeTab === "cooking" ? (
          <motion.div
            key="cooking"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <CookingCalculator server={server} injectedItem={pendingItem} onItemInjected={() => setPendingItem(null)} />
          </motion.div>
        ) : activeTab === "library" ? (
          <motion.div
            key="library"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Library />
          </motion.div>
        ) : selectedItem ? (
          <motion.div
            key={selectedItem.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row items-center gap-6 bg-[#1e1e1e] border border-gray-800 p-8 rounded-3xl">
              <div className="relative group">
                <div className="absolute inset-0 bg-[#D4AF37] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
                <img 
                  src={selectedItem.icon} 
                  alt={selectedItem.name} 
                  className="w-32 h-32 object-contain relative z-10"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-center md:text-left space-y-2">
                <h2 className="text-4xl font-black text-white uppercase italic tracking-tight">{selectedItem.name}</h2>
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                  <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Tier {selectedItem.tier}</span>
                  <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{selectedItem.id}</span>
                  <div className="relative group">
                    <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest cursor-help">
                      {selectedItem.category}
                    </span>
                    {selectedItem.category === "Unknown" && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black border border-gray-800 rounded text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        This item's category is not specified in our simplified dataset.
                      </div>
                    )}
                  </div>
                  <span className="bg-[#D4AF37]/10 text-[#D4AF37] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                    {selectedQualities.map(q => qualities.find(x => x.value === q)?.label).join(", ")}
                  </span>
                </div>
              </div>
              <div className="md:ml-auto flex items-center gap-2 text-gray-500 text-xs bg-black/20 p-4 rounded-2xl border border-white/5">
                <Info className="w-4 h-4" />
                <p className="max-w-[200px]">Data is crowdsourced via AODP. Prices may vary slightly from in-game values.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin" />
                <p className="text-gray-500 font-mono uppercase tracking-widest animate-pulse">Fetching Market Data...</p>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-3xl text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <p className="text-red-500 font-bold">{error}</p>
                <button onClick={loadPrices} className="bg-red-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-600 transition-colors">Retry</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {prices.map((price) => (
                  <PriceCard 
                    key={price.city} 
                    price={price} 
                    isPremium={isPremium}
                    buyPrice={buyPrice}
                    isLowest={price.sell_price_min > 0 && price.sell_price_min === lowestSellPrice}
                    isBuyCity={buyCity === price.city}
                    onSetBuyCity={() => setBuyCity(price.city)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-32 text-center space-y-4 border-2 border-dashed border-gray-800 rounded-3xl"
          >
            <div className="bg-[#1e1e1e] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-700">
              <Settings className="w-10 h-10 text-gray-600 animate-spin-slow" />
            </div>
            <h3 className="text-2xl font-bold text-gray-500 uppercase tracking-widest">Select an item to begin</h3>
            <p className="text-gray-600 max-w-xs mx-auto">Use the search bar above to find items from the Royal Cities and Caerleon.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
