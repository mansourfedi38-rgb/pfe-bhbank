from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from monitoring.models import ACMode, Agency, Region, SensorData
from monitoring.serializers import AgencySerializer, RegionSerializer, SensorDataSerializer


class RegionSerializerTests(TestCase):
    def test_valid_region(self):
        data = {"name": "Tunis"}
        serializer = RegionSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        region = serializer.save()
        self.assertEqual(region.name, "Tunis")

    def test_empty_name_invalid(self):
        data = {"name": ""}
        serializer = RegionSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)


class AgencySerializerTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(name="Cap Bon")

    def test_valid_agency(self):
        data = {"name": "BH Bank Nabeul", "region": self.region.id}
        serializer = AgencySerializer(data=data)
        self.assertTrue(serializer.is_valid())
        agency = serializer.save()
        self.assertEqual(agency.name, "BH Bank Nabeul")

    def test_missing_region_invalid(self):
        data = {"name": "BH Bank Nabeul"}
        serializer = AgencySerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("region", serializer.errors)


class SensorDataSerializerTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(name="Cap Bon")
        self.agency = Agency.objects.create(name="BH Bank Nabeul", region=self.region)

    def test_valid_sensor_data(self):
        from django.utils import timezone
        data = {
            "agency": self.agency.id,
            "temperature": "25.50",
            "clients_count": 10,
            "energy_usage": "2.500",
            "ac_mode": "ON",
            "timestamp": timezone.now().isoformat(),
        }
        serializer = SensorDataSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        obj = serializer.save()
        self.assertEqual(obj.temperature, Decimal("25.50"))

    def test_duplicate_agency_timestamp_raises_validation_error(self):
        timestamp = timezone.now()
        SensorData.objects.create(
            agency=self.agency,
            temperature="25.00",
            clients_count=5,
            energy_usage="1.000",
            ac_mode=ACMode.ON,
            timestamp=timestamp,
        )
        data = {
            "agency": self.agency.id,
            "temperature": "26.00",
            "clients_count": 6,
            "energy_usage": "1.500",
            "ac_mode": ACMode.ECO,
            "timestamp": timestamp,
        }
        serializer = SensorDataSerializer(data=data)
        with self.assertRaises(Exception):
            serializer.is_valid(raise_exception=True)

    def test_invalid_ac_mode(self):
        data = {
            "agency": self.agency.id,
            "temperature": "25.00",
            "clients_count": 5,
            "energy_usage": "1.000",
            "ac_mode": "INVALID",
        }
        serializer = SensorDataSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("ac_mode", serializer.errors)
