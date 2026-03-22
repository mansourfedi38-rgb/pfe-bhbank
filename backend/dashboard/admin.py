from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Agency, Measurement

admin.site.register(Agency)
admin.site.register(Measurement)