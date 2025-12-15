// frontend/coin-details.js
// Replaces previous coin-details.js — keeps frontend UI exactly as-is.
// Only JS logic updated to make charts, indicators, OHLC and news robust.

const BASE_URL = "http://127.0.0.1:5000/api";
const coinSelect = document.getElementById("coinSelect");
const horizonSelect = document.getElementById("horizonSelect");
const coinNameEl = document.getElementById("coinName");
const coinPriceEl = document.getElementById("coinPrice");
const newsCoinEl = document.getElementById("newsCoin");
const downloadCsvBtn = document.getElementById("downloadCsv");
const mainCanvas = document.getElementById("coinChart");
const mainCtx = mainCanvas ? mainCanvas.getContext("2d") : null;

let mainChart = null;
let rsiChart = null;
let macdChart = null;

// ------------------------------
// Helper: safe fetch JSON
// ------------------------------
async function safeFetchJSON(url) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      // try parse json for error message
      try { return { error: JSON.parse(text) }; } catch (e) { return { error: text || res.statusText }; }
    }
    return JSON.parse(text);
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

// ------------------------------
// Fetch helpers
// ------------------------------
async function fetchHistory(coin) {
  const res = await safeFetchJSON(`${BASE_URL}/history/${coin}`);
  if (res && res.error) throw new Error(typeof res.error === "string" ? res.error : JSON.stringify(res.error));
  if (!Array.isArray(res)) throw new Error("Invalid history response");
  return res;
}

async function fetchTrend(coin) {
  const res = await safeFetchJSON(`${BASE_URL}/trend/${coin}`);
  if (res && res.error) throw new Error(typeof res.error === "string" ? res.error : JSON.stringify(res.error));
  if (!res || !Array.isArray(res.prices) || !Array.isArray(res.dates)) throw new Error("Invalid trend response");
  return res;
}

async function fetchNews(coin) {
  try {
    const res = await safeFetchJSON(`${BASE_URL}/news/${coin}`);
    return Array.isArray(res) ? res : [];
  } catch (e) {
    console.warn("News fetch failed:", e);
    return [];
  }
}

// ------------------------------
// Bollinger Bands Calculation
// ------------------------------
function calculateBollingerBands(prices, period = 20, multiplier = 2) {
  const upperBand = [];
  const middleBand = [];
  const lowerBand = [];

  if (!Array.isArray(prices) || prices.length === 0) {
    // return empty arrays so Chart receives the right lengths later
    return { upperBand: [], middleBand: [], lowerBand: [] };
  }

  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      upperBand.push(null);
      middleBand.push(null);
      lowerBand.push(null);
      continue;
    }
    const window = prices.slice(i - period, i);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    middleBand.push(mean);
    upperBand.push(mean + multiplier * sd);
    lowerBand.push(mean - multiplier * sd);
  }

  // Guarantee same length as prices
  while (upperBand.length < prices.length) upperBand.unshift(null);
  while (middleBand.length < prices.length) middleBand.unshift(null);
  while (lowerBand.length < prices.length) lowerBand.unshift(null);

  return { upperBand, middleBand, lowerBand };
}

// ------------------------------
// RSI calculation + draw
// ------------------------------
function calculateRSI(prices, period = 14) {
  if (!Array.isArray(prices) || prices.length < period + 1) {
    return Array.isArray(prices) ? Array(prices.length).fill(null) : [];
  }
  const rsi = Array(prices.length).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + (avgGain / avgLoss));
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = 100 - 100 / (1 + rs);
  }
  return rsi;
}

function drawRSI(prices) {
  try {
    const rsiValues = calculateRSI(prices);
    const canvas = document.getElementById("rsiChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (rsiChart) rsiChart.destroy();
    rsiChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: prices.map((_, i) => i),
        datasets: [{ label: "RSI", data: rsiValues, borderColor: "#f39c12", borderWidth: 2, pointRadius: 0, tension: 0.2 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { display: false }, y: { min: 0, max: 100 } },
        plugins: { legend: { display: false } }
      }
    });
  } catch (e) {
    console.error("drawRSI error:", e);
  }
}

