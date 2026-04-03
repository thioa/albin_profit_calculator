<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Albion Market Insight 🪙
Advanced market analysis and profit optimization tool for Albion Online.

## 🚀 Overview
**Albion Market Insight** is a specialized dashboard designed to help Albion Online players maximize their economic potential. By integrating real-time market data with advanced calculation logic, it provides actionable insights for traders, crafters, and refinishers.

Whether you're a veteran "Whale" hunter or a local regional crafter, this tool gives you the edge needed to dominate the markets of Albion.

## ✨ Key Features
- **📊 Real-time Price Checker**: View current item prices across all Royal Cities and Caerleon.
- **🐋 Whale Scanner (High Value)**: Track high-tier items (8.3/8.4) and rare mounts with high price disparities.
- **📈 Top Flipping Opportunities**: Automatically find the best items to buy low in one city and sell high in another.
- **⚒️ Crafting & Refining Calculators**:
    - **RRR (Resource Return Rate)** support.
    - **Station Fee** and **Usage Fee** integration.
    - **Local Profit Analysis**: Calculate profit based on target city bonuses.
- **🍳 Cooking & Potion Modules**: Dedicated tools for food and consumable production.
- **🔍 Advanced Search & Filters**: Filter by Tier, Enchantment, Quality, and Category.
- **🧠 AI-Powered Insights**: Get descriptions and strategic recommendations (powered by Google Gemini).

## ⚙️ How it Works
1. **Data Source**: Fetches market data from the **Albion Online Data Project (AODP)** via public APIs.
2. **Analysis Engine**: Calculates ROI, net profit (after taxes), and market velocity using up-to-date game formulas.
3. **Multi-Server Support**: Supports America (West), Asia (East), and Europe servers to cater to the global player base.

## 🛠️ Getting Started
### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn**

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/thioa/albin_profit_calculator.git
   cd albion-market-insight
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Environment Variables:
   Create a `.env` file in the root directory and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🤝 Special Thanks
- **Albion Online Data Project**: For providing the incredible market data infrastructure.
- **Battle24 & Contributors**: For their hard work on perfecting the economic logic and UI.
- **The Albion Community**: For the continuous feedback and support in making this tool better.

---
*Disclaimer: This is a fan-made tool and is not affiliated with Sandbox Interactive GmbH.*

