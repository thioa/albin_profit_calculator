import React, { useState, useEffect, useRef, useMemo } from "react";
import Fuse from "fuse.js";
import { Search, Loader2, Filter, ChevronDown } from "lucide-react";
import itemsDataRaw from "../data/items-lite.json";
import { processItems } from "../lib/item-utils";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);
import { AlbionItem } from "../types/albion";

interface SearchBarProps {
  onSelect: (item: AlbionItem) => void;
  craftableOnly?: boolean;
  filterPredicate?: (item: AlbionItem) => boolean;
}

export default function SearchBar({ onSelect, craftableOnly = false, filterPredicate }: SearchBarProps) {
  const baseItems = useMemo(
    () => craftableOnly ? itemsData.filter(i => i.craftingRecipe && i.craftingRecipe.length > 0) : itemsData,
    [craftableOnly]
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AlbionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    itemsData.forEach(item => {
      if (item.category && item.category !== "Unknown") {
        cats.add(item.category);
      }
    });
    return Array.from(cats).sort();
  }, []);

  const subCategories = useMemo(() => {
    if (!selectedCategory) return [];
    const subs = new Set<string>();
    itemsData.forEach(item => {
      if (item.category === selectedCategory && item.subCategory && item.subCategory !== "Unknown") {
        subs.add(item.subCategory);
      }
    });
    return Array.from(subs).sort();
  }, [selectedCategory]);

  const filteredItems = useMemo(() => {
    let items = baseItems;
    if (selectedCategory) {
      items = items.filter(item => item.category === selectedCategory);
    }
    if (selectedSubCategory) {
      items = items.filter(item => item.subCategory === selectedSubCategory);
    }
    if (filterPredicate) {
      items = items.filter(filterPredicate);
    }
    // Deduplicate by id — safety net
    const seen = new Map<string, AlbionItem>();
    for (const item of items) {
      if (!seen.has(item.id)) seen.set(item.id, item);
    }
    return Array.from(seen.values());
  }, [baseItems, selectedCategory, selectedSubCategory]);

  const fuse = useMemo(() => new Fuse(filteredItems, {
    keys: ["name", "id"],
    threshold: 0.4,
  }), [filteredItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length > 0) {
      const searchResults = fuse.search(query).map((r) => r.item);
      setResults(searchResults.slice(0, 50));
      setIsOpen(true);
    } else if (selectedCategory || selectedSubCategory) {
      // If category is selected but no query, show top items in that category
      setResults(filteredItems.slice(0, 50));
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, fuse, filteredItems, selectedCategory, selectedSubCategory]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  return (
    <div className={`w-full space-y-3 relative ${isOpen ? "z-50" : "z-10"}`}>
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1" ref={containerRef}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/60 w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={handleSearch}
              onFocus={() => (query.length > 0 || selectedCategory) && setIsOpen(true)}
              placeholder="Search for an item (e.g. T4 Bag)..."
              className="w-full glass-panel border border-primary/20 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>

          {isOpen && results.length > 0 && (
            <div className="absolute z-50 w-full mt-2 glass-panel border border-primary/20 rounded-xl shadow-2xl overflow-y-auto max-h-[400px]">
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    setQuery(item.name);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-4 p-3 hover:bg-primary/10 hover:translate-x-1 transition-all text-left border-b border-primary/10 last:border-0 group/item"
                >
                  <img
                    src={item.icon}
                    alt={item.name}
                    className="w-10 h-10 object-contain group-hover/item:scale-110 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="text-white font-medium group-hover/item:text-primary transition-colors">{item.name}</div>
                    <div className="text-[10px] text-primary/60 font-bold uppercase tracking-widest">
                      Tier {item.tier} {item.enchantment > 0 ? `.${item.enchantment}` : ""} • {item.category}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <div className="relative min-w-[160px]">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedSubCategory("");
              }}
              className="w-full appearance-none glass-panel border border-primary/20 rounded-xl py-4 pl-4 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold uppercase tracking-wider"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/60 w-4 h-4 pointer-events-none" />
          </div>

          <div className="relative min-w-[160px]">
            <select
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
              disabled={!selectedCategory}
              className="w-full appearance-none glass-panel border border-primary/20 rounded-xl py-4 pl-4 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Sub-Cats</option>
              {subCategories.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/60 w-4 h-4 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
