const btn = document.querySelector(".compare-btn");
const performerContent = document.getElementById("performer-content");
const metricsContent = document.getElementById("metrics-content");
let chart;

const API = "https://api.coingecko.com/api/v3";

async function getCoinData(coin) {
  const res = await fetch(`${API}/coins/${coin}?localization=false`);
  const data = await res.json();
  return data;
}


async function getMarketChart(coin) {
  const res = await fetch(`${API}/coins/${coin}/market_chart?vs_currency=usd&days=30`);
  const data = await res.json();
  return data.prices.map(p => ({ date: new Date(p[0]).toLocaleDateString(), price: p[1] }));
}

btn.addEventListener("click", async () => {
  const checked = [...document.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
  if (checked.length !== 2) {
    alert("Select exactly 2 coins to compare.");
    return;
  }

  try {
    const [coin1, coin2] = await Promise.all(checked.map(c => getCoinData(c)));
    renderTopPerformer([coin1, coin2]);
    renderMetrics([coin1, coin2]);
    const [data1, data2] = await Promise.all(checked.map(c => getMarketChart(c)));
    renderChart([coin1.name, coin2.name], [data1, data2]);
  } catch (err) {
    console.error("Error fetching data:", err);
  }
});

function renderTopPerformer(coins) {
  const best = coins.reduce((a,b) => 
    a.market_data.price_change_percentage_30d_in_currency.usd >
    b.market_data.price_change_percentage_30d_in_currency.usd ? a : b
  );
  performerContent.innerHTML = `
    <div class="top-performer">
      <div class="top-performer-left">
        <div class="coin-logo">${best.symbol.toUpperCase()[0]}</div>
        <div>
          <h2>${best.name}</h2>
          <p>${best.symbol.toUpperCase()}</p>
        </div>
      </div>
      <div>
        <h2>$${best.market_data.current_price.usd.toLocaleString()}</h2>
        <p class="${best.market_data.price_change_percentage_30d_in_currency.usd > 0 ? 'positive' : 'negative'}">
          ${best.market_data.price_change_percentage_30d_in_currency.usd.toFixed(2)}% (30d)
        </p>
      </div>
    </div>
  `;
}

function renderMetrics(coins) {
  const [c1, c2] = coins;
  metricsContent.innerHTML = `
    <table class="metrics-table">
      <thead>
        <tr><th>Metric</th><th>${c1.symbol.toUpperCase()}</th><th>${c2.symbol.toUpperCase()}</th></tr>
      </thead>
      <tbody>
        <tr><td>Current Price</td><td>$${c1.market_data.current_price.usd.toLocaleString()}</td><td>$${c2.market_data.current_price.usd.toLocaleString()}</td></tr>
        <tr><td>24h Change</td>
          <td class="${c1.market_data.price_change_percentage_24h > 0 ? 'positive' : 'negative'}">${c1.market_data.price_change_percentage_24h.toFixed(2)}%</td>
          <td class="${c2.market_data.price_change_percentage_24h > 0 ? 'positive' : 'negative'}">${c2.market_data.price_change_percentage_24h.toFixed(2)}%</td></tr>
        <tr><td>30d Performance</td>
          <td class="${c1.market_data.price_change_percentage_30d_in_currency.usd > 0 ? 'positive' : 'negative'}">${c1.market_data.price_change_percentage_30d_in_currency.usd.toFixed(2)}%</td>
          <td class="${c2.market_data.price_change_percentage_30d_in_currency.usd > 0 ? 'positive' : 'negative'}">${c2.market_data.price_change_percentage_30d_in_currency.usd.toFixed(2)}%</td></tr>
        <tr><td>Market Cap</td><td>$${(c1.market_data.market_cap.usd / 1e9).toFixed(2)}B</td><td>$${(c2.market_data.market_cap.usd / 1e9).toFixed(2)}B</td></tr>
        <tr><td>Volume (24h)</td><td>$${(c1.market_data.total_volume.usd / 1e9).toFixed(2)}B</td><td>$${(c2.market_data.total_volume.usd / 1e9).toFixed(2)}B</td></tr>
      </tbody>
    </table>
  `;
}

function renderChart(names, dataSets) {
  const ctx = document.getElementById("compareChart").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dataSets[0].map(d => d.date),
      datasets: [
        {
          label: names[0],
          data: dataSets[0].map(d => d.price),
          borderColor: "#f59e0b",
          tension: 0.3
        },
        {
          label: names[1],
          data: dataSets[1].map(d => d.price),
          borderColor: "#3b82f6",
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { maxTicksLimit: 10 }},
        y: { beginAtZero: false }
      },
      plugins: {
        legend: { position: "top" }
      }
    }
  });
}

const themeToggle = document.getElementById("themeToggle");
const currentTheme = localStorage.getItem("theme") || "light";

document.body.classList.add(`${currentTheme}-theme`);
themeToggle.textContent = currentTheme === "light" ? "🌙" : "☀️";

themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark-theme");
  document.body.classList.toggle("dark-theme", !isDark);
  document.body.classList.toggle("light-theme", isDark);

  themeToggle.textContent = isDark ? "🌙" : "☀️";
  localStorage.setItem("theme", isDark ? "light" : "dark");
});