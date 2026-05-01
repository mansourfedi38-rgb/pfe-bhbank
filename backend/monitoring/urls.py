from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegionViewSet, AgencyViewSet, SensorDataViewSet, daily_energy_kpi, monthly_energy_kpi, api_subjects, compare_agencies

router = DefaultRouter()
router.register('regions', RegionViewSet)
router.register('agencies', AgencyViewSet)
router.register('sensor-data', SensorDataViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('kpis/energy/daily/', daily_energy_kpi),
    path('kpis/energy/monthly/', monthly_energy_kpi),
    path('kpis/energy/compare/', compare_agencies),
    path('subjects/', api_subjects),
]
