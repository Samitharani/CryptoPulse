import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
import joblib
import os
import yfinance as yf


coins = {
    "bitcoin": "BTC-USD",
    "ethereum": "ETH-USD",
    "litecoin": "LTC-USD",
    "binancecoin": "BNB-USD",
    "ripple": "XRP-USD"
}


save_folder = "model/"
os.makedirs(save_folder, exist_ok=True)

features = ['close', 'ma7', 'ma30', 'volatility', 'lag1', 'lag7', 'hl_ratio', 'co_ratio']

for coin, ticker in coins.items():
    print(f"\n Processing {coin}...")
    try:
        df = yf.download(ticker, start="2013-01-01", end="2025-09-01")
        if df.empty:
            print(f" No data fetched for {ticker}. Skipping.")
            continue

        df.reset_index(inplace=True)
        df.rename(columns={
            "Date": "timestamp",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume"
        }, inplace=True)

        # Feature engineering
        df['ma7'] = df['close'].rolling(7).mean()
        df['ma30'] = df['close'].rolling(30).mean()
        df['volatility'] = df['close'].rolling(7).std()
        df['lag1'] = df['close'].shift(1)
        df['lag7'] = df['close'].shift(7)
        df['hl_ratio'] = df['high'] / df['low']
        df['co_ratio'] = df['close'] / df['open']
        df.fillna(0, inplace=True)

        # Scale data
        scaler = MinMaxScaler()
        data_scaled = scaler.fit_transform(df[features])
        joblib.dump(scaler, os.path.join(save_folder, f"{coin}_scaler.save"))

        # Sequences
        seq_length = 30
        X, y = [], []
        for i in range(seq_length, len(data_scaled)):
            X.append(data_scaled[i-seq_length:i])
            y.append(data_scaled[i, 0])
        X, y = np.array(X), np.array(y)

        if len(X) == 0:
            print(f" Not enough data to train {coin}. Skipping.")
            continue

        # Split
        split = int(0.8 * len(X))
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]

        # Model
        model = Sequential([
            LSTM(64, input_shape=(X_train.shape[1], X_train.shape[2])),
            Dense(1)
        ])
        model.compile(optimizer='adam', loss='mse')
        model.fit(X_train, y_train, validation_data=(X_test, y_test),
                  epochs=5, batch_size=32, verbose=1)

        model.save(os.path.join(save_folder, f"{coin}_model.h5"))
        print(f" {coin.capitalize()} model and scaler saved!")

    except Exception as e:
        print(f" Error processing {coin}: {e}")
