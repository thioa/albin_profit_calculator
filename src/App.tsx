import { useState, useEffect, useMemo } from "react";
import PriceChecker from "./components/PriceChecker";
import { AlbionServer } from "./types/albion";
import { Globe, ChevronDown, Check, Clock } from "lucide-react";

export default function App() {
  const [server, setServer] = useState<AlbionServer>(() => {
    const saved = localStorage.getItem("albion_server");
    return (saved as AlbionServer) || "West";
  });
  const [showServerSelect, setShowServerSelect] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(() => localStorage.getItem("albion_last_scan_time"));

  useEffect(() => {
    localStorage.setItem("albion_server", server);
  }, [server]);

  useEffect(() => {
    const handleUpdate = () => {
      setLastScanTime(localStorage.getItem("albion_last_scan_time"));
    };
    window.addEventListener('albion_market_updated', handleUpdate);
    return () => window.removeEventListener('albion_market_updated', handleUpdate);
  }, []);

  const formatLastScan = (timeStr: string | null) => {
    if (!timeStr) return "Never";
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return "Just Now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${diffHours}h ago`;
  };

  const servers: { id: AlbionServer; label: string }[] = [
    { id: "West", label: "Americas (West)" },
    { id: "East", label: "Asia (East)" },
    { id: "Europe", label: "Europe" },
  ];

  return (
    <div className="min-h-screen bg-[#121212] text-gray-100 font-sans selection:bg-[#D4AF37] selection:text-black">
      {/* Background patterns */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#D4AF37] opacity-[0.03] blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-[#D4AF37] opacity-[0.03] blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05]" />
      </div>

      <header className="relative z-50 border-b border-gray-800 bg-[#121212]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#D4AF37] rounded-lg flex items-center justify-center font-black text-black text-xl italic">A</div>
            <span className="font-black text-xl tracking-tighter uppercase italic hidden sm:block">
              Albion <span className="text-[#D4AF37]">Market</span>
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Live Market Data</span>
              </div>
              
              {lastScanTime && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Last Scan: {formatLastScan(lastScanTime)}</span>
                </div>
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowServerSelect(!showServerSelect)}
                className="flex items-center gap-3 bg-[#1e1e1e] hover:bg-[#252525] border border-gray-800 px-4 py-2 rounded-xl transition-all group"
              >
                <Globe className="w-4 h-4 text-[#D4AF37]" />
                <div className="text-left hidden sm:block">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter leading-none mb-1">Server</div>
                  <div className="text-xs font-black text-white uppercase tracking-wider leading-none">
                    {servers.find(s => s.id === server)?.label}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showServerSelect ? 'rotate-180' : ''}`} />
              </button>

              {showServerSelect && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowServerSelect(false)} />
                  <div className="absolute top-full mt-2 right-0 w-56 bg-[#1e1e1e] border border-gray-800 rounded-2xl shadow-2xl z-50 p-2 overflow-hidden">
                    {servers.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setServer(s.id);
                          setShowServerSelect(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                          server === s.id 
                          ? "bg-[#D4AF37]/10 text-[#D4AF37]" 
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="text-xs font-bold uppercase tracking-widest">{s.label}</span>
                        {server === s.id && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1600px] mx-auto px-6 py-12 md:py-20">
        <PriceChecker server={server} />
      </main>

      <footer className="relative z-10 border-t border-gray-800 py-12 mt-20">
        <div className="max-w-[1600px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left space-y-2">
            <div className="font-black text-lg tracking-tighter uppercase italic">
              Albion <span className="text-[#D4AF37]">Insight</span>
            </div>
            <p className="text-gray-500 text-xs max-w-xs">
              Powered by the Albion Online Data Project. Not affiliated with Sandbox Interactive.
            </p>
          </div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
            <a href="https://www.albion-online-data.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">AODP API</a>
            <a href="https://albiononline.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Official Site</a>
            <span className="text-gray-800">v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
