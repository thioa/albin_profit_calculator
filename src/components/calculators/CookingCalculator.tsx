import React from 'react';
import { ChefHat } from 'lucide-react';
import BaseCalculator from './BaseCalculator';
import { AlbionServer, AlbionItem } from '../../types/albion';

export default function CookingCalculator({ server, injectedItem, onItemInjected }: { server: AlbionServer; injectedItem?: any; onItemInjected?: () => void; }) {
  const filterPredicate = (item: AlbionItem) => {
    return item.category === 'consumables';
  };

  const getCookingMultiplier = (item: AlbionItem) => {
    if (item.subCategory === 'food') return 10;
    
    // Potions multiplier logic based on T1-T5 rules
    if (item.subCategory === 'potions') {
      const name = item.name.toLowerCase();
      if (
        name.includes('healing potion') ||
        name.includes('energy potion') ||
        name.includes('gigantify potion') ||
        name.includes('resistance potion') ||
        name.includes('sticky potion') ||
        name.includes('poison potion')
      ) {
        return 5;
      }
      return 10;
    }
    
    // Default fallback
    return 10;
  };

  return (
    <BaseCalculator 
      server={server}
      title="Cooking"
      icon={<ChefHat className="w-5 h-5 text-primary" />}
      storageKey="cooking"
      filterPredicate={filterPredicate}
      outputMultiplier={getCookingMultiplier}
      injectedItem={injectedItem}
      onItemInjected={onItemInjected}
    />
  );
}








