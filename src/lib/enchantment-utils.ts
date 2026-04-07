export function getBaseIdAndEnchantment(id: string) {
  const parts = id.split("@");
  return {
    baseId: parts[0],
    enchantment: parts.length > 1 ? parseInt(parts[1]) : 0
  };
}

export function getEnchantmentColor(level: number, isActive: boolean) {
  if (!isActive) return "bg-gray-800 text-sidebar-foreground/60 hover:bg-gray-700 hover:text-white";
  switch (level) {
    case 1: return "bg-green-600 text-white shadow-[0_0_10px_rgba(22,163,74,0.3)]";
    case 2: return "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]";
    case 3: return "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]";
    case 4: return "bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]";
    default: return "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_10px_rgba(212,175,55,0.3)]";
  }
}
