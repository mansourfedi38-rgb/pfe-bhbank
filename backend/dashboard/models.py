from django.db import models

# Create your models here.
from django.db import models

class Agency(models.Model):
    name = models.CharField(max_length=100)
    city = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Measurement(models.Model):
    agency = models.ForeignKey(Agency, on_delete=models.CASCADE)
    temperature = models.FloatField()
    humidity = models.FloatField()
    number_of_clients = models.IntegerField()
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.agency.name} - {self.recorded_at}"