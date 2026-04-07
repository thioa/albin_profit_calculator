import { useState, useEffect } from "react";
import { AlbionItem, AlbionServer } from "../../types/albion";
import SearchBar from "../common/SearchBar";
import PriceCard from "../common/PriceCard";
import TopFlipping from "../features/TopFlipping";
import MarketPulse from "../features/MarketPulse";
import CraftingCalculator from "../calculators/CraftingCalculator";
import RefiningCalculator from "../calculators/RefiningCalculator";
import CookingCalculator from "../calculators/CookingCalculator";
import ProfitScanner from "../features/ProfitScanner";
import Library from "../library/Library";
import PrimaryFilters from "../market/PrimaryFilters";
import SecondaryFilters from "../market/SecondaryFilters";
import { useFilters } from "../../hooks/useFilters";
import { useMarketData } from "../../hooks/useMarketData";
import { Loader2, Settings, Info, AlertCircle, Globe, Search, TrendingUp, Clock, Filter, Check, ChevronDown, Sparkles, Hammer, Pickaxe, ChefHat, BookOpen, Zap, Clipboard, Menu, SlidersHorizontal, Bell } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import itemsDataRaw from "../../data/items-lite.json";
import { processItems } from "../../lib/item-utils";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);

import { useAuth, SavedSimulation } from "../../contexts/AuthContext";
import { useWatchlist } from "../../contexts/WatchlistContext";
import AuthModal from "../auth/AuthModal";
import ProfileView from "../auth/ProfileView";
import MyCrafting from "../features/MyCrafting";
import { motion, AnimatePresence } from "motion/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";

// Navigation data
const navMain = [
  {
    title: "Market",
    items: [
      { id: "search", label: "Price Checker", icon: Search as LucideIcon },
      { id: "top-flipping", label: "Top Flipping", icon: TrendingUp as LucideIcon, badge: "New!" },
      { id: "profit-scanner", label: "Profit Scanner", icon: Sparkles as LucideIcon },
      { id: "market-pulse", label: "Market Pulse", icon: Zap as LucideIcon },
    ],
  },
  {
    title: "Crafting",
    items: [
      { id: "my-crafting", label: "My Crafting", icon: Clipboard as LucideIcon },
      { id: "crafting", label: "Crafting", icon: Hammer as LucideIcon },
      { id: "refining", label: "Refining", icon: Pickaxe as LucideIcon },
      { id: "cooking", label: "Cooking", icon: ChefHat as LucideIcon },
    ],
  },
  {
    title: "Resources",
    items: [
      { id: "library", label: "Library", icon: BookOpen as LucideIcon },
    ],
  },
  {
    title: "Account",
    items: [
      { id: "notifications", label: "Notifications", icon: Bell as LucideIcon, badge: true },
      { id: "profile", label: "My Profile", icon: Settings as LucideIcon },
    ],
  },
];