// ------------------------------
// MACD calculation + draw
// ------------------------------
function emaArray(values, period) {
  const k = 2 / (period + 1);
  const out = Array(values.length).fill(null);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev == null) {
      // initialize with average of available slice
      const start = Math.max(0, i - period + 1);
      const slice = values.slice(start, i + 1).filter(x => x != null);
      prev = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : v;
      out[i] = prev;
    } else {
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function calculateMACD(prices, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  try {
    const emaShort = emaArray(prices, shortPeriod);
    const emaLong = emaArray(prices, longPeriod);
    const macdLine = prices.map((_, i) => (emaShort[i] != null && emaLong[i] != null) ? (emaShort[i] - emaLong[i]) : null);
    const signalLine = emaArray(macdLine.map(v => v), signalPeriod);
    const histogram = macdLine.map((v, i) => (v != null && signalLine[i] != null) ? v - signalLine[i] : null);
    return { macdLine, signalLine, histogram };
  } catch (e) {
    console.error("calculateMACD error:", e);
    return { macdLine: [], signalLine: [], histogram: [] };
  }
}

function drawMACD(prices) {
  try {
    const { macdLine, signalLine, histogram } = calculateMACD(prices);
    const canvas = document.getElementById("macdChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (macdChart) macdChart.destroy();
    // Create color array for bars
    const barColors = histogram.map(v => (v == null ? "rgba(150,150,150,0.15)" : (v >= 0 ? "rgba(46,204,113,0.6)" : "rgba(231,76,60,0.6)")));
    macdChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: prices.map((_, i) => i),
        datasets: [
          { type: "line", label: "MACD", data: macdLine, borderColor: "#3498db", borderWidth: 2, pointRadius: 0, fill: false },
          { type: "line", label: "Signal", data: signalLine, borderColor: "#e67e22", borderWidth: 2, pointRadius: 0, fill: false },
          { type: "bar", label: "Histogram", data: histogram, backgroundColor: barColors }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false } } }
    });
  } catch (e) {
    console.error("drawMACD error:", e);
  }
}

// ------------------------------
// TAB SWITCHING (matches your HTML .tab + data-tab)
// ------------------------------
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-content").forEach(sec => sec.classList.remove("active"));
    const id = btn.dataset.tab;
    const target = document.getElementById(id);
    if (target) target.classList.add("active");
  });
});

// ------------------------------
// Build main chart + indicators + OHLC + news
// ------------------------------
async function buildMainChart(coin) {
  try {
    if (!mainCtx) {
      console.warn("Main chart canvas/context not found");
      return;
    }

    const trend = await fetchTrend(coin).catch(err => { throw err; });
    const prices = Array.isArray(trend.prices) ? trend.prices.map(p => Number(p) || 0) : [];
    const labels = Array.isArray(trend.dates) ? trend.dates : [];

    // header
    const latest = prices.length ? prices[prices.length - 1] : 0;
    if (coinPriceEl) coinPriceEl.textContent = `$${latest.toFixed(2)}`;
    if (coinNameEl) coinNameEl.textContent = `${coin.charAt(0).toUpperCase() + coin.slice(1)} Details`;
    if (newsCoinEl) newsCoinEl.textContent = coin.charAt(0).toUpperCase() + coin.slice(1);

    // OHLC data
    const historyData = await fetchHistory(coin).catch(err => {
      console.warn("history fetch failed:", err);
      return [];
    });
    fillOhlcTable(historyData || []);

    // destroy previous chart
    if (mainChart) mainChart.destroy();

    const { upperBand, middleBand, lowerBand } = calculateBollingerBands(prices);

    mainChart = new Chart(mainCtx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: `${coin.toUpperCase()} Price (USD)`, data: prices, borderColor: "#3498db", borderWidth: 2, tension: 0.3, fill: true, backgroundColor: "rgba(52,152,219,0.06)" },
          { label: "Upper Band", data: upperBand, borderColor: "#e74c3c", borderDash: [5,5], pointRadius: 0, fill: false },
          { label: "Middle Band", data: middleBand, borderColor: "#f1c40f", borderDash: [3,3], pointRadius: 0, fill: false },
          { label: "Lower Band", data: lowerBand, borderColor: "#2ecc71", borderDash: [5,5], pointRadius: 0, fill: false }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { labels: { color: "#aaa" } } },
        scales: { x: { ticks: { color: "#aaa" } }, y: { ticks: { color: "#aaa" } } }
      }
    });

    // Indicators
    drawRSI(prices);
    drawMACD(prices);

    // News
    const newsData = await fetchNews(coin);
    fillNewsSection(newsData);

  } catch (err) {
    console.error("Error building coin details:", err);
    try { mainCtx && (document.getElementById("coinChart").style.opacity = 0.6); } catch (e) {}
  }
}

