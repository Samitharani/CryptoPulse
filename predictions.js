// frontend/prediction.js
const API_BASE = "http://127.0.0.1:5000/api";
const coinSelect = document.getElementById("coinSelect");
const horizonSelect = document.getElementById("horizonSelect");
const generateBtn = document.getElementById("generateBtn");
const currentPriceEl = document.getElementById("currentPrice");
const predictedPriceEl = document.getElementById("predictedPrice");
const expectedChangeEl = document.getElementById("expectedChange");
const confidenceEl = document.getElementById("confidence");
const horizonLabel = document.getElementById("horizonLabel");
let chartInstance;

function renderChart(dates, prices) {
  const ctx = document.getElementById("predictionChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "line",
    data: { labels: dates, datasets: [{ label: "Predicted Price (USD)", data: prices, borderColor: "#4CAF50", tension: 0.2 }] },
    options: { responsive: true }
  });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function generatePrediction() {
  const coin = coinSelect.value;
  const horizon = parseInt(horizonSelect.value);
  horizonLabel.textContent = `${horizon}d`;

  try {
    const liveData = await fetchJSON(`${API_BASE}/live/${coin}`);
    if (liveData.error) throw new Error(liveData.error);
    const currentPrice = Number(liveData.price || 0);
    currentPriceEl.textContent = `$${currentPrice.toFixed(2)}`;

    const trendData = await fetchJSON(`${API_BASE}/predict/${coin}/${horizon}`);
    if (trendData.error) throw new Error(trendData.error);

    const prices = Array.isArray(trendData.prices) ? trendData.prices.slice(0, horizon) : [];
    const dates = Array.isArray(trendData.dates) ? trendData.dates.slice(0, horizon) : [];

    if (prices.length === 0 || dates.length === 0) throw new Error("No prediction results");

    renderChart(dates, prices);

    const predictedPrice = Number(prices[prices.length - 1]);
    predictedPriceEl.textContent = `$${predictedPrice.toFixed(2)}`;
    const change = currentPrice ? ((predictedPrice - currentPrice) / currentPrice) * 100 : 0;
    expectedChangeEl.textContent = `${change.toFixed(2)}%`;
    confidenceEl.textContent = `${Math.max(0, (100 - Math.abs(change) * 0.8)).toFixed(1)}%`;

  } catch (err) {
    console.error("Prediction failed:", err);
    alert(`Prediction failed: ${err.message}`);
  }
}

generateBtn?.addEventListener("click", generatePrediction);

// theme toggle preserved (same as earlier)
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
