import React, { useState, useEffect, useRef, useMemo } from "react";
import Fuse from "fuse.js";
import { Search, ChevronDown } from "lucide-react";
import itemsDataRaw from "../../data/items-lite.json";
import { processItems } from "../../lib/item-utils";
import { AlbionItem } from "../../types/albion";

const itemsData = processItems(itemsDataRaw as AlbionItem[]).filter(i => i.name && i.id);

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const resultsRef = useRef<(HTMLButtonElement | null)[]>([]);

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
        setActiveIndex(-1);
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
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
      resultsRef.current[activeIndex + 1]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : -1));
      resultsRef.current[activeIndex - 1]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const item = results[activeIndex];
      onSelect(item);
      setQuery(item.name);
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className={`w-full relative ${isOpen ? "z-50" : "z-10"}`}>
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 h-11" ref={containerRef}>
          <div className="relative h-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/50 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={handleSearch}
              onKeyDown={handleKeyDown}
              onFocus={() => (query.length > 0 || selectedCategory) && setIsOpen(true)}
              placeholder="Search for an item (e.g. T4 Bag)..."
              className="w-full h-11 pl-11 pr-4 bg-black/40 border border-primary/20 rounded-xl text-primary text-sm font-medium placeholder:text-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              aria-label="Search items"
              aria-expanded={isOpen}
              aria-controls="search-results"
              aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
              role="combobox"
            />
          </div>

          {isOpen && results.length > 0 && (
            <div id="search-results" role="listbox" className="absolute z-50 w-full mt-2 glass-panel border border-primary/20 rounded-xl shadow-2xl overflow-y-auto max-h-80">
              {results.map((item, idx) => (
                <button
                  key={item.id}
                  id={`search-result-${idx}`}
                  ref={el => { resultsRef.current[idx] = el; }}
                  role="option"
                  aria-selected={activeIndex === idx}
                  onClick={() => {
                    onSelect(item);
                    setQuery(item.name);
                    setIsOpen(false);
                    setActiveIndex(-1);
                  }}
                  className={`w-full flex items-center gap-4 p-3 hover:bg-primary/10 hover:translate-x-1 transition-all text-left border-b border-primary/10 last:border-0 group/item min-h-12 ${
                    activeIndex === idx ? 'bg-primary/15 translate-x-1' : ''
                  }`}
                >
                  <img
                    src={item.icon}
                    alt={item.name}
                    className="w-10 h-10 object-contain group-hover/item:scale-110 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="text-white font-medium group-hover/item:text-primary transition-colors">{item.name}</div>
                    <div className="text-xs text-primary/60 font-bold uppercase tracking-wider">
                      Tier {item.tier} {item.enchantment > 0 ? `.${item.enchantment}` : ""} • {item.category}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <div className="relative min-w-40">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedSubCategory("");
              }}
              className="w-full h-11 appearance-none bg-black/40 border border-primary/20 rounded-xl pl-4 pr-10 text-primary text-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer"
              aria-label="Filter by category"
            >
              <option value="" className="text-primary/50">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat} className="text-white bg-[#0a0e14]">{cat}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 w-4 h-4 pointer-events-none" />
          </div>

          <div className="relative min-w-40">
            <select
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
              disabled={!selectedCategory}
              className="w-full h-11 appearance-none bg-black/40 border border-primary/20 rounded-xl pl-4 pr-10 text-primary text-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Filter by sub-category"
            >
              <option value="" className="text-primary/50">All Sub-Cats</option>
              {subCategories.map(sub => (
                <option key={sub} value={sub} className="text-white bg-[#0a0e14]">{sub}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 w-4 h-4 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
