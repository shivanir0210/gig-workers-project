import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

# Load dataset
df = pd.read_csv("GigShield_Income_Loss_Dataset_200.csv")

print(df.head())

# Features (Input)
X = df.drop(["City", "IncomeLoss(₹)"], axis=1)

# Target (Output)
y = df["IncomeLoss(₹)"]

print("\nFeatures (X):")
print(X.head())

print("\nTarget (y):")
print(y.head())

# Split dataset
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

print("\nTraining Data Size:", len(X_train))
print("Testing Data Size:", len(X_test))

# Create model
model = RandomForestRegressor(
    n_estimators=100,
    random_state=42
)

# Train model
model.fit(X_train, y_train)

print("\nModel trained successfully!")

# Predict
predictions = model.predict(X_test)

# Evaluation
mae = mean_absolute_error(y_test, predictions)
r2 = r2_score(y_test, predictions)

print("\nModel Evaluation")
print("Mean Absolute Error (MAE):", mae)
print("R² Score:", r2)

# Save model
joblib.dump(model, "income_loss_model.pkl")

print("\nModel saved successfully!")