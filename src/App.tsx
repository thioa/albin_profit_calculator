import { useState, useEffect } from "react";
import AppShell from "./components/layout/AppShell";
import { AlbionServer } from "./types/albion";
import { WatchlistProvider } from "./contexts/WatchlistContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function App() {
  const [server, setServer] = useState<AlbionServer>(() => {
    const saved = localStorage.getItem("albion_server");
    return (saved as AlbionServer) || "West";
  });

  useEffect(() => {
    localStorage.setItem("albion_server", server);
  }, [server]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 selection:text-primary dark">
        <WatchlistProvider server={server}>
          <AppShell
            server={server}
            onServerChange={setServer}
          />
        </WatchlistProvider>
      </div>
    </TooltipProvider>
  );
}
