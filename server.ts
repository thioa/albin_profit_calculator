import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import NodeCache from "node-cache";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize cache with 5 minutes (300 seconds) standard Time-To-Live
const cache = new NodeCache({ stdTTL: 300 });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Proxy for Albion Online Data Project
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
        // console.log(`[Cache Hit] Prices: ${cacheKey}`);
        return res.json(cachedData);
      }

      const response = await axios.get(url, {
        params: req.query,
        validateStatus: (status) => status < 500 // Allow 4xx to be handled
      });
      
      if (response.status === 429) {
        return res.status(429).json({ error: "Rate limit exceeded on AODP" });
      }
      
      // Save valid successful responses to cache
      if (response.status === 200) {
        cache.set(cacheKey, response.data);
      }
      
      res.json(response.data);
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
        // console.log(`[Cache Hit] History: ${cacheKey}`);
        return res.json(cachedData);
      }

      const response = await axios.get(url, {
        params: req.query,
        validateStatus: (status) => status < 500
      });
      
      if (response.status === 429) {
        return res.status(429).json({ error: "Rate limit exceeded on AODP" });
      }
      
      // Save valid successful responses to cache
      if (response.status === 200) {
        cache.set(cacheKey, response.data);
      }
      
      res.json(response.data);
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
  });
}

startServer();
