import random
import time
from datetime import datetime, timedelta, timezone

import requests


API_BASE_URL = "http://127.0.0.1:8000"
LOGIN_URL = f"{API_BASE_URL}/api/auth/login/"
REFRESH_URL = f"{API_BASE_URL}/api/auth/refresh/"
API_URL = f"{API_BASE_URL}/api/sensor-data/"

AUTH_EMAIL = "admin@bhbank.tn"
AUTH_PASSWORD = "adminpass123"

MODE = "historical"  # Options: "live" or "historical"

INTERVAL_SECONDS = 300  # Live mode interval. Change to 10 while testing.

HISTORICAL_START_DATE = "2025-01-01"
HISTORICAL_END_DATE = "2025-12-31"
HISTORICAL_INTERVAL_MINUTES = 60

AGENCIES = {
    1: {
        "name": "BH Bank Nabeul",
        "base_temperature_adjustment": 0.2,
        "load_factor": 1.00,
        "traffic_factor": 0.90,
    },
    2: {
        "name": "BH Bank Mrezga",
        "base_temperature_adjustment": 0.7,
        "load_factor": 1.12,
        "traffic_factor": 1.05,
    },
    3: {
        "name": "BH Bank Dar Chaaben",
        "base_temperature_adjustment": -0.3,
        "load_factor": 0.88,
        "traffic_factor": 0.75,
    },
}

MONTHLY_TEMPERATURE_RANGES = {
    1: (14, 18),
    2: (15, 19),
    3: (17, 22),
    4: (19, 25),
    5: (22, 29),
    6: (26, 33),
    7: (29, 36),
    8: (29, 36),
    9: (26, 32),
    10: (22, 28),
    11: (18, 23),
    12: (15, 19),
}

ACCESS_TOKEN = None
REFRESH_TOKEN = None


def login():
    """Authenticate with the backend and store JWT tokens."""
    global ACCESS_TOKEN, REFRESH_TOKEN

    payload = {
        "email": AUTH_EMAIL,
        "password": AUTH_PASSWORD,
    }

    try:
        response = requests.post(LOGIN_URL, json=payload, timeout=10)
    except requests.RequestException as exc:
        print(f"[AUTH ERROR] Login request failed: {exc}")
        return False

    if response.status_code != 200:
        print(f"[AUTH ERROR] Login failed ({response.status_code}): {response.text}")
        return False

    tokens = response.json()
    ACCESS_TOKEN = tokens.get("access")
    REFRESH_TOKEN = tokens.get("refresh")

    if not ACCESS_TOKEN:
        print("[AUTH ERROR] Login response did not contain an access token.")
        return False

    print(f"[AUTH OK] Logged in as {AUTH_EMAIL}")
    return True


def refresh_token():
    """Refresh the access token, falling back to login when refresh fails."""
    global ACCESS_TOKEN

    if not REFRESH_TOKEN:
        print("[AUTH] No refresh token available. Logging in again...")
        return login()

    try:
        response = requests.post(
            REFRESH_URL,
            json={"refresh": REFRESH_TOKEN},
            timeout=10,
        )
    except requests.RequestException as exc:
        print(f"[AUTH ERROR] Refresh request failed: {exc}")
        return False

    if response.status_code != 200:
        print(f"[AUTH] Refresh failed ({response.status_code}). Logging in again...")
        return login()

    ACCESS_TOKEN = response.json().get("access")
    if not ACCESS_TOKEN:
        print("[AUTH] Refresh response did not contain an access token. Logging in again...")
        return login()

    print("[AUTH OK] Access token refreshed")
    return True


def get_auth_headers():
    """Return headers required by the protected sensor endpoint."""
    return {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }


def get_seasonal_temperature(current_time, agency_profile):
    """Return realistic Nabeul-style temperature for a timestamp.

    The monthly range creates seasonal behavior, and the hourly adjustment
    creates the expected daily curve: cool morning/night and warmer afternoon.
    """
    low, high = MONTHLY_TEMPERATURE_RANGES[current_time.month]
    monthly_midpoint = (low + high) / 2

    hour = current_time.hour
    if 5 <= hour < 9:
        daily_offset = -2.0
    elif 9 <= hour < 12:
        daily_offset = -0.2
    elif 12 <= hour < 16:
        daily_offset = 2.4
    elif 16 <= hour < 20:
        daily_offset = 0.8
    else:
        daily_offset = -2.8

    seasonal_noise = random.uniform(-0.45, 0.45)
    temperature = (
        monthly_midpoint
        + daily_offset
        + agency_profile["base_temperature_adjustment"]
        + seasonal_noise
    )

    return round(min(38.0, max(8.0, temperature)), 2)