export default function AppShell({ server, onServerChange }: { server: AlbionServer; onServerChange?: (s: AlbionServer) => void }) {
  const [activeTab, setActiveTab] = useState<"search" | "top-flipping" | "profit-scanner" | "market-pulse" | "crafting" | "refining" | "cooking" | "library" | "profile" | "notifications" | "my-crafting">("search");
  const { user, logout } = useAuth();
  const { notifications } = useWatchlist();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Use custom hook for all filters
  const {
    isPremium,
    selectedQualities,
    setSelectedQualities,
    selectedCities,
    setSelectedCities,
    maxAgeHours,
    setMaxAgeHours,
    hideSuspicious,
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
  } = useFilters();

  const unreadNotifications = notifications.filter(n => !n.read).length;
  const [selectedItem, setSelectedItem] = useState<AlbionItem | null>(null);
  const [pendingItem, setPendingItem] = useState<{ item: AlbionItem; targetTab: string; timestamp: number } | null>(null);

  // Use custom hook for market data
  const { prices, loading, error, loadPrices } = useMarketData(selectedItem, selectedCities, selectedQualities, server);

  const [buyCity, setBuyCity] = useState<string | null>(null);

  useEffect(() => {
    if (buyCity) {
      const sourcePrice = prices.find(p => p.city === buyCity);
      if (sourcePrice && sourcePrice.sell_price_min > 0) {
        setBuyPrice(sourcePrice.sell_price_min);
      }
    }
  }, [buyCity, prices]);

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

  const servers: { id: AlbionServer; label: string }[] = [
    { id: "West", label: "Americas (West)" },
    { id: "East", label: "Asia (East)" },
    { id: "Europe", label: "Europe" },
  ];

  const qualities = [
    { value: 1, label: "Normal" },
    { value: 2, label: "Good" },
    { value: 3, label: "Outstanding" },
    { value: 4, label: "Excellent" },
    { value: 5, label: "Masterpiece" },
  ];

  return (
    <>
      {/* Skip Links for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-32 focus:z-50 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Skip to navigation
      </a>

      <SidebarProvider>
      {/* Sidebar */}
      <Sidebar id="navigation" collapsible="icon" className="hidden lg:flex border-r border-sidebar-border">
        <SidebarHeader className="pt-4 pb-2 px-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 mb-2">
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 60'%3E%3Crect width='180' height='60' fill='none'/%3E%3Crect x='10' y='15' width='30' height='30' rx='6' fill='%23f59e0b'/%3E%3Ctext x='25' y='35' text-anchor='middle' font-size='14' font-weight='bold' fill='%23000'%3EAN%3C/text%3E%3Ctext x='100' y='28' font-size='12' font-weight='bold' fill='%23f59e0b'%3EALBION%3C/text%3E%3Ctext x='100' y='45' font-size='16' font-weight='bold' fill='%23fff'%3ENavigator%3C/text%3E%3C/svg%3E"
              alt="Albion Navigator Brand"
              className="w-full h-auto opacity-90"
            />
          </div>

          {/* User Profile */}
          <div
            className="flex items-center gap-3 cursor-pointer group px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors"
            onClick={() => {
              if (user) {
                setActiveTab("profile");
              } else {
                setAuthMode('login');
                setShowAuthModal(true);
              }
            }}
          >
            <Avatar className="w-10 h-10 rounded-xl bg-sidebar-accent border border-sidebar-border group-hover:border-sidebar-primary transition-all shrink-0">
              <AvatarFallback className="text-sidebar-primary text-xl font-bold">{user ? user.username[0].toUpperCase() : '?'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-headline font-bold text-sm tracking-widest text-sidebar-foreground uppercase whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-sidebar-primary transition-colors">
                {user ? user.username : 'Sign In'}
              </p>
              <p className="text-label text-sidebar-foreground/75 font-medium tracking-tighter truncate">
                {user ? user.email : 'Join the community'}
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <ScrollArea className="h-full">
            {navMain.map((group) => (
              <SidebarGroup key={group.title}>
                <SidebarGroupLabel className="text-label font-bold text-sidebar-foreground/70 uppercase tracking-widest">
                  {group.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={activeTab === item.id}
                          onClick={() => setActiveTab(item.id as typeof activeTab)}
                          tooltip={item.label}
                        >
                          <button className="w-full">
                            <item.icon className="w-4 h-4 shrink-0" />
                            <span>{item.label}</span>
                            {item.badge === "New!" && (
                              <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-label font-black px-1.5 py-0.5 rounded uppercase">
                                {item.badge}
                              </span>
                            )}
                            {item.badge === true && unreadNotifications > 0 && (
                              <span className="ml-auto bg-destructive text-white text-label font-black px-1.5 py-0.5 rounded-full animate-pulse min-w-5 text-center">
                                {unreadNotifications}
                              </span>
                            )}
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </ScrollArea>
        </SidebarContent>

        <SidebarFooter className="p-4 border-t border-sidebar-border">
          <div className="flex flex-col gap-2">
            <a href="#" className="flex items-center gap-3 text-sidebar-foreground/70 text-label uppercase tracking-widest hover:text-sidebar-primary transition-colors">
              <Info className="w-4 h-4" />
              <span>Support</span>
            </a>
            <a href="https://www.albion-online-data.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sidebar-foreground/70 text-label uppercase tracking-widest hover:text-sidebar-primary transition-colors">
              <Globe className="w-4 h-4" />
              <span>API</span>
            </a>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Main Content */}
      <SidebarInset id="main-content">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
          <SidebarTrigger />

          {/* Mobile Logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23f59e0b'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-size='16' font-weight='bold' fill='%23000'%3EAN%3C/text%3E%3C/svg%3E" alt="Logo" className="w-8 h-8 rounded-lg" />
            <h1 className="text-lg font-headline font-bold text-sidebar-primary tracking-widest uppercase">Albion Navigator</h1>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Server Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Globe className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">
                    {servers.find(s => s.id === server)?.label || server}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {servers.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => onServerChange && onServerChange(s.id)}
                    className={cn(server === s.id && "bg-accent")}
                  >
                    {s.label}
                    {server === s.id && <Check className="w-4 h-4 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Actions */}
            <div className="flex items-center gap-2 border-l border-sidebar-border pl-4">
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Settings">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 page-container max-w-7xl mx-auto space-y-6 sm:space-y-8">

          {/* Hero Banner */}
          <div className="relative w-full h-32 sm:h-40 rounded-2xl overflow-hidden glass-panel border border-sidebar-border/20">
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23f59e0b' stop-opacity='0.2'/%3E%3Cstop offset='100%25' stop-color='%230a0e14' stop-opacity='0.8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='200' fill='url(%23g)'/%3E%3Ccircle cx='200' cy='100' r='80' fill='%23f59e0b' opacity='0.1'/%3E%3Ccircle cx='1000' cy='50' r='60' fill='%23f59e0b' opacity='0.15'/%3E%3Ctext x='600' y='110' text-anchor='middle' font-size='48' font-weight='bold' fill='%23f59e0b' opacity='0.3'%3EALBION MARKET%3C/text%3E%3C/svg%3E"
              alt="Hero banner"
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-sidebar/80 via-transparent to-sidebar/80" />
          </div>

          {/* Search Tab */}
          {activeTab === "search" && (
            <SearchBar onSelect={(item) => {
              setSelectedItem(item);
            }} />
          )}

          {/* Filters */}
          {activeTab !== "crafting" && activeTab !== "refining" && activeTab !== "cooking" && activeTab !== "library" && activeTab !== "profile" && activeTab !== "notifications" && activeTab !== "my-crafting" && (
            <div className="w-full glass-panel rounded-xl border border-sidebar-border/20 px-4 py-2 flex flex-wrap items-center justify-evenly gap-2">
              <PrimaryFilters
                activeTab={activeTab}
                selectedCities={selectedCities}
                onCitiesChange={setSelectedCities}
                selectedQualities={selectedQualities}
                onQualitiesChange={setSelectedQualities}
                selectedItem={selectedItem}
                onItemChange={setSelectedItem}
                buyPrice={buyPrice}
                onBuyPriceChange={setBuyPrice}
                preferredEnchantments={preferredEnchantments}
                onEnchantmentsChange={setPreferredEnchantments}
              />

              <SecondaryFilters
                activeTab={activeTab}
                allowedStatuses={allowedStatuses}
                onStatusesChange={setAllowedStatuses}
                selectedCategories={selectedCategories}
                onCategoriesChange={setSelectedCategories}
                selectedSubCategory={selectedSubCategory}
                onSubCategoryChange={setSelectedSubCategory}
                maxAgeHours={maxAgeHours}
                onMaxAgeChange={setMaxAgeHours}
                categories={categories}
                subCategories={subCategories}
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === "top-flipping" ? (
              <motion.div
                key="top-flipping"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <TopFlipping
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
            ) : activeTab === "market-pulse" ? (
              <motion.div
                key="market-pulse"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <MarketPulse server={server} />
              </motion.div>
            ) : activeTab === "profit-scanner" ? (
              <motion.div
                key="profit-scanner"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ProfitScanner server={server} isPremium={isPremium} />
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
                  setActiveTab(sim.type as any);
                  window.dispatchEvent(new CustomEvent('albion_load_simulation', { detail: sim }));
                }} />
              </motion.div>
            ) : activeTab === "my-crafting" ? (
              <motion.div
                key="my-crafting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <MyCrafting onNavigateToTab={(tab) => setActiveTab(tab as any)} />
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
                className="space-y-6 sm:space-y-8"
              >
                <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6 glass-panel p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl">
                  <div className="relative group shrink-0">
                    <div className="absolute inset-0 bg-sidebar-primary blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
                    <img
                      src={selectedItem.icon}
                      alt={selectedItem.name}
                      className="w-24 h-24 sm:w-32 sm:h-32 object-contain relative z-10"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="text-center md:text-left space-y-2 flex-1 min-w-0">
                    <h2 className="text-2xl sm:text-4xl font-black text-sidebar-foreground uppercase italic tracking-tight">{selectedItem.name}</h2>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 sm:gap-3">
                      <span className="bg-sidebar-accent text-sidebar-foreground px-2 sm:px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Tier {selectedItem.tier}</span>
                      <span className="bg-sidebar-accent text-sidebar-foreground px-2 sm:px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{selectedItem.id}</span>
                      <span className="bg-sidebar-accent text-sidebar-foreground px-2 sm:px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{selectedItem.category}</span>
                      <span className="bg-sidebar-primary/10 text-sidebar-primary px-2 sm:px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                        {selectedQualities.map(q => qualities.find(x => x.value === q)?.label).join(", ")}
                      </span>
                    </div>
                  </div>
                  <div className="md:ml-auto flex items-center gap-2 text-sidebar-foreground/75 text-xs bg-black/20 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5 shrink-0">
                    <Info className="w-4 h-4" />
                    <p className="max-w-50 hidden sm:block">Data is crowdsourced via AODP.</p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-12 h-12 text-sidebar-primary animate-spin" />
                    <p className="text-sidebar-foreground/75 font-mono uppercase tracking-widest animate-pulse">Fetching Market Data...</p>
                  </div>
                ) : error ? (
                  <div className="bg-destructive/10 border border-destructive/50 p-8 rounded-3xl text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                    <p className="text-destructive font-bold">{error}</p>
                    <button onClick={loadPrices} className="bg-destructive text-white px-6 py-2 rounded-xl font-bold hover:bg-destructive/90 transition-colors">Retry</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
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
                className="py-32 text-center space-y-4 border-2 border-dashed border-sidebar-border/30 rounded-3xl"
              >
                <div className="glass-panel w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-sidebar-border/20">
                  <Settings className="w-10 h-10 text-sidebar-foreground/30 animate-spin-slow" />
                </div>
                <h3 className="text-2xl font-bold text-sidebar-foreground/75 uppercase tracking-widest">Select an item to begin</h3>
                <p className="text-sidebar-foreground/30 max-w-xs mx-auto">Use the search bar above to find items from the Royal Cities and Caerleon.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SidebarInset>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </SidebarProvider>
    </>
  );
}








