from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from monitoring.models import ACMode, Agency, Region, SensorData

User = get_user_model()


class BaseAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass123")
        self.client.force_authenticate(user=self.user)
        self.region = Region.objects.create(name="Cap Bon")
        self.agency1 = Agency.objects.create(name="BH Bank Nabeul", region=self.region)
        self.agency2 = Agency.objects.create(name="BH Bank Mrezga", region=self.region)


class AuthenticationTests(APITestCase):
    def test_unauthenticated_request_returns_401(self):
        response = self.client.get("/api/regions/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_request_succeeds(self):
        user = User.objects.create_user(username="testuser", password="testpass123")
        self.client.force_authenticate(user=user)
        response = self.client.get("/api/regions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class RegionViewSetTests(BaseAPITestCase):
    def test_list_regions(self):
        Region.objects.create(name="Tunis")
        response = self.client.get("/api/regions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_create_region(self):
        data = {"name": "Sfax"}
        response = self.client.post("/api/regions/", data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Sfax")

    def test_retrieve_region(self):
        response = self.client.get(f"/api/regions/{self.region.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Cap Bon")

    def test_update_region(self):
        data = {"name": "Cap Bon Updated"}
        response = self.client.patch(f"/api/regions/{self.region.id}/", data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Cap Bon Updated")

    def test_delete_region(self):
        region = Region.objects.create(name="DeleteMe")
        response = self.client.delete(f"/api/regions/{region.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class AgencyViewSetTests(BaseAPITestCase):
    def test_list_agencies(self):
        response = self.client.get("/api/agencies/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_create_agency(self):
        data = {"name": "BH Bank Dar Chaaben", "region": self.region.id}
        response = self.client.post("/api/agencies/", data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_filter_agencies_by_region(self):
        region2 = Region.objects.create(name="Tunis")
        Agency.objects.create(name="BH Bank Tunis", region=region2)
        response = self.client.get("/api/agencies/", {"region": self.region.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        for agency in response.data:
            self.assertEqual(agency["region"], self.region.id)

    def test_ordering_by_name(self):
        response = self.client.get("/api/agencies/")
        names = [a["name"] for a in response.data]
        self.assertEqual(names, sorted(names))


class SensorDataViewSetTests(BaseAPITestCase):
    def test_list_sensor_data(self):
        SensorData.objects.create(
            agency=self.agency1,
            temperature="25.00",
            clients_count=5,
            energy_usage="1.000",
            ac_mode=ACMode.ON,
        )
        response = self.client.get("/api/sensor-data/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_create_sensor_data(self):
        from django.utils import timezone
        data = {
            "agency": self.agency1.id,
            "temperature": "25.50",
            "clients_count": 10,
            "energy_usage": "2.500",
            "ac_mode": "ON",
            "timestamp": timezone.now().isoformat(),
        }
        response = self.client.post("/api/sensor-data/", data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(response.data["temperature"]), Decimal("25.50"))

    def test_filter_by_agency(self):
        SensorData.objects.create(
            agency=self.agency1,
            temperature="25.00",
            clients_count=5,
            energy_usage="1.000",
            ac_mode=ACMode.ON,
        )
        SensorData.objects.create(
            agency=self.agency2,
            temperature="26.00",
            clients_count=6,
            energy_usage="1.500",
            ac_mode=ACMode.ECO,
        )
        response = self.client.get("/api/sensor-data/", {"agency": self.agency1.id})
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["agency"], self.agency1.id)

    def test_filter_by_ac_mode(self):
        SensorData.objects.create(
            agency=self.agency1,
            temperature="25.00",
            clients_count=5,
            energy_usage="1.000",
            ac_mode=ACMode.ON,
        )
        SensorData.objects.create(
            agency=self.agency1,
            temperature="22.00",
            clients_count=3,
            energy_usage="0.800",
            ac_mode=ACMode.OFF,
        )
        response = self.client.get("/api/sensor-data/", {"ac_mode": "ON"})
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["ac_mode"], "ON")


class DailyEnergyKpiTests(BaseAPITestCase):
    def test_empty_data(self):
        response = self.client.get("/api/kpis/energy/daily/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_daily_aggregation(self):
        from datetime import datetime
        today = timezone.now().date()
        SensorData.objects.create(
            agency=self.agency1,
            temperature="25.00",
            clients_count=5,
            energy_usage="1.000",
            ac_mode=ACMode.ON,
            timestamp=datetime(today.year, today.month, today.day, 10, 0),
        )
        SensorData.objects.create(
            agency=self.agency1,
            temperature="26.00",
            clients_count=6,
            energy_usage="2.000",
            ac_mode=ACMode.ON,
            timestamp=datetime(today.year, today.month, today.day, 14, 0),
        )
        response = self.client.get("/api/kpis/energy/daily/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(Decimal(response.data[0]["total_energy"]), Decimal("3.000"))


class MonthlyEnergyKpiTests(BaseAPITestCase):
    def test_monthly_aggregation(self):
        from datetime import datetime
        SensorData.objects.create(
            agency=self.agency1,
            temperature="20.00",
            clients_count=10,
            energy_usage="10.000",
            ac_mode=ACMode.ECO,
            timestamp=datetime(2025, 1, 10, 10, 0),
        )
        SensorData.objects.create(
            agency=self.agency1,
            temperature="22.00",
            clients_count=20,
            energy_usage="15.000",
            ac_mode=ACMode.ON,
            timestamp=datetime(2025, 1, 12, 12, 0),
        )

        response = self.client.get("/api/kpis/energy/monthly/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["month"], "2025-01")
        self.assertEqual(Decimal(str(response.data[0]["total_energy"])), Decimal("25.0"))
        self.assertEqual(response.data[0]["avg_temperature"], 21.0)
        self.assertEqual(response.data[0]["avg_clients"], 15.0)


class CompareAgenciesTests(BaseAPITestCase):
    def test_compare_valid_agencies(self):
        SensorData.objects.create(
            agency=self.agency1,
            temperature="30.00",
            clients_count=10,
            energy_usage="5.000",
            ac_mode=ACMode.ON,
        )
        SensorData.objects.create(
            agency=self.agency2,
            temperature="20.00",
            clients_count=5,
            energy_usage="2.000",
            ac_mode=ACMode.OFF,
        )
        response = self.client.get(
            "/api/kpis/energy/compare/",
            {"agency1": self.agency1.id, "agency2": self.agency2.id},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("agency_1", response.data)
        self.assertIn("agency_2", response.data)
        self.assertIn("chart_data", response.data)
        self.assertIn("insights", response.data)
        self.assertIn("region", response.data)
        self.assertEqual(response.data["agency_1"]["total_energy"], 5.0)
        self.assertEqual(response.data["agency_2"]["total_energy"], 2.0)

    def test_compare_different_regions(self):
        region2 = Region.objects.create(name="Tunis")
        agency3 = Agency.objects.create(name="BH Bank Tunis", region=region2)
        response = self.client.get(
            "/api/kpis/energy/compare/",
            {"agency1": self.agency1.id, "agency2": agency3.id},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_compare_missing_params(self):
        response = self.client.get("/api/kpis/energy/compare/", {"agency1": self.agency1.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_compare_nonexistent_agency(self):
        response = self.client.get(
            "/api/kpis/energy/compare/",
            {"agency1": 9999, "agency2": self.agency2.id},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_compare_no_sensor_data(self):
        response = self.client.get(
            "/api/kpis/energy/compare/",
            {"agency1": self.agency1.id, "agency2": self.agency2.id},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["agency_1"]["total_energy"], 0.0)
        self.assertEqual(response.data["agency_2"]["total_energy"], 0.0)


class ApiSubjectsTests(BaseAPITestCase):
    def test_subjects_list(self):
        response = self.client.get("/api/subjects/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("subjects", response.data)
        expected = [
            "subjects",
            "regions",
            "agencies",
            "sensor-data",
            "kpis/energy/daily",
            "kpis/energy/monthly",
            "kpis/energy/compare",
        ]
        self.assertEqual(response.data["subjects"], expected)