def get_clients_for_time(current_time, agency_profile):
    """Estimate realistic agency traffic for a given date and hour."""
    hour = current_time.hour
    is_weekend = current_time.weekday() >= 5

    if is_weekend:
        base_clients = 0
    elif 8 <= hour < 10:
        base_clients = 9
    elif 10 <= hour < 13:
        base_clients = 22
    elif 13 <= hour < 15:
        base_clients = 17
    elif 15 <= hour < 17:
        base_clients = 10
    else:
        base_clients = 0

    if base_clients == 0:
        return 0

    traffic = base_clients * agency_profile["traffic_factor"]
    variation = random.randint(-2, 2)
    clients_count = round(traffic + variation)

    return int(min(35, max(0, clients_count)))


def calculate_ac_mode(temperature, clients_count):
    """Choose AC mode from temperature and occupancy."""
    if clients_count == 0:
        return "OFF"
    if temperature >= 29 or clients_count >= 22:
        return "ON"
    if temperature >= 24 or clients_count >= 8:
        return "ECO"
    return "OFF"


def calculate_energy_usage(temperature, clients_count, ac_mode, load_factor):
    """Estimate kWh per reading from realistic drivers.

    Closed agencies still consume a small baseline for lighting, network,
    standby devices, and refrigeration/security systems.
    """
    ac_base_consumption = {
        "OFF": 0.18 if clients_count == 0 else 0.45,
        "ECO": 1.10,
        "ON": 2.25,
    }

    base = ac_base_consumption[ac_mode]
    client_impact = clients_count * 0.035
    heat_impact = max(0, temperature - 24) * 0.13
    summer_impact = 0.20 if temperature >= 30 else 0
    noise = random.uniform(-0.06, 0.06)

    energy_usage = (
        base
        + client_impact
        + heat_impact
        + summer_impact
    ) * load_factor + noise

    return round(min(5.0, max(0.1, energy_usage)), 3)


def build_historical_payload(agency_id, current_time):
    """Build a DRF-compatible historical sensor payload."""
    agency_profile = AGENCIES[agency_id]
    temperature = get_seasonal_temperature(current_time, agency_profile)
    clients_count = get_clients_for_time(current_time, agency_profile)
    ac_mode = calculate_ac_mode(temperature, clients_count)
    energy_usage = calculate_energy_usage(
        temperature=temperature,
        clients_count=clients_count,
        ac_mode=ac_mode,
        load_factor=agency_profile["load_factor"],
    )

    return {
        "agency": agency_id,
        "temperature": temperature,
        "clients_count": clients_count,
        "energy_usage": energy_usage,
        "ac_mode": ac_mode,
        "timestamp": current_time.replace(tzinfo=timezone.utc).isoformat(),
    }


def initialize_live_agency_states():
    """Create persistent live state per agency to avoid random jumps."""
    agency_state = {}
    now = datetime.now()

    for agency_id in AGENCIES:
        payload = build_historical_payload(agency_id, now)
        agency_state[agency_id] = {
            "temperature": payload["temperature"],
            "clients_count": payload["clients_count"],
            "energy_usage": payload["energy_usage"],
            "ac_mode": payload["ac_mode"],
        }

    return agency_state


def update_live_agency_state(agency_id, state):
    """Gradually move live readings toward the current realistic target."""
    agency_profile = AGENCIES[agency_id]
    now = datetime.now()

    target_temperature = get_seasonal_temperature(now, agency_profile)
    temperature_delta = target_temperature - state["temperature"]
    temperature_delta = min(0.4, max(-0.4, temperature_delta))
    temperature = state["temperature"] + temperature_delta

    target_clients = get_clients_for_time(now, agency_profile)
    client_delta = target_clients - state["clients_count"]
    client_delta = min(3, max(-3, client_delta))
    client_noise = random.choice([-1, 0, 0, 1]) if target_clients > 0 else 0
    clients_count = state["clients_count"] + client_delta + client_noise
    clients_count = min(35, max(0, clients_count))

    ac_mode = calculate_ac_mode(temperature, clients_count)
    energy_usage = calculate_energy_usage(
        temperature=temperature,
        clients_count=clients_count,
        ac_mode=ac_mode,
        load_factor=agency_profile["load_factor"],
    )

    state.update(
        {
            "temperature": round(temperature, 2),
            "clients_count": int(clients_count),
            "energy_usage": energy_usage,
            "ac_mode": ac_mode,
        }
    )

    return state


