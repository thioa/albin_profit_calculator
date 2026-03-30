import React, { useState, useMemo } from "react";
import { AlbionItem } from "../types/albion";
import SearchBar from "./SearchBar";
import { BookOpen, Info, ArrowRight, Package, Calculator } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import itemsDataRaw from "../data/items-lite.json";
import { processItems } from "../lib/item-utils";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);

export default function Library() {
  const [selectedItem, setSelectedItem] = useState<AlbionItem | null>(null);

  const getTargetTab = (item: AlbionItem) => {
    if (item.category === 'consumables') return 'cooking';
    if (item.subCategory === 'refinedresources') return 'refining';
    return 'crafting';
  };

  const dispatchAddItem = (item: AlbionItem) => {
    const tab = getTargetTab(item);
    // Fire event for PriceChecker to manage tab switch and injection state
    window.dispatchEvent(new CustomEvent('albion_add_craft_item', { 
      detail: { item, targetTab: tab, timestamp: Date.now() }
    }));
  };

  const usedInRecipes = useMemo(() => {
    if (!selectedItem) return [];
    return itemsData.filter(i => 
      i.craftingRecipe?.some(req => req.id === selectedItem.id)
    );
  }, [selectedItem]);

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">
      <div className="bg-[#1e1e1e] p-5 rounded-2xl border border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-5 h-5 text-[#D4AF37]" />
          <h2 className="text-xl font-black text-white uppercase italic tracking-wider">Item Library</h2>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          Search for any item to see its crafting recipe or discover what it is used to craft.
        </p>
        <SearchBar onSelect={setSelectedItem} />
      </div>

      <AnimatePresence mode="popLayout">
        {selectedItem && (
          <motion.div
            key={selectedItem.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            {/* Item Header */}
            <div className="bg-[#1e1e1e] p-6 rounded-2xl border border-gray-800 flex items-center gap-6">
              <div className="w-24 h-24 bg-black/40 rounded-xl border border-gray-700 flex items-center justify-center p-2 shrink-0">
                <img src={selectedItem.icon} alt={selectedItem.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-3xl font-black text-white uppercase italic truncate">{selectedItem.name}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-2 py-1 bg-gray-800 text-gray-300 text-[10px] font-bold uppercase tracking-widest rounded-md">Tier {selectedItem.tier}</span>
                  <span className="px-2 py-1 bg-[#D4AF37]/10 text-[#D4AF37] text-[10px] font-bold uppercase tracking-widest rounded-md border border-[#D4AF37]/20">{selectedItem.category}</span>
                  {selectedItem.subCategory && <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded-md border border-blue-500/20">{selectedItem.subCategory}</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* How to Craft */}
              <div className="bg-[#1e1e1e] border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
                <div className="bg-black/30 p-4 border-b border-gray-800 text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Package className="w-4 h-4" /> How to Craft
                </div>
                <div className="p-4 flex-1">
                  {selectedItem.craftingRecipe && selectedItem.craftingRecipe.length > 0 ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {selectedItem.craftingRecipe.map(req => {
                          const item = itemsData.find(i => i.id === req.id);
                          return (
                            <div key={req.id} className="flex items-center gap-3 bg-black/20 p-2 rounded-xl border border-white/5">
                              <img src={item?.icon || `https://render.albiononline.com/v1/item/${req.id}.png`} alt="" className="w-8 h-8" referrerPolicy="no-referrer" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-gray-300 truncate">{item?.name || req.id}</div>
                              </div>
                              <div className="font-mono font-bold text-[#D4AF37] px-3">{req.count}x</div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <button 
                        onClick={() => dispatchAddItem(selectedItem)}
                        className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-3 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded-xl transition-all font-bold uppercase tracking-wider text-xs"
                        title={`Calculate profit in ${getTargetTab(selectedItem)} tab`}
                      >
                        <Calculator className="w-4 h-4" /> Calculate Profit
                      </button>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2 py-8">
                      <Info className="w-6 h-6 opacity-50" />
                      <p className="text-xs uppercase tracking-widest font-bold">No Recipe Available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Used In */}
              <div className="bg-[#1e1e1e] border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
                <div className="bg-black/30 p-4 border-b border-gray-800 text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" /> Used To Craft
                </div>
                <div className="p-4 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
                  {usedInRecipes.length > 0 ? (
                    <div className="space-y-2">
                      {usedInRecipes.map(recipeItem => (
                        <div key={recipeItem.id} className="flex items-center gap-3 bg-black/20 p-2 rounded-xl border border-white/5 hover:bg-white/5 transition-colors group">
                          <img src={recipeItem.icon} alt="" className="w-8 h-8" referrerPolicy="no-referrer" />
                          <div className="flex-1 min-w-0 flex items-center justify-between">
                            <div className="text-sm font-bold text-gray-300 truncate group-hover:text-white transition-colors">{recipeItem.name}</div>
                            <button 
                              onClick={() => dispatchAddItem(recipeItem)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 bg-[#D4AF37]/10 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-black rounded-lg transition-all"
                              title={`Calculate profit in ${getTargetTab(recipeItem)} tab`}
                            >
                              <Calculator className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2 py-8">
                      <Info className="w-6 h-6 opacity-50" />
                      <p className="text-xs uppercase tracking-widest font-bold">Not Used as Ingredient</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
