from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models.deletion import ProtectedError
from django.test import TestCase

from monitoring.models import ACMode, Agency, Region, SensorData


class RegionModelTests(TestCase):
    def test_create_region(self):
        region = Region.objects.create(name="Tunis")
        self.assertEqual(region.name, "Tunis")

    def test_region_name_unique(self):
        Region.objects.create(name="Tunis")
        with self.assertRaises(IntegrityError):
            Region.objects.create(name="Tunis")

    def test_region_str(self):
        region = Region.objects.create(name="Sfax")
        self.assertEqual(str(region), "Sfax")


class AgencyModelTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(name="Cap Bon")

    def test_create_agency(self):
        agency = Agency.objects.create(name="BH Bank Nabeul", region=self.region)
        self.assertEqual(agency.name, "BH Bank Nabeul")
        self.assertEqual(agency.region, self.region)

    def test_agency_unique_together(self):
        Agency.objects.create(name="BH Bank Nabeul", region=self.region)
        with self.assertRaises(IntegrityError):
            Agency.objects.create(name="BH Bank Nabeul", region=self.region)

    def test_same_name_different_region(self):
        region2 = Region.objects.create(name="Tunis")
        Agency.objects.create(name="BH Bank Nabeul", region=self.region)
        agency2 = Agency.objects.create(name="BH Bank Nabeul", region=region2)
        self.assertEqual(Agency.objects.count(), 2)
        self.assertEqual(agency2.region, region2)

    def test_region_protect_delete(self):
        Agency.objects.create(name="BH Bank Nabeul", region=self.region)
        with self.assertRaises(ProtectedError):
            self.region.delete()

    def test_agency_str(self):
        agency = Agency.objects.create(name="BH Bank Nabeul", region=self.region)
        self.assertEqual(str(agency), "BH Bank Nabeul (Cap Bon)")


class SensorDataModelTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(name="Cap Bon")
        self.agency = Agency.objects.create(name="BH Bank Nabeul", region=self.region)

    def test_create_sensor_data(self):
        data = SensorData.objects.create(
            agency=self.agency,
            temperature="25.50",
            clients_count=10,
            energy_usage="2.500",
            ac_mode=ACMode.ON,
        )
        self.assertEqual(data.agency, self.agency)
        self.assertEqual(Decimal(data.temperature), Decimal("25.50"))
        self.assertEqual(data.clients_count, 10)
        self.assertEqual(Decimal(data.energy_usage), Decimal("2.500"))
        self.assertEqual(data.ac_mode, ACMode.ON)

    def test_temperature_min_validator(self):
        with self.assertRaises(ValidationError):
            data = SensorData(
                agency=self.agency,
                temperature="-31.00",
                clients_count=5,
                energy_usage="1.000",
                ac_mode=ACMode.OFF,
            )
            data.full_clean()

    def test_temperature_max_validator(self):
        with self.assertRaises(ValidationError):
            data = SensorData(
                agency=self.agency,
                temperature="56.00",
                clients_count=5,
                energy_usage="1.000",
                ac_mode=ACMode.OFF,
            )
            data.full_clean()

    def test_energy_min_validator(self):
        with self.assertRaises(ValidationError):
            data = SensorData(
                agency=self.agency,
                temperature="20.00",
                clients_count=5,
                energy_usage="-0.100",
                ac_mode=ACMode.OFF,
            )
            data.full_clean()

    def test_unique_agency_timestamp(self):
        from django.utils import timezone
        timestamp = timezone.now()
        SensorData.objects.create(
            agency=self.agency,
            temperature="25.00",
            clients_count=5,
            energy_usage="1.000",
            ac_mode=ACMode.ECO,
            timestamp=timestamp,
        )
        with self.assertRaises(IntegrityError):
            SensorData.objects.create(
                agency=self.agency,
                temperature="26.00",
                clients_count=6,
                energy_usage="1.500",
                ac_mode=ACMode.ON,
                timestamp=timestamp,
            )

    def test_ac_mode_choices(self):
        valid_modes = [ACMode.OFF, ACMode.ECO, ACMode.ON]
        for mode in valid_modes:
            with self.subTest(mode=mode):
                data = SensorData.objects.create(
                    agency=self.agency,
                    temperature="22.00",
                    clients_count=5,
                    energy_usage="1.000",
                    ac_mode=mode,
                )
                self.assertEqual(data.ac_mode, mode)

    def test_cascade_delete_agency(self):
        SensorData.objects.create(
            agency=self.agency,
            temperature="22.00",
            clients_count=5,
            energy_usage="1.000",
            ac_mode=ACMode.OFF,
        )
        self.assertEqual(SensorData.objects.count(), 1)
        self.agency.delete()
        self.assertEqual(SensorData.objects.count(), 0)

    def test_sensor_data_str(self):
        data = SensorData.objects.create(
            agency=self.agency,
            temperature="22.00",
            clients_count=5,
            energy_usage="1.000",
            ac_mode=ACMode.OFF,
        )
        self.assertIn("BH Bank Nabeul", str(data))
