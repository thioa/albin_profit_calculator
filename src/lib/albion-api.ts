import { AlbionPrice, AlbionHistory } from "../types/albion";

export const fetchPrices = async (
  itemIds: string | string[],
  locations: string[] = [],
  qualities: number[] = [1],
  server: string = "West"
): Promise<AlbionPrice[]> => {
  const idsArray = Array.isArray(itemIds) ? itemIds : [itemIds];
  
  // Albion Online Data API has limits on URL length and number of items per request
  // We'll chunk the requests to be safe (approx 40 items per request)
  const CHUNK_SIZE = 40;
  const chunks: string[][] = [];
  for (let i = 0; i < idsArray.length; i += CHUNK_SIZE) {
    chunks.push(idsArray.slice(i, i + CHUNK_SIZE));
  }

  const allResults: AlbionPrice[][] = await Promise.all(chunks.map(async (chunk) => {
    const ids = chunk.join(",");
    const params = new URLSearchParams();
    if (locations.length > 0) params.append("locations", locations.join(","));
    if (qualities.length > 0) params.append("qualities", qualities.join(","));
    params.append("server", server);

    const response = await fetch(`/api/prices/${ids}?${params.toString()}`);
    if (response.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const retryResponse = await fetch(`/api/prices/${ids}?${params.toString()}`);
      if (!retryResponse.ok) return [];
      return retryResponse.json();
    }
    if (!response.ok) return [];
    return response.json();
  }));

  return allResults.flat();
};

export const fetchHistory = async (
  itemId: string,
  locations: string[] = [],
  qualities: number[] = [1],
  server: string = "West",
  date?: string
): Promise<AlbionHistory[]> => {
  const params = new URLSearchParams();
  if (locations.length > 0) params.append("locations", locations.join(","));
  if (qualities.length > 0) params.append("qualities", qualities.join(","));
  params.append("server", server);
  params.append("time-scale", "1");
  if (date) params.append("date", date);

  const url = `/api/history/${itemId}?${params.toString()}`;
  
  let retries = 0;
  const MAX_RETRIES = 3;
  
  while (retries <= MAX_RETRIES) {
    try {
      const response = await fetch(url);
      
      if (response.status === 429) {
        if (retries === MAX_RETRIES) throw new Error("Rate limit exceeded after multiple retries");
        
        // Exponential backoff: 2s, 4s, 8s
        const waitTime = Math.pow(2, retries + 1) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retries++;
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      if (retries === MAX_RETRIES) throw error;
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error("Failed to fetch history");
};
