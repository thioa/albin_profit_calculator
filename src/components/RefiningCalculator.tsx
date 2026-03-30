import React from 'react';
import { Pickaxe } from 'lucide-react';
import BaseCalculator from './BaseCalculator';
import { AlbionServer, AlbionItem } from '../types/albion';

export default function RefiningCalculator({ server, injectedItem, onItemInjected }: { server: AlbionServer; injectedItem?: any; onItemInjected?: () => void; }) {
  const filterPredicate = (item: AlbionItem) => {
    return item.subCategory === 'refinedresources';
  };

  return (
    <BaseCalculator 
      server={server}
      title="Items to Refine"
      icon={<Pickaxe className="w-5 h-5 text-[#D4AF37]" />}
      storageKey="refining"
      filterPredicate={filterPredicate}
      injectedItem={injectedItem}
      onItemInjected={onItemInjected}
    />
  );
}
