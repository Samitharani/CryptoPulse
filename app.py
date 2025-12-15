from flask import Flask, jsonify, request
from flask_cors import CORS
from utils.fetch_data import (
    get_live_data,
    get_multiple_live_data,
    get_trend_data,
    get_history,
    get_top_movers
)
from utils.predict import lstm_predict
from utils.news_api import fetch_news
import traceback
from utils.predict import predict_bp
import pandas as pd


app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.register_blueprint(predict_bp)



@app.route("/api/live/<coin>", methods=["GET"])
def api_live(coin):
    try:
        data = get_live_data(coin)
        if isinstance(data, dict) and data.get("error"):
            return jsonify({"error": data["error"]}), 400
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/live-multi", methods=["GET"])
def api_live_multi():
    try:
        return jsonify(get_multiple_live_data())
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/history/<coin>", methods=["GET"])
def api_history(coin):
    try:
        days = int(request.args.get("days", 30))
        interval = request.args.get("interval", "1d")
        data = get_history(coin, days=days, interval=interval)
        if isinstance(data, dict) and data.get("error"):
            return jsonify({"error": data["error"]}), 400
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/trend/<coin>", methods=["GET"])
def api_trend(coin):
    try:
        days = int(request.args.get("days", 30))
        interval = request.args.get("interval", "1d")
        res = get_trend_data(coin, days=days, interval=interval)
        if isinstance(res, dict) and res.get("error"):
            return jsonify({"error": res["error"]}), 400
        return jsonify(res)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/top-movers", methods=["GET"])
def api_top_movers():
    try:
        coins = request.args.get("coins")
        if coins:
            coin_list = [c.strip() for c in coins.split(",")]
        else:
            coin_list = None
        res = get_top_movers(coin_list=coin_list)
        if isinstance(res, dict) and res.get("error"):
            return jsonify({"error": res["error"]}), 500
        return jsonify(res)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/predict/<coin>/<int:days>", methods=["GET"])
def api_predict(coin, days):
    try:
        hist = get_history(coin, days=90, interval="1d")

        if isinstance(hist, dict) and hist.get("error"):
            return jsonify(hist), 500

        df = pd.DataFrame(hist)
        if df.empty:
            return jsonify({"error": "No history available"}), 500

        from utils.predict import lstm_predict
        prices = lstm_predict(coin, df, days)

        if isinstance(prices, dict) and prices.get("error"):
            return jsonify(prices), 500

        dates = pd.date_range(start=pd.Timestamp.today(), periods=days).strftime("%Y-%m-%d").tolist()

        return jsonify({
            "coin": coin,
            "prices": prices,
            "dates": dates
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/news/<coin>")
def news_api(coin):
    return jsonify(fetch_news(coin))



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
