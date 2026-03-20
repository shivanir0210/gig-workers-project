# GigShield — AI-Powered Parametric Insurance for Gig Workers

## Project Structure
```
Gig/
├── backend/          # Node.js + Express + MongoDB
├── frontend/         # React + Tailwind CSS
├── ml-service/       # Python Flask AI/ML service
└── start-all.bat     # One-click startup script
```

## Prerequisites
- Node.js 18+
- Python 3.9+
- MongoDB running locally on `mongodb://127.0.0.1:27017`

## Setup & Run

### 1. Backend
```bash
cd backend
# Edit .env and add your API keys (optional — mock data works without them)
npm start
```

### 2. ML Service
```bash
cd ml-service
pip install -r requirements.txt
python app.py
```

### 3. Frontend
```bash
cd frontend
npm run dev
```

### Or use the one-click script (Windows):
```
start-all.bat
```

## URLs
| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:5173  |
| Backend  | http://localhost:5000  |
| ML API   | http://localhost:8000  |

## API Keys (Optional)
Edit `backend/.env`:
- `OPENWEATHER_API_KEY` — from openweathermap.org (free tier)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — from razorpay.com (test mode)

Without API keys, the system uses realistic mock data automatically.

## Features
- **AI Risk Assessment** — personalized weekly premiums based on city + income
- **Parametric Auto-Claims** — triggered when rainfall > 50mm, AQI > 200, or temp > 42°C
- **Fraud Detection** — GPS, activity, and anomaly score validation
- **Risk Heatmap** — disruption levels across 6 major cities
- **Income Loss Prediction** — weekly earning risk estimates
- **AI Chatbot** — policy Q&A assistant
- **Transparency Dashboard** — claim status, triggers, payouts

## Claim Trigger Thresholds
| Trigger     | Default Threshold |
|-------------|-------------------|
| Rainfall    | > 50 mm           |
| AQI         | > 200             |
| Temperature | > 42°C            |

## Coverage
✅ Income loss due to extreme weather  
✅ Income loss due to poor air quality  
✅ Income loss due to curfews  
❌ Health / accident / vehicle damage (excluded by design)