def build_live_payload(agency_id, state):
    """Build a live sensor payload from persistent agency state."""
    return {
        "agency": agency_id,
        "temperature": state["temperature"],
        "clients_count": state["clients_count"],
        "energy_usage": state["energy_usage"],
        "ac_mode": state["ac_mode"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def is_duplicate_response(response):
    """Detect duplicate agency/timestamp validation errors."""
    response_text = response.text.lower()
    return (
        response.status_code == 400
        and (
            "already exists" in response_text
            or "unique" in response_text
            or "duplicate" in response_text
        )
    )


def post_sensor_data(agency_id, payload, retry=True, log_success=True):
    """Post one sensor reading, refreshing/relogging on token expiry."""
    try:
        response = requests.post(
            API_URL,
            json=payload,
            headers=get_auth_headers(),
            timeout=10,
        )
    except requests.RequestException as exc:
        print(f"[POST ERROR] Agency {agency_id} request failed: {exc}")
        return "error"

    if response.status_code == 401 and retry:
        print(f"[AUTH] Agency {agency_id} POST returned 401. Refreshing token...")
        if refresh_token():
            return post_sensor_data(
                agency_id,
                payload,
                retry=False,
                log_success=log_success,
            )
        print(f"[POST ERROR] Agency {agency_id} could not refresh authentication.")
        return "error"

    if response.status_code in (200, 201):
        if log_success:
            print_reading_log("[OK]", agency_id, payload)
        return "success"

    if is_duplicate_response(response):
        print_duplicate_log(agency_id, payload)
        return "duplicate"

    print(f"[POST ERROR] Agency {agency_id} failed ({response.status_code}): {response.text}")
    return "error"


def print_reading_log(prefix, agency_id, payload):
    agency_name = AGENCIES[agency_id]["name"]
    display_time = payload["timestamp"][:16].replace("T", " ")
    print(
        f"{prefix} {display_time} | "
        f"{agency_name} (ID {agency_id}) | "
        f"Temp: {payload['temperature']:.1f}C | "
        f"Clients: {payload['clients_count']} | "
        f"AC: {payload['ac_mode']} | "
        f"Energy: {payload['energy_usage']:.2f} kWh"
    )


def print_duplicate_log(agency_id, payload):
    display_time = payload["timestamp"][:16].replace("T", " ")
    print(f"[SKIP] Duplicate reading for Agency {agency_id} at {display_time}")


def parse_historical_date(value):
    return datetime.strptime(value, "%Y-%m-%d")


def run_historical_mode():
    """Generate authenticated historical readings for all configured agencies."""
    if not login():
        print("[STOP] Historical simulator cannot start without authentication.")
        return

    start_date = parse_historical_date(HISTORICAL_START_DATE)
    end_date = parse_historical_date(HISTORICAL_END_DATE) + timedelta(days=1)
    current_time = start_date
    step = timedelta(minutes=HISTORICAL_INTERVAL_MINUTES)

    success_count = 0
    skipped_count = 0
    error_count = 0
    last_logged_date = None

    print(
        "[HISTORICAL] Generating data from "
        f"{HISTORICAL_START_DATE} to {HISTORICAL_END_DATE}"
    )
    print(f"[HISTORICAL] Interval: {HISTORICAL_INTERVAL_MINUTES} minutes")

    while current_time < end_date:
        if current_time.date() != last_logged_date:
            last_logged_date = current_time.date()
            print(f"[HISTORICAL] Current date: {last_logged_date}")

        for agency_id in AGENCIES:
            payload = build_historical_payload(agency_id, current_time)
            result = post_sensor_data(agency_id, payload, log_success=True)

            if result == "success":
                success_count += 1
            elif result == "duplicate":
                skipped_count += 1
            else:
                error_count += 1

        current_time += step

    print(
        "[DONE] "
        f"Success: {success_count} | "
        f"Skipped: {skipped_count} | "
        f"Errors: {error_count}"
    )


def run_live_mode():
    """Run continuous authenticated live simulation."""
    if not login():
        print("[STOP] Live simulator cannot start without authentication.")
        return

    agency_state = initialize_live_agency_states()
    print(f"[START] Live IoT simulator running. Interval: {INTERVAL_SECONDS} seconds")

    while True:
        print(f"\n[CYCLE] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        for agency_id in AGENCIES:
            updated_state = update_live_agency_state(agency_id, agency_state[agency_id])
            payload = build_live_payload(agency_id, updated_state)
            post_sensor_data(agency_id, payload)

        print(f"[WAIT] Next cycle in {INTERVAL_SECONDS} seconds")
        time.sleep(INTERVAL_SECONDS)


def main():
    if MODE == "historical":
        run_historical_mode()
        return

    if MODE == "live":
        run_live_mode()
        return

    print(f"[CONFIG ERROR] Unknown MODE '{MODE}'. Use 'live' or 'historical'.")


if __name__ == "__main__":
    main()