// ------------------------------
// OHLC table + news UI helpers
// ------------------------------
function fillOhlcTable(data) {
  const tbody = document.querySelector("#ohlcTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6'>No OHLC data available</td></tr>";
    return;
  }

  const rows = data.slice(-30).reverse();
  rows.forEach(d => {
    const dateRaw = d.date || d.timestamp || d[0] || "";
    let dateStr = dateRaw;
    try {
      const dt = new Date(dateRaw);
      if (!isNaN(dt)) dateStr = dt.toLocaleString();
    } catch (e) {}

    const open = Number(d.open ?? d.o ?? d[1] ?? 0);
    const high = Number(d.high ?? d.h ?? d[2] ?? 0);
    const low = Number(d.low ?? d.l ?? d[3] ?? 0);
    const close = Number(d.close ?? d.c ?? d[4] ?? 0);
    const volume = Number(d.volume ?? d.v ?? d[5] ?? 0);

    tbody.innerHTML += `
      <tr>
        <td>${dateStr}</td>
        <td>$${open.toFixed(2)}</td>
        <td style="color:var(--green)">$${high.toFixed(2)}</td>
        <td style="color:var(--red)">$${low.toFixed(2)}</td>
        <td>$${close.toFixed(2)}</td>
        <td>${isNaN(volume) ? 0 : volume.toLocaleString()}</td>
      </tr>`;
  });
}

function fillNewsSection(newsData) {
  const newsContainer = document.getElementById("newsList");
  if (!newsContainer) return;
  newsContainer.innerHTML = "";

  if (!Array.isArray(newsData) || newsData.length === 0) {
    newsContainer.innerHTML = "<p>No recent news available.</p>";
    return;
  }

  newsData.forEach(article => {
    const card = document.createElement("div");
    card.className = "news-card";

    // FIX: support multiple backend formats
    const title = article.title || article.name || article.headline || "Untitled";
    const url = article.url || article.link || "#";
    const source =
      (article.source && (article.source.title || article.source.name || article.source)) ||
      article.publisher ||
      article.provider ||
      "Unknown";


    const summary =
      article.summary ||
      article.description ||
      article.snippet ||
      article.excerpt ||
      "";

    card.innerHTML = `
      <h4>${title}</h4>
      <p class="small muted">${source}</p>
      ${summary ? `<p>${summary}</p>` : ""}
      <a href="${url}" target="_blank" rel="noopener">Read more →</a>
    `;

    newsContainer.appendChild(card);
  });
}


// ------------------------------
// Theme toggle (do not change UI)
// ------------------------------
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

// ------------------------------
// UI events + initial build
// ------------------------------
coinSelect?.addEventListener("change", () => buildMainChart(coinSelect.value));
horizonSelect?.addEventListener("change", () => buildMainChart(coinSelect.value));

// initial load (no change to HTML)
if (coinSelect && coinSelect.value) buildMainChart(coinSelect.value);
else buildMainChart("bitcoin");
