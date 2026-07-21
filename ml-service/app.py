import os
import base64
import io
import re
import joblib
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
import pytesseract
import cv2
from pdf2image import convert_from_bytes

app = Flask(__name__)
CORS(app)

# Load the trained ML model cleanly using relative path
MODEL_PATH = os.path.join(os.path.dirname(__file__), "income_loss_model.pkl")
model = joblib.load(MODEL_PATH)

CITY_RISK_SCORES = {
    'Mumbai': 0.85, 'Delhi': 0.90, 'Bangalore': 0.60,
    'Chennai': 0.75, 'Hyderabad': 0.65, 'Pune': 0.70
}

PLATFORM_MULTIPLIERS = {'Zepto': 1.1, 'Swiggy': 1.0, 'Zomato': 1.0, 'Other': 0.95}

def calculate_premium(city, weekly_income, platform):
    city_risk = CITY_RISK_SCORES.get(city, 0.70)
    platform_mult = PLATFORM_MULTIPLIERS.get(platform, 1.0)
    income_factor = min(weekly_income / 5000, 1.5)
    base_rate = 0.02
    premium = weekly_income * base_rate * city_risk * platform_mult * income_factor
    return round(premium, 2)

def get_risk_level(city, weekly_income):
    city_risk = CITY_RISK_SCORES.get(city, 0.70)
    income_risk = min(weekly_income / 5000, 1.0)
    combined = (city_risk * 0.6) + (income_risk * 0.4)
    if combined > 0.75: return 'high'
    if combined > 0.55: return 'medium'
    return 'low'

@app.route('/predict-risk', methods=['POST'])
def predict_risk():
    data = request.json or {}
    city = data.get('city', 'Mumbai')
    weekly_income = float(data.get('weeklyIncome', 3000))
    platform = data.get('platform', 'Other')
    risk_level = get_risk_level(city, weekly_income)
    weekly_premium = calculate_premium(city, weekly_income, platform)
    return jsonify({
        'riskLevel': risk_level,
        'weeklyPremium': weekly_premium,
        'cityRiskScore': CITY_RISK_SCORES.get(city, 0.70),
        'confidence': 0.85
    })

def normalize_text(text):
    return (text or '').replace('\n', ' ').replace('\r', ' ').strip()

def extract_aadhaar(text):
    if not text:
        return ''
    digits = re.findall(r'\d{12}', text)
    if digits:
        return digits[0]
    condensed = re.sub(r'[^0-9]', '', text)
    if len(condensed) >= 12:
        return condensed[:12]
    return ''

def ocr_image(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 9, 75, 75)
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                            cv2.THRESH_BINARY, 11, 2)
    data = pytesseract.image_to_data(thresh, output_type=pytesseract.Output.DICT, config='--oem 3 --psm 6')
    text = ' '.join(data['text']).strip()
    confidences = [int(conf) for conf in data['conf'] if conf.isdigit() and int(conf) >= 0]
    confidence = int(np.mean(confidences)) if confidences else 0
    return normalize_text(text), confidence

def load_image_from_base64(data_url):
    match = re.match(r'^data:(.*?);base64,(.*)$', data_url)
    if not match:
        return None, None
    mime = match.group(1)
    raw_data = base64.b64decode(match.group(2))
    if 'pdf' in mime:
        images = convert_from_bytes(raw_data, dpi=300)
        if not images:
            return None, None
        pil_image = images[0]
    else:
        pil_image = Image.open(io.BytesIO(raw_data)).convert('RGB')
    open_cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    return open_cv_image, raw_data

@app.route('/verify-aadhaar', methods=['POST'])
def verify_aadhaar():
    data = request.json or {}
    name = data.get('name')
    base64_data = data.get('base64')
    if not name or not base64_data:
        return jsonify({'error': 'Missing name or base64 data'}), 400

    image, raw_bytes = load_image_from_base64(base64_data)
    if image is None:
        return jsonify({'aadhaarNumber': '', 'confidence': 0, 'rawText': '',
                        'error': 'Unable to load document for OCR'}), 200

    text, confidence = ocr_image(image)
    aadhaar_number = extract_aadhaar(text)
    return jsonify({
        'aadhaarNumber': aadhaar_number,
        'confidence': confidence,
        'rawText': text
    })

@app.route('/income-prediction', methods=['POST'])
def income_prediction():
    data = request.json or {}

    weekly_income = float(data.get('weeklyIncome', 3000))
    rainfall = float(data.get('rainfall', 0))
    aqi = float(data.get('AQI', 0))
    temperature = float(data.get('temperature', 30))
    humidity = float(data.get('humidity', 60))
    orders_per_day = float(data.get('ordersPerDay', 10))
    online_hours = float(data.get('onlineHours', 8))

    input_df = pd.DataFrame([{
        "Rainfall(mm)": rainfall,
        "AQI": aqi,
        "Temperature(C)": temperature,
        "Humidity(%)": humidity,
        "WeeklyIncome(₹)": weekly_income,
        "OrdersPerDay": orders_per_day,
        "OnlineHours": online_hours
    }])

    estimated_loss = round(float(model.predict(input_df)[0]), 2)

    return jsonify({
        "estimatedWeeklyLoss": estimated_loss,
        "lossPercentage": round((estimated_loss / weekly_income) * 100, 1),
        "recommendation": (
            "Premium"
            if estimated_loss > weekly_income * 0.30
            else "Standard"
            if estimated_loss > weekly_income * 0.15
            else "Basic"
        )
    })

@app.route('/fraud-detection', methods=['POST'])
def fraud_detection():
    data = request.json or {}
    trust_score = float(data.get('trustScore', 100))
    claims_last_week = int(data.get('claimsLastWeek', 0))
    gps_verified = bool(data.get('gpsVerified', True))
    activity_verified = bool(data.get('activityVerified', True))

    anomaly_score = 0
    if trust_score < 70: anomaly_score += 25
    if claims_last_week > 3: anomaly_score += 30
    if not gps_verified: anomaly_score += 25
    if not activity_verified: anomaly_score += 20

    return jsonify({
        'anomalyScore': min(anomaly_score, 100),
        'isSuspicious': anomaly_score > 50,
        'recommendation': 'reject' if anomaly_score > 70 else 'review' if anomaly_score > 40 else 'approve'
    })

@app.route("/")
def home():
    return jsonify({
        "status": "GigShield ML Service Running",
        "message": "Welcome to GigShield ML API",
        "health": "/health",
        "prediction": "/income-prediction",
        "ocr": "/verify-aadhaar",
        "risk": "/predict-risk",
        "fraud": "/fraud-detection"
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
