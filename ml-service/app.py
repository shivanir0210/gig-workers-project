from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np

app = Flask(__name__)
CORS(app)

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
    data = request.json
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

@app.route('/income-prediction', methods=['POST'])
def income_prediction():
    data = request.json
    city = data.get('city', 'Mumbai')
    weekly_income = float(data.get('weeklyIncome', 3000))
    city_risk = CITY_RISK_SCORES.get(city, 0.70)
    disruption_days_per_week = round(city_risk * 2.5, 1)
    daily_income = weekly_income / 6
    estimated_loss = round(daily_income * disruption_days_per_week, 2)
    return jsonify({
        'estimatedWeeklyLoss': estimated_loss,
        'disruptionDaysPerWeek': disruption_days_per_week,
        'lossPercentage': round((estimated_loss / weekly_income) * 100, 1),
        'recommendation': 'Premium' if city_risk > 0.75 else 'Standard' if city_risk > 0.55 else 'Basic'
    })

@app.route('/fraud-detection', methods=['POST'])
def fraud_detection():
    data = request.json
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

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(port=8000, debug=True)
