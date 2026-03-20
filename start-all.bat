@echo off
echo Starting GigShield Backend...
cd /d %~dp0backend
start cmd /k "node server.js"
echo Backend started on http://localhost:5000

echo Starting GigShield ML Service...
cd /d %~dp0ml-service
start cmd /k "python app.py"
echo ML Service started on http://localhost:8000

echo Starting GigShield Frontend...
cd /d %~dp0frontend
start cmd /k "npm run dev"
echo Frontend started on http://localhost:5173

echo.
echo All services started!
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:5000
echo ML:       http://localhost:8000
