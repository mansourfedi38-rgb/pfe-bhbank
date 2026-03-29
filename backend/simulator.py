import requests
import random
from datetime import datetime
import time

API_URL = "http://127.0.0.1:8000/api/sensor-data/"

AGENCIES = [1, 2, 3]  # change depending on your DB


def generate_data():
    temperature = round(random.uniform(20, 35), 2)
    clients_count = random.randint(0, 20)
    energy_usage = round(random.uniform(0.5, 3.0), 3)

    # Simple AC logic
    if temperature > 30:
        ac_mode = "ON"
    elif temperature > 24:
        ac_mode = "ECO"
    else:
        ac_mode = "OFF"

    return {
        "temperature": temperature,
        "clients_count": clients_count,
        "energy_usage": energy_usage,
        "ac_mode": ac_mode,
        "timestamp": datetime.utcnow().isoformat(),
    }


def send_data():
    for agency_id in AGENCIES:
        data = generate_data()
        data["agency"] = agency_id

        try:
            response = requests.post(API_URL, json=data)

            print(f"Sent to agency {agency_id}: {response.status_code}")
            print("Response:", response.text)
            print("-----------")
        except Exception as e:
            print("Error:", e)


if __name__ == "__main__":
    while True:
        send_data()
        print("Waiting 5 minutes...\n")
        time.sleep(300)  # 5 minutes

