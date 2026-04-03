const fs = require('fs');
let c = fs.readFileSync('src/components/BaseCalculator.tsx', 'utf-8');

// Theming replacements
c = c.replace(/bg-\[\#1e1e1e\] border border-gray-800/g, 'glass-panel');
c = c.replace(/bg-\[\#1e1e1e\]/g, 'glass-panel');
c = c.replace(/border-gray-800/g, 'border-primary/10');
c = c.replace(/bg-\[\#D4AF37\]\/10/g, 'bg-primary/10');
c = c.replace(/bg-\[\#D4AF37\]/g, 'bg-primary');
c = c.replace(/text-\[\#D4AF37\]/g, 'text-primary');
c = c.replace(/ring-\[\#D4AF37\]/g, 'ring-primary');
c = c.replace(/border-\[\#D4AF37\]\/40/g, 'border-primary/40');

// Additional UI polish based on mockup
c = c.replace(/rounded-2xl/g, 'rounded-3xl'); // Rounder corners on glass panels
c = c.replace(/text-gray-400/g, 'text-primary/60');
c = c.replace(/text-gray-500/g, 'text-primary/50');
c = c.replace(/text-gray-300/g, 'text-on-surface');
c = c.replace(/bg-black\/40/g, 'bg-black/20');
c = c.replace(/border-gray-700/g, 'border-primary/20');

fs.writeFileSync('src/components/BaseCalculator.tsx', c);
console.log("Replaced themes in BaseCalculator.tsx");
