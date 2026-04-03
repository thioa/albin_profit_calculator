import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import NodeCache from "node-cache";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optimized cache configuration
// - stdTTL: 300 seconds (5 minutes) for standard cache entries
// - checkperiod: 60 seconds - check for expired keys every 60s
// - maxKeys: 10000 - limit maximum number of cached items to prevent memory bloat
const cache = new NodeCache({ 
  stdTTL: 300,
  checkperiod: 60,
  maxKeys: 10000,
  useClones: false // Improve performance by not cloning objects
});

// Request deduplication - prevent duplicate in-flight requests
const pendingRequests = new Map<string, Promise<any>>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Proxy for Albion Online Data Project with optimized caching
  app.get("/api/prices/:itemId", async (req, res) => {
    try {
      const { itemId } = req.params;
      const { locations, qualities, server } = req.query;

      let baseUrl = "https://www.albion-online-data.com/api/v2/stats/prices/";
      if (server === "East") {
        baseUrl = "https://east.albion-online-data.com/api/v2/stats/prices/";
      } else if (server === "Europe") {
        baseUrl = "https://europe.albion-online-data.com/api/v2/stats/prices/";
      }

      const url = `${baseUrl}${itemId}`;

      // Create a unique cache key based on request parameters
      const cacheKey = `prices_${itemId}_${server}_${locations || ''}_${qualities || ''}`;

      // Check if data is in cache
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      // Check if there's already a pending request for this data
      if (pendingRequests.has(cacheKey)) {
        try {
          const result = await pendingRequests.get(cacheKey);
          return res.json(result);
        } catch (error) {
          // If pending request failed, continue with new request
        }
      }

      // Create new request promise
      const requestPromise = (async () => {
        const response = await axios.get(url, {
          params: req.query,
          validateStatus: (status) => status < 500,
          timeout: 10000 // 10 second timeout
        });

        if (response.status === 429) {
          throw new Error("Rate limit exceeded on AODP");
        }

        // Save valid successful responses to cache
        if (response.status === 200) {
          cache.set(cacheKey, response.data);
        }

        return response.data;
      })();

      pendingRequests.set(cacheKey, requestPromise);

      try {
        const data = await requestPromise;
        res.json(data);
      } finally {
        // Clean up pending request
        pendingRequests.delete(cacheKey);
      }
    } catch (error: any) {
      const status = error.response?.status || 500;
      console.error(`Proxy error (${status}):`, error.message);
      res.status(status).json({ error: "Failed to fetch prices from AODP" });
    }
  });

  app.get("/api/history/:itemId", async (req, res) => {
    try {
      const { itemId } = req.params;
      const { locations, qualities, server, date } = req.query;

      let baseUrl = "https://www.albion-online-data.com/api/v2/stats/history/";
      if (server === "East") {
        baseUrl = "https://east.albion-online-data.com/api/v2/stats/history/";
      } else if (server === "Europe") {
        baseUrl = "https://europe.albion-online-data.com/api/v2/stats/history/";
      }

      const url = `${baseUrl}${itemId}`;

      // Create a unique cache key for history
      const timeScale = req.query['time-scale'] || '1';
      const cacheKey = `history_${itemId}_${server}_${locations || ''}_${qualities || ''}_${timeScale}_${date || ''}`;

      // Check if data is in cache
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      // Check if there's already a pending request for this data
      if (pendingRequests.has(cacheKey)) {
        try {
          const result = await pendingRequests.get(cacheKey);
          return res.json(result);
        } catch (error) {
          // If pending request failed, continue with new request
        }
      }

      // Create new request promise
      const requestPromise = (async () => {
        const response = await axios.get(url, {
          params: req.query,
          validateStatus: (status) => status < 500,
          timeout: 10000 // 10 second timeout
        });

        if (response.status === 429) {
          throw new Error("Rate limit exceeded on AODP");
        }

        // Save valid successful responses to cache
        if (response.status === 200) {
          cache.set(cacheKey, response.data);
        }

        return response.data;
      })();

      pendingRequests.set(cacheKey, requestPromise);

      try {
        const data = await requestPromise;
        res.json(data);
      } finally {
        // Clean up pending request
        pendingRequests.delete(cacheKey);
      }
    } catch (error: any) {
      const status = error.response?.status || 500;
      console.error(`History proxy error (${status}):`, error.message);
      res.status(status).json({ error: "Failed to fetch history from AODP" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Cache initialized with TTL: 300s, Max Keys: 10000`);
  });
}

startServer();
