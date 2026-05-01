from datetime import datetime

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from monitoring.models import ACMode, Agency, Region, SensorData

User = get_user_model()


class FullWorkflowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass123")
        self.client.force_authenticate(user=self.user)

    def test_complete_monitoring_workflow(self):
        # 1. Create a region
        region_response = self.client.post("/api/regions/", {"name": "Test Region"})
        self.assertEqual(region_response.status_code, status.HTTP_201_CREATED)
        region_id = region_response.data["id"]

        # 2. Create two agencies in that region
        agency1_response = self.client.post("/api/agencies/", {"name": "Agency One", "region": region_id})
        self.assertEqual(agency1_response.status_code, status.HTTP_201_CREATED)
        agency1_id = agency1_response.data["id"]

        agency2_response = self.client.post("/api/agencies/", {"name": "Agency Two", "region": region_id})
        self.assertEqual(agency2_response.status_code, status.HTTP_201_CREATED)
        agency2_id = agency2_response.data["id"]

        # 3. Post sensor data for both agencies
        sensor1 = self.client.post("/api/sensor-data/", {
            "agency": agency1_id,
            "temperature": "30.00",
            "clients_count": 20,
            "energy_usage": "3.000",
            "ac_mode": "ON",
            "timestamp": timezone.now().isoformat(),
        })
        self.assertEqual(sensor1.status_code, status.HTTP_201_CREATED)

        sensor2 = self.client.post("/api/sensor-data/", {
            "agency": agency2_id,
            "temperature": "22.00",
            "clients_count": 10,
            "energy_usage": "1.500",
            "ac_mode": "OFF",
            "timestamp": timezone.now().isoformat(),
        })
        self.assertEqual(sensor2.status_code, status.HTTP_201_CREATED)

        # 4. Verify sensor data list
        sensor_list = self.client.get("/api/sensor-data/")
        self.assertEqual(sensor_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(sensor_list.data), 2)

        # 5. Get daily energy KPI
        kpi_response = self.client.get("/api/kpis/energy/daily/")
        self.assertEqual(kpi_response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(kpi_response.data) > 0)

        # 6. Compare agencies
        compare_response = self.client.get(
            "/api/kpis/energy/compare/",
            {"agency1": agency1_id, "agency2": agency2_id},
        )
        self.assertEqual(compare_response.status_code, status.HTTP_200_OK)
        self.assertEqual(compare_response.data["agency_1"]["total_energy"], 3.0)
        self.assertEqual(compare_response.data["agency_2"]["total_energy"], 1.5)
        self.assertTrue(len(compare_response.data["insights"]) > 0)

        # 7. Verify API subjects compatibility
        subjects_response = self.client.get("/api/subjects/")
        self.assertEqual(subjects_response.status_code, status.HTTP_200_OK)
        self.assertIn("regions", subjects_response.data["subjects"])
        self.assertIn("agencies", subjects_response.data["subjects"])
        self.assertIn("sensor-data", subjects_response.data["subjects"])

        # 8. Delete sensor data
        sensor_id = sensor1.data["id"]
        delete_response = self.client.delete(f"/api/sensor-data/{sensor_id}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(SensorData.objects.count(), 1)
