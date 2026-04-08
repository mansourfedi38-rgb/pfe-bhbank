from rest_framework.viewsets import ModelViewSet
from rest_framework.filters import OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum
from django.db.models.functions import TruncDate
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import SensorData

from .models import Region, Agency, SensorData
from .serializers import RegionSerializer, AgencySerializer, SensorDataSerializer


class RegionViewSet(ModelViewSet):
    queryset = Region.objects.all()
    serializer_class = RegionSerializer


class AgencyViewSet(ModelViewSet):
    queryset = Agency.objects.all()
    serializer_class = AgencySerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['region']
    ordering_fields = ['name']
    ordering = ['name']


class SensorDataViewSet(ModelViewSet):
    queryset = SensorData.objects.all()
    serializer_class = SensorDataSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['agency', 'ac_mode']
    ordering_fields = ['timestamp', 'energy_usage', 'temperature', 'clients_count']
    ordering = ['-timestamp']


@api_view(['GET'])
def api_subjects(request):
    subjects = [
        'subjects',
        'regions',
        'agencies',
        'sensor-data',
        'kpis/energy/daily',
    ]
    return Response({'subjects': subjects})


@api_view(['GET'])
def daily_energy_kpi(request):
    data = (
        SensorData.objects
        .annotate(date=TruncDate('timestamp'))
        .values('agency', 'date')
        .annotate(total_energy=Sum('energy_usage'))
        .order_by('agency', 'date')
    )

    return Response(data)