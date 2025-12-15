# backend/utils/fetch_data.py
import time
import requests
from datetime import datetime, timedelta
import numpy as np

# SIMPLE in-memory cache (very small)
_cache = {}
CACHE_TTL = 20  # seconds

def _cache_get(key):
    rec = _cache.get(key)
    if not rec:
        return None
    ts, ttl, value = rec
    if time.time() - ts > ttl:
        _cache.pop(key, None)
        return None
    return value

def _cache_set(key, value, ttl=CACHE_TTL):
    _cache[key] = (time.time(), ttl, value)

BINANCE_BASE = "https://api.binance.com/api/v3"

# map friendly coin names to Binance symbols (we use USDT pairs)
COIN_TO_SYMBOL = {
    "bitcoin": "BTCUSDT",
    "btc": "BTCUSDT",
    "ethereum": "ETHUSDT",
    "eth": "ETHUSDT",
    "litecoin": "LTCUSDT",
    "ltc": "LTCUSDT",
    "binancecoin": "BNBUSDT",
    "bnb": "BNBUSDT",
    "ripple": "XRPUSDT",
    "xrp": "XRPUSDT"
}

def _call_binance(path, params=None, timeout=8):
    url = f"{BINANCE_BASE}{path}"
    try:
        r = requests.get(url, params=params, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}

# ---------------------------
# Live single coin
# ---------------------------
def get_live_data(coin):
    key = coin.lower()
    symbol = COIN_TO_SYMBOL.get(key)
    if not symbol:
        return {"error": f"Unknown coin: {coin}"}

    cache_key = f"live::{symbol}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    # Use /ticker/24hr for price + 24h change + volume
    res = _call_binance("/ticker/24hr", params={"symbol": symbol})
    if isinstance(res, dict) and res.get("error"):
        return {"error": res["error"]}

    try:
        price = float(res.get("lastPrice", res.get("lastPrice", 0)) or 0)
        change = float(res.get("priceChangePercent") or 0)
        volume = float(res.get("volume") or 0)
        quoteVol = float(res.get("quoteVolume") or 0)
        market_cap = None  # Binance API doesn't provide cap directly
        out = {
            "coin": key,
            "price": round(price, 6),
            "percent_change": round(change, 4),
            "market_cap": market_cap,
            "volume_24h": round(quoteVol, 6)
        }
        _cache_set(cache_key, out)
        return out
    except Exception as e:
        return {"error": str(e)}

# ---------------------------
# Live multiple (for dashboard to fetch all at once)
# ---------------------------
def get_multiple_live_data(coins=None):
    if coins is None:
        coins = ["bitcoin", "ethereum", "litecoin", "binancecoin", "ripple"]
    out = {}
    for c in coins:
        out[c] = get_live_data(c)
    return out

# ---------------------------
# History / OHLC-ish via klines
# interval: '1m','3m','5m','1h','1d'...
# days: how many days of history we want (approx)
# ---------------------------
def get_history(coin, days=30, interval="1d"):
    key = coin.lower()
    symbol = COIN_TO_SYMBOL.get(key)
    if not symbol:
        return {"error": f"Unknown coin: {coin}"}

    cache_key = f"hist::{symbol}::{days}::{interval}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    # Determine limit param: Binance klines limit max 1000
    # For daily candles, limit = days (cap at 1000)
    if interval.endswith("d") or interval == "1d":
        limit = min(max(1, days), 1000)
    else:
        # for intraday 1h, compute approx points
        if interval == "1h":
            limit = min(days * 24, 1000)
        else:
            limit = 500

    res = _call_binance("/klines", params={"symbol": symbol, "interval": interval, "limit": limit})
    if isinstance(res, dict) and res.get("error"):
        return {"error": res["error"]}

    if not isinstance(res, list):
        return {"error": "Unexpected klines response"}

    out = []
    for k in res:
        # k = [openTime, open, high, low, close, volume, closeTime, ...]
        try:
            ts = int(k[0])
            dt = datetime.utcfromtimestamp(ts // 1000)
            date_str = dt.strftime("%Y-%m-%d")
            ts_str = dt.strftime("%Y-%m-%d %H:%M:%S")
            open_p = float(k[1])
            high_p = float(k[2])
            low_p = float(k[3])
            close_p = float(k[4])
            vol = float(k[5])
            out.append({
                "date": date_str,
                "timestamp": ts_str,
                "open": open_p,
                "high": high_p,
                "low": low_p,
                "close": close_p,
                "volume": vol
            })
        except Exception:
            continue

    _cache_set(cache_key, out)
    return out

# ---------------------------
# Trend Data: dates + prices
# ---------------------------
def get_trend_data(coin, days=30, interval="1d"):
    hist = get_history(coin, days=days, interval=interval)
    if isinstance(hist, dict) and hist.get("error"):
        return hist
    try:
        dates = [r["date"] for r in hist]
        prices = [float(r["close"]) for r in hist]
        return {"dates": dates, "prices": prices}
    except Exception as e:
        return {"error": str(e)}

# ---------------------------
# Top movers among provided small set (or default set)
# ---------------------------
def get_top_movers(coin_list=None, top_n=3):
    if coin_list is None:
        coin_list = ["bitcoin", "ethereum", "litecoin", "binancecoin", "ripple"]
    processed = []
    for c in coin_list:
        res = get_live_data(c)
        if isinstance(res, dict) and res.get("error"):
            continue
        processed.append({"coin": c, "change": res.get("percent_change", 0)})
    if not processed:
        return {"gainers": [], "losers": []}
    gainers = sorted(processed, key=lambda x: x["change"], reverse=True)[:top_n]
    losers = sorted(processed, key=lambda x: x["change"])[:top_n]
    return {"gainers": gainers, "losers": losers}
