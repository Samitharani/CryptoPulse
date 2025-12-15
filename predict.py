from flask import Blueprint, request, jsonify
import pandas as pd
import numpy as np
from utils.fetch_data import get_history
import joblib
from tensorflow.keras.models import load_model
import os

predict_bp = Blueprint("predict", __name__)

MODEL_FOLDER = "model/"
FEATURES = ['close', 'ma7', 'ma30', 'volatility', 'lag1', 'lag7', 'hl_ratio', 'co_ratio']


def build_features(df):
    """Create the same features used during training."""
    df['ma7'] = df['close'].rolling(7).mean()
    df['ma30'] = df['close'].rolling(30).mean()
    df['volatility'] = df['close'].rolling(7).std()
    df['lag1'] = df['close'].shift(1)
    df['lag7'] = df['close'].shift(7)
    df['hl_ratio'] = df['high'] / df['low']
    df['co_ratio'] = df['close'] / df['open']
    df.fillna(0, inplace=True)
    return df


def lstm_predict(coin, df, horizon):
    """Load LSTM model, generate multi-step forecast."""
    coin = coin.lower()

    model_path = os.path.join(MODEL_FOLDER, f"{coin}_model.h5")
    scaler_path = os.path.join(MODEL_FOLDER, f"{coin}_scaler.save")

    if not os.path.exists(model_path) or not os.path.exists(scaler_path):
        return {"error": f"Model or scaler missing for {coin}"}

    # FIX 1: Avoid keras.metrics.mse load error
    model = load_model(model_path, compile=False)
    scaler = joblib.load(scaler_path)

    df = build_features(df)

    scaled = scaler.transform(df[FEATURES])
    if len(scaled) < 30:
        return {"error": "Not enough historical data for prediction"}

    last_seq = np.array(scaled[-30:])  # shape (30, 8)

    predictions = []
    for _ in range(horizon):
        seq_input = np.expand_dims(last_seq, axis=0)  # shape (1,30,8)
        pred_scaled = model.predict(seq_input)[0][0]

        # Unscale
        dummy = np.zeros((1, len(FEATURES)))
        dummy[0][0] = pred_scaled
        pred_price = scaler.inverse_transform(dummy)[0][0]

        predictions.append(float(pred_price))

        # Generate next-step input
        new_row = np.array(last_seq[-1])
        new_row[0] = pred_scaled
        last_seq = np.vstack([last_seq[1:], new_row])

    return predictions
