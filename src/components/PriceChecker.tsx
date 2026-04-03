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
import CraftingRecommendations from "./CraftingRecommendations";
import Library from "./Library";
import { Loader2, Settings, Info, AlertCircle, Globe, Search, TrendingUp, Clock, Filter, Check, ChevronDown, Sparkles, DollarSign, Hammer, Pickaxe, ChefHat, BookOpen, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import itemsDataRaw from "../data/items-lite.json";
import { processItems } from "../lib/item-utils";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);

import { useAuth, SavedSimulation } from "../contexts/AuthContext";
import { useWatchlist } from "../contexts/WatchlistContext";
import AuthModal from "./AuthModal";
import ProfileView from "./ProfileView";

export default function PriceChecker({ server, onServerChange }: { server: AlbionServer; onServerChange?: (s: AlbionServer) => void }) {
  const [activeTab, setActiveTab] = useState<"search" | "opportunities" | "high-value" | "recommendations" | "crafting" | "refining" | "cooking" | "library" | "profile" | "notifications">("search");
  const { user, logout } = useAuth();
  const { notifications } = useWatchlist();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  const unreadNotifications = notifications.filter(n => !n.read).length;
  const [selectedItem, setSelectedItem] = useState<AlbionItem | null>(null);
  const [prices, setPrices] = useState<AlbionPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingItem, setPendingItem] = useState<{ item: AlbionItem; targetTab: string; timestamp: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [showServerSelect, setShowServerSelect] = useState(false);
  const servers: { id: AlbionServer; label: string }[] = [
    { id: "West", label: "Americas (West)" },
    { id: "East", label: "Asia (East)" },
    { id: "Europe", label: "Europe" },
  ];
  
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
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showQualityFilter, setShowQualityFilter] = useState(false);
  const [showSortFilter, setShowSortFilter] = useState(false);
  const [showSubFilter, setShowSubFilter] = useState(false);
  const [showMaxAgeFilter, setShowMaxAgeFilter] = useState(false);

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
    if (!isActive) return "bg-gray-800 text-primary/60 hover:bg-gray-700 hover:text-white";
    switch (level) {
      case 1: return "bg-green-600 text-white shadow-[0_0_10px_rgba(22,163,74,0.3)]";
      case 2: return "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]";
      case 3: return "bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]";
      case 4: return "bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]";
      default: return "bg-primary text-black shadow-[0_0_10px_rgba(212,175,55,0.3)]";
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
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 z-40 bg-[#0a0e14] flex flex-col pt-20 pb-8 bg-gradient-to-b from-primary/10 to-transparent">
        <div className="px-6 mb-8">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => user ? setActiveTab("profile") : (setAuthMode('login'), setShowAuthModal(true))}
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-surface-container-highest flex items-center justify-center border border-primary/20 group-hover:border-primary/50 transition-all">
              <span className="material-symbols-outlined text-primary text-xl">{user ? 'account_circle' : 'login'}</span>
            </div>
            <div className="min-w-0">
              <p className="font-headline font-bold text-sm tracking-widest text-on-surface uppercase whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-primary transition-colors">
                {user ? user.username : 'Sign In'}
              </p>
              <p className="text-[10px] text-primary/60 font-medium tracking-tighter truncate">
                {user ? `Level ${user.stats.contributorLevel} Contributor` : 'Join the community'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          <button onClick={() => setActiveTab("search")} className={`w-full flex items-center gap-4 py-3 px-6 font-headline text-sm uppercase tracking-widest transition-all ${activeTab === "search" ? "text-secondary border-l-4 border-secondary bg-secondary/5 font-bold" : "text-primary/60 hover:text-secondary hover:bg-primary/5"}`}>
            <span className="material-symbols-outlined">search</span> Single Item
          </button>
          
          <button onClick={() => setActiveTab("opportunities")} className={`w-full flex items-center gap-4 py-3 px-6 font-headline text-sm uppercase tracking-widest transition-all ${activeTab === "opportunities" ? "text-secondary border-l-4 border-secondary bg-secondary/5 font-bold" : "text-primary/60 hover:text-secondary hover:bg-primary/5"}`}>
            <span className="material-symbols-outlined">trending_up</span> Top Flips
          </button>
          
          <button onClick={() => setActiveTab("high-value")} className={`w-full flex items-center gap-4 py-3 px-6 font-headline text-sm uppercase tracking-widest transition-all ${activeTab === "high-value" ? "text-secondary border-l-4 border-secondary bg-secondary/5 font-bold" : "text-primary/60 hover:text-secondary hover:bg-primary/5"}`}>
            <span className="material-symbols-outlined">payments</span> High Value
          </button>

          <button onClick={() => setActiveTab("recommendations")} className={`w-full flex items-center gap-4 py-3 px-6 font-headline text-sm uppercase tracking-widest transition-all ${activeTab === "recommendations" ? "text-secondary border-l-4 border-secondary bg-secondary/5 font-bold" : "text-primary/60 hover:text-secondary hover:bg-primary/5"}`}>
            <span className="material-symbols-outlined">bolt</span> Profit Scanner
          </button>

          <div className="py-2 px-6">
            <div className="h-[1px] bg-primary/10 w-full" />
          </div>
          
          <button onClick={() => setActiveTab("crafting")} className={`w-full flex items-center gap-4 py-3 px-6 font-headline text-sm uppercase tracking-widest transition-all ${activeTab === "crafting" ? "text-secondary border-l-4 border-secondary bg-secondary/5 font-bold" : "text-primary/60 hover:text-secondary hover:bg-primary/5"}`}>
            <span className="material-symbols-outlined" style={{fontVariationSettings: activeTab==="crafting"?"'FILL' 1":""}}>humerus</span> Crafting
          </button>
          
          <button onClick={() => setActiveTab("refining")} className={`w-full flex items-center gap-4 py-3 px-6 font-headline text-sm uppercase tracking-widest transition-all ${activeTab === "refining" ? "text-secondary border-l-4 border-secondary bg-secondary/5 font-bold" : "text-primary/60 hover:text-secondary hover:bg-primary/5"}`}>
            <span className="material-symbols-outlined">waves</span> Refining
          </button>
          
          <button onClick={() => setActiveTab("cooking")} className={`w-full flex items-center gap-4 py-3 px-6 font-headline text-sm uppercase tracking-widest transition-all ${activeTab === "cooking" ? "text-secondary border-l-4 border-secondary bg-secondary/5 font-bold" : "text-primary/60 hover:text-secondary hover:bg-primary/5"}`}>
            <span className="material-symbols-outlined">restaurant</span> Cooking
          </button>

          <button onClick={() => setActiveTab("library")} className={`w-full flex items-center gap-4 py-3 px-6 font-headline text-sm uppercase tracking-widest transition-all ${activeTab === "library" ? "text-secondary border-l-4 border-secondary bg-secondary/5 font-bold" : "text-primary/60 hover:text-secondary hover:bg-primary/5"}`}>
            <span className="material-symbols-outlined">menu_book</span> Library
          </button>

          <div className="py-2 px-6">
            <div className="h-[1px] bg-primary/10 w-full" />
          </div>

          <button onClick={() => setActiveTab("notifications")} className={`w-full flex items-center justify-between gap-4 py-3 px-6 font-headline text-sm uppercase tracking-widest transition-all ${activeTab === "notifications" ? "text-secondary border-l-4 border-secondary bg-secondary/5 font-bold" : "text-primary/60 hover:text-secondary hover:bg-primary/5"}`}>
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined">notifications</span> Notifications
            </div>
            {unreadNotifications > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">{unreadNotifications}</span>
            )}
          </button>

          <button onClick={() => setActiveTab("profile")} className={`w-full flex items-center gap-4 py-3 px-6 font-headline text-sm uppercase tracking-widest transition-all ${activeTab === "profile" ? "text-secondary border-l-4 border-secondary bg-secondary/5 font-bold" : "text-primary/60 hover:text-secondary hover:bg-primary/5"}`}>
            <span className="material-symbols-outlined">person</span> My Profile
          </button>
        </nav>

        <div className="mt-auto px-6 space-y-2 border-t border-primary/10 pt-6">
          <a href="#" className="flex items-center gap-3 text-primary/40 text-[10px] uppercase tracking-widest hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-sm">help</span> Support
          </a>
          <a href="https://www.albion-online-data.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-primary/40 text-[10px] uppercase tracking-widest hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-sm">auto_stories</span> API
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 min-h-screen pb-12 w-[calc(100%-16rem)] overflow-x-hidden">
        <header className="fixed top-0 right-0 left-64 z-50 bg-[#0a0e14]/60 backdrop-blur-xl border-b border-primary/15 flex justify-between items-center px-6 h-16 shadow-[0_8px_32px_rgba(15,82,186,0.08)]">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-headline font-bold text-secondary tracking-widest uppercase truncate max-w-[200px] md:max-w-none">Albion Navigator</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative group">
              <button 
                onClick={() => setShowServerSelect(!showServerSelect)}
                className="flex items-center gap-2 bg-surface-container-highest hover:bg-primary/5 border border-primary/10 px-4 py-2 rounded-full transition-all"
              >
                <span className="material-symbols-outlined text-primary text-sm">public</span>
                <span className="text-xs font-bold text-on-surface uppercase tracking-wider hidden sm:block">
                  {servers.find(s => s.id === server)?.label || server}
                </span>
                <span className="material-symbols-outlined text-primary/50 text-xs transition-transform" style={{transform: showServerSelect?"rotate(180deg)":""}}>expand_more</span>
              </button>

              {showServerSelect && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowServerSelect(false)} />
                  <div className="absolute top-full mt-2 right-0 w-48 glass-panel rounded-2xl shadow-2xl z-50 p-2 overflow-hidden">
                    {servers.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          if (onServerChange) onServerChange(s.id);
                          setShowServerSelect(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                          server === s.id 
                          ? "bg-primary/10 text-primary" 
                          : "text-primary/60 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="text-xs font-bold uppercase tracking-widest">{s.label}</span>
                        {server === s.id && <span className="material-symbols-outlined text-sm">check</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 border-l border-primary/15 pl-6">
              <button className="text-primary/70 hover:bg-primary/10 p-2 rounded-lg transition-colors active:scale-95">
                <span className="material-symbols-outlined text-xl">notifications</span>
              </button>
              <button className="text-primary/70 hover:bg-primary/10 p-2 rounded-lg transition-colors active:scale-95">
                <span className="material-symbols-outlined text-xl">settings</span>
              </button>
            </div>
          </div>
        </header>

        <div className="mt-16 p-8 max-w-7xl mx-auto space-y-8">

          {activeTab === "search" && (
            <SearchBar onSelect={(item) => {
              setSelectedItem(item);
            }} />
          )}
          
          {activeTab !== "crafting" && activeTab !== "refining" && activeTab !== "cooking" && activeTab !== "library" && (
            <div className="flex flex-col items-center gap-3 w-full">
              {/* PRIMARY FILTERS ROW */}
              <div className="flex flex-wrap justify-center items-center gap-2 md:gap-3 text-sm w-full">
                <CityFilter selectedCities={selectedCities} onChange={setSelectedCities} />
              
              <div className="flex items-center gap-2 glass-panel p-1 rounded-lg border border-primary/10">
                <Sparkles className="w-3 h-3 text-primary ml-2" />
                <span className="text-[10px] font-bold text-primary/50 uppercase tracking-widest mr-2">Enchant</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((level) => {
                    // Determine if active based on context
                    let isActive = false;
                    if (activeTab === 'search' && selectedItem) {
                      const { enchantment } = getBaseIdAndEnchantment(selectedItem.id);
                      isActive = enchantment === level;
                    } else {
                      isActive = preferredEnchantments.includes(level);
                    }

                    return (
                      <button
                        key={level}
                        onClick={() => {
                          if (activeTab === 'search' && selectedItem) {
                            const { baseId } = getBaseIdAndEnchantment(selectedItem.id);
                            const newId = level === 0 ? baseId : `${baseId}@${level}`;
                            setSelectedItem({ ...selectedItem, id: newId, enchantment: level });
                          } else {
                            handleEnchantmentChange(level);
                          }
                        }}
                        className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold transition-all ${
                          getEnchantmentColor(level, isActive)
                        }`}
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
                  ? "bg-primary/10 border-primary text-primary" 
                  : "glass-panel border-primary/10 text-primary/60 hover:text-white"
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
                  <div className="absolute top-full mt-2 left-0 w-48 glass-panel rounded-xl shadow-2xl z-50 p-2 overflow-hidden">
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
                        <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
                          {q.label}
                        </span>
                        {selectedQualities.includes(q.value as ItemQuality) && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Tab Specific Filters */}
            {activeTab === "search" && (
              <div className="flex items-center gap-3 glass-panel p-2 rounded-lg border border-primary/10">
                <span className="text-primary/60 font-medium px-2 italic">Buy Price:</span>
                <input 
                  type="number"
                  value={buyPrice || ""}
                  onChange={(e) => setBuyPrice(Number(e.target.value))}
                  placeholder="0"
                  className="bg-transparent text-white focus:outline-none w-24 font-mono text-right pr-2"
                />
              </div>
            )}
              </div>

              {/* SECONDARY FILTERS ROW */}
              {activeTab !== "search" && (
              <div className="flex flex-wrap justify-center items-center gap-2 md:gap-3 text-sm mt-1 w-full">
                <div className="relative">
                  <button 
                    onClick={() => setShowSortFilter(!showSortFilter)}
                    className={`flex items-center gap-3 p-2 px-4 rounded-lg border transition-all ${
                      showSortFilter 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "glass-panel border-primary/10 text-primary/60 hover:text-white"
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-bold uppercase tracking-wider text-xs">Sort: {sortBy.toUpperCase()}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showSortFilter ? 'rotate-180' : ''}`} />
                  </button>

                  {showSortFilter && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSortFilter(false)} />
                      <div className="absolute top-full mt-2 left-0 w-48 glass-panel rounded-xl shadow-2xl z-50 p-2 overflow-hidden">
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
                            <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
                              {option.label}
                            </span>
                            {sortBy === option.id && (
                              <Check className="w-4 h-4 text-primary" />
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
                      ? "bg-primary/10 border-primary text-primary" 
                      : "glass-panel border-primary/10 text-primary/60 hover:text-white"
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="font-bold uppercase tracking-wider text-xs">Verification</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showStatusFilter ? 'rotate-180' : ''}`} />
                  </button>

                  {showStatusFilter && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowStatusFilter(false)} />
                      <div className="absolute top-full mt-2 right-0 w-48 glass-panel rounded-xl shadow-2xl z-50 p-2 overflow-hidden">
                        {[
                          { id: 'verified', label: 'Verified', color: 'text-green-500' },
                          { id: 'unknown', label: 'Unknown', color: 'text-primary/60' },
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
                              <Check className="w-4 h-4 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="relative">
                  <button 
                    onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                    className={`flex items-center gap-3 p-2 px-4 rounded-lg border transition-all ${
                      showCategoryFilter 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "glass-panel border-primary/10 text-primary/60 hover:text-white"
                    }`}
                  >
                    <Filter className="w-4 h-4 text-purple-400" />
                    <span className="font-bold uppercase tracking-wider text-xs">Categories</span>
                    <span className="bg-gray-800 text-white px-1.5 py-0.5 rounded text-[10px]">{selectedCategories.includes("All") ? "All" : selectedCategories.length}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showCategoryFilter ? 'rotate-180' : ''}`} />
                  </button>

                  {showCategoryFilter && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowCategoryFilter(false)} />
                      <div className="absolute top-full mt-2 left-0 w-56 glass-panel rounded-xl shadow-2xl z-50 p-2 overflow-hidden">
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
                              <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
                                {cat}
                              </span>
                              {selectedCategories.includes(cat) && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="relative">
                  <button 
                    onClick={() => setShowSubFilter(!showSubFilter)}
                    className={`flex items-center gap-3 p-2 px-4 rounded-lg border transition-all ${
                      showSubFilter 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "glass-panel border-primary/10 text-primary/60 hover:text-white"
                    }`}
                  >
                    <Filter className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold uppercase tracking-wider text-xs">Sub</span>
                    <span className="bg-gray-800 text-white px-1.5 py-0.5 rounded text-[10px]">{selectedSubCategory}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showSubFilter ? 'rotate-180' : ''}`} />
                  </button>

                  {showSubFilter && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSubFilter(false)} />
                      <div className="absolute top-full mt-2 left-0 w-48 glass-panel rounded-xl shadow-2xl z-50 p-2 overflow-hidden">
                        <div className="max-h-64 overflow-y-auto custom-scrollbar">
                          {subCategories.map((sub) => (
                            <button
                              key={sub}
                              onClick={() => {
                                setSelectedSubCategory(sub);
                                setShowSubFilter(false);
                              }}
                              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
                            >
                              <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
                                {sub}
                              </span>
                              {selectedSubCategory === sub && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="relative">
                  <button 
                    onClick={() => setShowMaxAgeFilter(!showMaxAgeFilter)}
                    className={`flex items-center gap-3 p-2 px-4 rounded-lg border transition-all ${
                      showMaxAgeFilter 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "glass-panel border-primary/10 text-primary/60 hover:text-white"
                    }`}
                  >
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span className="font-bold uppercase tracking-wider text-xs">Max Age</span>
                    <span className="bg-gray-800 text-white px-1.5 py-0.5 rounded text-[10px]">
                      {maxAgeHours === 0 ? "Any" : `${maxAgeHours}h`}
                    </span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showMaxAgeFilter ? 'rotate-180' : ''}`} />
                  </button>

                  {showMaxAgeFilter && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMaxAgeFilter(false)} />
                      <div className="absolute top-full mt-2 left-0 w-48 glass-panel rounded-xl shadow-2xl z-50 p-2 overflow-hidden">
                        {[
                          { value: 1, label: "1 Hour" },
                          { value: 6, label: "6 Hours" },
                          { value: 12, label: "12 Hours" },
                          { value: 24, label: "24 Hours" },
                          { value: 0, label: "Any Age" }
                        ].map((age) => (
                          <button
                            key={age.value}
                            onClick={() => {
                              setMaxAgeHours(age.value);
                              setShowMaxAgeFilter(false);
                            }}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
                          >
                            <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
                              {age.label}
                            </span>
                            {maxAgeHours === age.value && (
                              <Check className="w-4 h-4 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          )}

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
        ) : activeTab === "recommendations" ? (
          <motion.div
            key="recommendations"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <CraftingRecommendations server={server} isPremium={isPremium} />
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
            <CookingCalculator 
              server={server} 
              injectedItem={pendingItem} 
              onItemInjected={() => setPendingItem(null)} 
            />
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
        ) : activeTab === "profile" ? (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ProfileView onSelectSimulation={(sim) => {
              setActiveTab(sim.type);
              window.dispatchEvent(new CustomEvent('albion_load_simulation', { detail: sim }));
            }} />
          </motion.div>
        ) : activeTab === "notifications" ? (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ProfileView initialTab="notifs" onSelectSimulation={() => {}} />
          </motion.div>
        ) : selectedItem ? (
          <motion.div
            key={selectedItem.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row items-center gap-6 glass-panel p-8 rounded-3xl">
              <div className="relative group">
                <div className="absolute inset-0 bg-primary blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
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
                  <span className="bg-gray-800 text-on-surface px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Tier {selectedItem.tier}</span>
                  <span className="bg-gray-800 text-on-surface px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{selectedItem.id}</span>
                  <div className="relative group">
                    <span className="bg-gray-800 text-on-surface px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest cursor-help">
                      {selectedItem.category}
                    </span>
                    {selectedItem.category === "Unknown" && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black border border-primary/10 rounded text-[10px] text-primary/60 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        This item's category is not specified in our simplified dataset.
                      </div>
                    )}
                  </div>
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                    {selectedQualities.map(q => qualities.find(x => x.value === q)?.label).join(", ")}
                  </span>
                </div>
              </div>
              <div className="md:ml-auto flex items-center gap-2 text-primary/50 text-xs bg-black/20 p-4 rounded-2xl border border-white/5">
                <Info className="w-4 h-4" />
                <p className="max-w-[200px]">Data is crowdsourced via AODP. Prices may vary slightly from in-game values.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-primary/50 font-mono uppercase tracking-widest animate-pulse">Fetching Market Data...</p>
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
            className="py-32 text-center space-y-4 border-2 border-dashed border-primary/10 rounded-3xl"
          >
            <div className="glass-panel w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20">
              <Settings className="w-10 h-10 text-gray-600 animate-spin-slow" />
            </div>
            <h3 className="text-2xl font-bold text-primary/50 uppercase tracking-widest">Select an item to begin</h3>
            <p className="text-gray-600 max-w-xs mx-auto">Use the search bar above to find items from the Royal Cities and Caerleon.</p>
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
