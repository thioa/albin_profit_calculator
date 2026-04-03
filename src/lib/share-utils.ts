export function serializeState(state: any): string {
  try {
    const json = JSON.stringify(state);
    // Use btoa for a simple base64 encoding
    // For browser compatibility with Unicode, we use this trick:
    return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  } catch (e) {
    console.error("Serialization failed", e);
    return "";
  }
}

export function deserializeState(hash: string): any {
  try {
    const json = decodeURIComponent(Array.prototype.map.call(atob(hash), (c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(json);
  } catch (e) {
    console.error("Deserialization failed", e);
    return null;
  }
}

/**
 * Creates a shorter version of the state for URL purposes
 */
export function compressCalculatorState(state: any) {
  return {
    l: state.craftList.map((i: any) => ({ id: i.id, c: i.count, f: i.stationFeeSilver })),
    h: state.haveList,
    m: state.manualPrices,
    s: state.sellPrices,
    c: state.sourceCities,
    g: state.globalCity,
    r: state.rrrConfig
  };
}

export function decompressCalculatorState(compressed: any) {
  if (!compressed) return null;
  return {
    craftList: (compressed.l || []).map((i: any) => ({ id: i.id, count: i.c, stationFeeSilver: i.f })),
    haveList: compressed.h || {},
    manualPrices: compressed.m || {},
    sellPrices: compressed.s || {},
    sourceCities: compressed.c || {},
    globalCity: compressed.g || "Caerleon",
    rrrConfig: compressed.r || { stationBonus: 10, cityBonus: true, focus: false }
  };
}
