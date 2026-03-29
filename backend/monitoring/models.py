from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


# -------------------------
# Region Model
# -------------------------
class Region(models.Model):
    name = models.CharField(max_length=120, unique=True)

    def __str__(self):
        return self.name


# -------------------------
# Agency Model
# -------------------------
class Agency(models.Model):
    name = models.CharField(max_length=120)
    region = models.ForeignKey(Region, on_delete=models.PROTECT, related_name="agencies")

    class Meta:
        unique_together = ("name", "region")

    def __str__(self):
        return f"{self.name} ({self.region.name})"


# -------------------------
# AC Mode Choices
# -------------------------
class ACMode(models.TextChoices):
    OFF = "OFF", "OFF"
    ECO = "ECO", "ECO"
    ON = "ON", "ON"


# -------------------------
# Sensor Data Model
# -------------------------
class SensorData(models.Model):
    agency = models.ForeignKey(Agency, on_delete=models.CASCADE, related_name="sensor_data")

    temperature = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("-30.0")),
            MaxValueValidator(Decimal("55.0")),
        ],
    )
    clients_count = models.PositiveIntegerField()
    energy_usage = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
    )

    ac_mode = models.CharField(max_length=3, choices=ACMode.choices)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["agency", "timestamp"],
                name="sensor_data_agency_timestamp_uniq",
            ),
        ]

    def __str__(self):
        return f"{self.agency.name} - {self.timestamp}"