// frontend/script.js
const BASE_URL = "http://127.0.0.1:5000/api";
const coins = ["bitcoin", "ethereum", "litecoin", "binancecoin", "ripple"];

const coinClassMap = {
  bitcoin: "btc",
  ethereum: "eth",
  litecoin: "ltc",
  binancecoin: "bnb",
  ripple: "xrp",
};

async function loadLiveData(coin) {
  try {
    const res = await fetch(`${BASE_URL}/live/${coin}`);
    const data = await res.json();
    if (!data || data.error) {
      console.warn(`Live data for ${coin} missing:`, data);
      return;
    }

    const card = document.querySelector(`.${coinClassMap[coin]}`);
    if (!card) return;

    const priceEl = card.querySelector(".price");
    const changeEl = card.querySelector(".change");
    const capEl = card.querySelector(".market-cap");
    const volumeEl = card.querySelector(".volume");

    if (priceEl) priceEl.textContent = `$${Number(data.price).toLocaleString()}`;
    if (changeEl) {
      changeEl.textContent = `${data.percent_change > 0 ? "+" : ""}${data.percent_change.toFixed(2)}%`;
      changeEl.style.color = data.percent_change > 0 ? "green" : "red";
    }
    if (capEl && data.market_cap) capEl.textContent = `Market Cap $${Number(data.market_cap).toLocaleString()}`;
    if (volumeEl && data.volume_24h) volumeEl.textContent = `Volume 24h $${Number(data.volume_24h).toLocaleString()}`;
  } catch (err) {
    console.error("Live data error:", err);
  }
}

async function loadMarketChart(coin = "bitcoin") {
  try {
    const res = await fetch(`${BASE_URL}/trend/${coin}`);
    const data = await res.json();
    if (!data || data.error || !data.dates || !data.prices) {
      console.warn("Trend data invalid:", data);
      return;
    }

    const ctx = document.getElementById("marketChart")?.getContext("2d");
    if (!ctx) return;
    if (window.marketChart && typeof window.marketChart.destroy === "function") window.marketChart.destroy();

    // reuse your existing chart config (kept same to preserve UI)
    window.marketChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.dates.slice(-30),
        datasets: [{
          label: `${coin.toUpperCase()} (Last 30 Days)`,
          data: data.prices.slice(-30),
          borderColor: "#2563eb",
          borderWidth: 2,
          fill: true,
          backgroundColor: (ctx.createLinearGradient(0,0,0,300) || "#2563eb"),
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  } catch (err) {
    console.error("Chart error:", err);
  }
}

async function loadTopMovers() {
  try {
    const res = await fetch(`${BASE_URL}/top-movers`);
    const data = await res.json();
    if (!data || data.error || !data.gainers || !data.losers) {
      console.warn("Top movers fetch problem:", data);
      return;
    }
    const gainersEl = document.querySelector(".gainers ul");
    const losersEl = document.querySelector(".losers ul");
    if (!gainersEl || !losersEl) return;

    gainersEl.innerHTML = data.gainers.map(g => `<li>${g.coin}<span style="color:green;">+${g.change.toFixed(2)}%</span></li>`).join("");
    losersEl.innerHTML = data.losers.map(l => `<li>${l.coin}<span style="color:red;">${l.change.toFixed(2)}%</span></li>`).join("");
  } catch (err) {
    console.error("Top movers error:", err);
  }
}

(async () => {
  // If rate-limit issues, consider calling /live-multi and using that to update all cards at once.
  for (const coin of coins) await loadLiveData(coin);
  await loadMarketChart();
  await loadTopMovers();
})();

document.getElementById("coinSelector")?.addEventListener("change", e => loadMarketChart(e.target.value));

// auto refresh
setInterval(() => {
  coins.forEach(coin => loadLiveData(coin));
  loadTopMovers();
}, 60000);

const themeToggle = document.getElementById("themeToggle");
const currentTheme = localStorage.getItem("theme") || "light";
document.body.classList.add(`${currentTheme}-theme`);
if (themeToggle) themeToggle.textContent = currentTheme === "light" ? "🌙" : "☀️";
if (themeToggle) themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark-theme");
  document.body.classList.toggle("dark-theme", !isDark);
  document.body.classList.toggle("light-theme", isDark);
  themeToggle.textContent = isDark ? "🌙" : "☀️";
  localStorage.setItem("theme", isDark ? "light" : "dark");
});




