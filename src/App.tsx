import { useState, useEffect } from "react";
import PriceChecker from "./components/features/PriceChecker";
import { AlbionServer } from "./types/albion";
import { WatchlistProvider } from "./contexts/WatchlistContext";

export default function App() {
  const [server, setServer] = useState<AlbionServer>(() => {
    const saved = localStorage.getItem("albion_server");
    return (saved as AlbionServer) || "West";
  });

  useEffect(() => {
    localStorage.setItem("albion_server", server);
  }, [server]);

  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary/30 selection:text-primary">
      <WatchlistProvider server={server}>
        <PriceChecker 
          server={server} 
          onServerChange={setServer} 
        />
      </WatchlistProvider>
    </div>
  );
}
