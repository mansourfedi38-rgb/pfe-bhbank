from django.contrib import admin
from .models import Region, Agency, SensorData


admin.site.register(Region)
admin.site.register(Agency)
admin.site.register(SensorData)