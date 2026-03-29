from rest_framework.routers import DefaultRouter
from .views import RegionViewSet, AgencyViewSet, SensorDataViewSet

router = DefaultRouter()
router.register(r"regions", RegionViewSet)
router.register(r"agencies", AgencyViewSet)
router.register(r"sensor-data", SensorDataViewSet)

urlpatterns = router.urls