import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      const response = await axios.get(url, {
        params: req.query,
        validateStatus: (status) => status < 500 // Allow 4xx to be handled
      });
      
      if (response.status === 429) {
        return res.status(429).json({ error: "Rate limit exceeded on AODP" });
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
      const response = await axios.get(url, {
        params: req.query,
        validateStatus: (status) => status < 500
      });
      
      if (response.status === 429) {
        return res.status(429).json({ error: "Rate limit exceeded on AODP" });
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
