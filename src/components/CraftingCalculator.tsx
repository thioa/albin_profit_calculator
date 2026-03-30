import React from 'react';
import { Package } from 'lucide-react';
import BaseCalculator from './BaseCalculator';
import { AlbionServer, AlbionItem } from '../types/albion';

export default function CraftingCalculator({ server, injectedItem, onItemInjected }: { server: AlbionServer; injectedItem?: any; onItemInjected?: () => void; }) {
  const filterPredicate = (item: AlbionItem) => {
    return item.category !== 'consumables' && 
           item.category !== 'farming' && 
           item.subCategory !== 'refinedresources';
  };

  return (
    <BaseCalculator 
      server={server}
      title="Items to Craft"
      icon={<Package className="w-5 h-5 text-[#D4AF37]" />}
      storageKey="crafting"
      filterPredicate={filterPredicate}
      injectedItem={injectedItem}
      onItemInjected={onItemInjected}
    />
  );
}
