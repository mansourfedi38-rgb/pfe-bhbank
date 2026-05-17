import os
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from monitoring.models import Agency, SensorData
from simulator import (
    AGENCIES,
    calculate_ac_mode,
    calculate_energy_usage,
    get_clients_for_time,
    get_seasonal_temperature,
    is_agency_open_for_time,
)


YEAR = 2026


def main():
    random.seed(YEAR)

    start = datetime(YEAR, 1, 1, tzinfo=timezone.utc)
    end = datetime(YEAR + 1, 1, 1, tzinfo=timezone.utc)
    step = timedelta(hours=1)

    agencies = {
        agency.id: agency
        for agency in Agency.objects.filter(id__in=AGENCIES.keys())
    }
    existing = set(
        SensorData.objects.filter(
            agency_id__in=AGENCIES.keys(),
            timestamp__gte=start,
            timestamp__lt=end,
        ).values_list("agency_id", "timestamp")
    )

    rows = []
    current = start

    while current < end:
        naive_current = current.replace(tzinfo=None)

        for agency_id, profile in AGENCIES.items():
            agency = agencies.get(agency_id)
            if agency is None or (agency_id, current) in existing:
                continue

            temperature = get_seasonal_temperature(naive_current, profile)
            clients_count = get_clients_for_time(naive_current, profile)
            ac_mode = calculate_ac_mode(
                temperature,
                clients_count,
                is_open=is_agency_open_for_time(naive_current),
            )
            energy_usage = calculate_energy_usage(
                temperature=temperature,
                clients_count=clients_count,
                ac_mode=ac_mode,
                load_factor=profile["load_factor"],
            )

            rows.append(
                SensorData(
                    agency=agency,
                    temperature=Decimal(str(temperature)),
                    clients_count=clients_count,
                    energy_usage=Decimal(str(energy_usage)),
                    ac_mode=ac_mode,
                    timestamp=current,
                )
            )

        current += step

    SensorData.objects.bulk_create(rows, batch_size=1000, ignore_conflicts=True)

    print(f"created={len(rows)}")
    print(f"total_{YEAR}={SensorData.objects.filter(timestamp__year=YEAR).count()}")


if __name__ == "__main__":
    main()
