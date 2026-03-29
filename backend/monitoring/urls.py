from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import RegionViewSet, AgencyViewSet, SensorDataViewSet, daily_energy_kpi

router = DefaultRouter()
router.register(r"regions", RegionViewSet)
router.register(r"agencies", AgencyViewSet)
router.register(r"sensor-data", SensorDataViewSet)

urlpatterns = [
    path('kpis/energy/daily/', daily_energy_kpi),
]

urlpatterns += router.urls