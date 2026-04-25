from rest_framework.viewsets import ModelViewSet
from rest_framework.filters import OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Avg, Count, Q
from django.db.models.functions import TruncDate
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from decimal import Decimal

from .models import Region, Agency, SensorData, ACMode
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
        'kpis/energy/compare',
    ]
    return Response({'subjects': subjects})


@api_view(['GET'])
def daily_energy_kpi(request):
    data = (
        SensorData.objects
        .annotate(date=TruncDate('timestamp'))
        .values('agency', 'agency__name', 'date')
        .annotate(total_energy=Sum('energy_usage'))
        .order_by('agency', 'date')
    )

    result = [
        {
            'agency': row['agency'],
            'agency_name': row['agency__name'],
            'date': row['date'],
            'total_energy': row['total_energy'],
        }
        for row in data
    ]

    return Response(result)


@api_view(['GET'])
def compare_agencies(request):
    """
    Compare two agencies from the same region.
    Query parameters: agency1=<id>&agency2=<id>
    """
    agency1_id = request.query_params.get('agency1')
    agency2_id = request.query_params.get('agency2')

    # Validate parameters
    if not agency1_id or not agency2_id:
        return Response(
            {'error': 'Missing agency1 or agency2 query parameters'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        agency1 = Agency.objects.select_related('region').get(id=agency1_id)
        agency2 = Agency.objects.select_related('region').get(id=agency2_id)
    except Agency.DoesNotExist:
        return Response(
            {'error': 'One or both agencies not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Validate both agencies belong to the same region
    if agency1.region_id != agency2.region_id:
        return Response(
            {'error': 'Agencies must belong to the same region'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Calculate metrics for both agencies
    agency1_metrics = _calculate_agency_metrics(agency1)
    agency2_metrics = _calculate_agency_metrics(agency2)

    # Build daily chart data
    chart_data = _build_comparison_chart_data(agency1, agency2)

    # Generate insights
    insights = _generate_insights(agency1_metrics, agency2_metrics)

    return Response({
        'agency_1': agency1_metrics,
        'agency_2': agency2_metrics,
        'chart_data': chart_data,
        'insights': insights,
        'region': {
            'id': agency1.region.id,
            'name': agency1.region.name
        }
    })


def _calculate_agency_metrics(agency: Agency) -> dict:
    """Calculate metrics for a single agency"""
    sensor_data = SensorData.objects.filter(agency=agency)

    # Basic aggregations
    total_energy = sensor_data.aggregate(Sum('energy_usage'))['energy_usage__sum'] or Decimal('0')
    avg_temperature = sensor_data.aggregate(Avg('temperature'))['temperature__avg'] or 0
    total_clients = sensor_data.aggregate(Sum('clients_count'))['clients_count__sum'] or 0
    count_records = sensor_data.count()
    avg_clients = Decimal(total_clients) / count_records if count_records > 0 else Decimal('0')
    energy_per_client = total_energy / Decimal(total_clients) if total_clients > 0 else Decimal('0')

    # AC mode counts
    ac_counts = sensor_data.values('ac_mode').annotate(count=Count('id'))
    ac_mode_counts = {ACMode.OFF: 0, ACMode.ECO: 0, ACMode.ON: 0}
    for item in ac_counts:
        ac_mode_counts[item['ac_mode']] = item['count']

    return {
        'id': agency.id,
        'name': agency.name,
        'region_name': agency.region.name,
        'total_energy': float(total_energy),
        'average_temperature': float(avg_temperature) if avg_temperature else 0,
        'total_clients': int(total_clients),
        'average_clients': float(avg_clients),
        'energy_per_client': float(energy_per_client),
        'ac_mode_counts': {
            'OFF': ac_mode_counts.get(ACMode.OFF, 0),
            'ECO': ac_mode_counts.get(ACMode.ECO, 0),
            'ON': ac_mode_counts.get(ACMode.ON, 0),
        }
    }


def _build_comparison_chart_data(agency1: Agency, agency2: Agency) -> list:
    """Build daily chart data for both agencies"""
    data = (
        SensorData.objects
        .filter(Q(agency=agency1) | Q(agency=agency2))
        .annotate(date=TruncDate('timestamp'))
        .values('agency', 'agency__name', 'date')
        .annotate(total_energy=Sum('energy_usage'))
        .order_by('date', 'agency')
    )

    # Organize data by date
    chart_by_date = {}
    for row in data:
        date = str(row['date'])
        if date not in chart_by_date:
            chart_by_date[date] = {
                'date': date,
                'agency1': {'name': agency1.name, 'energy': None},
                'agency2': {'name': agency2.name, 'energy': None},
            }
        
        if row['agency'] == agency1.id:
            chart_by_date[date]['agency1']['energy'] = float(row['total_energy'])
        else:
            chart_by_date[date]['agency2']['energy'] = float(row['total_energy'])

    return list(chart_by_date.values())


def _generate_insights(agency1_metrics: dict, agency2_metrics: dict) -> list:
    """Generate rule-based insights comparing two agencies"""
    insights = []
    
    agency1_name = agency1_metrics['name']
    agency2_name = agency2_metrics['name']
    
    # Determine which agency consumes more energy
    if agency1_metrics['total_energy'] > agency2_metrics['total_energy']:
        higher_energy = agency1_name
        lower_energy = agency2_name
        higher_metrics = agency1_metrics
        lower_metrics = agency2_metrics
    else:
        higher_energy = agency2_name
        lower_energy = agency1_name
        higher_metrics = agency2_metrics
        lower_metrics = agency1_metrics
    
    # Temperature insight
    temp_diff = higher_metrics['average_temperature'] - lower_metrics['average_temperature']
    if abs(temp_diff) >= 2:
        insights.append({
            'type': 'temperature',
            'text': f'{higher_energy} has a higher average temperature ({higher_metrics["average_temperature"]:.1f}°C vs {lower_metrics["average_temperature"]:.1f}°C), which may require more energy for cooling.',
            'factor': f'{temp_diff:.1f}°C difference'
        })
    
    # Clients insight
    clients_diff = higher_metrics['total_clients'] - lower_metrics['total_clients']
    if clients_diff > 0:
        pct = (clients_diff / lower_metrics['total_clients'] * 100) if lower_metrics['total_clients'] > 0 else 0
        insights.append({
            'type': 'clients',
            'text': f'{higher_energy} serves {clients_diff} more clients ({pct:.0f}% more), which typically increases energy consumption.',
            'factor': f'{clients_diff} more clients'
        })
    
    # AC mode usage insight
    higher_on_percent = (higher_metrics['ac_mode_counts']['ON'] / sum(higher_metrics['ac_mode_counts'].values()) * 100) if sum(higher_metrics['ac_mode_counts'].values()) > 0 else 0
    lower_on_percent = (lower_metrics['ac_mode_counts']['ON'] / sum(lower_metrics['ac_mode_counts'].values()) * 100) if sum(lower_metrics['ac_mode_counts'].values()) > 0 else 0
    
    if higher_on_percent > lower_on_percent + 5:
        insights.append({
            'type': 'ac_mode',
            'text': f'{higher_energy} runs AC in ON mode more frequently ({higher_on_percent:.0f}% vs {lower_on_percent:.0f}%), consuming significantly more energy.',
            'factor': f'{higher_on_percent - lower_on_percent:.0f}% more ON mode usage'
        })
    
    # Efficiency insight
    energy_per_client_diff = higher_metrics['energy_per_client'] - lower_metrics['energy_per_client']
    if energy_per_client_diff > 0:
        pct = (energy_per_client_diff / lower_metrics['energy_per_client'] * 100) if lower_metrics['energy_per_client'] > 0 else 0
        insights.append({
            'type': 'efficiency',
            'text': f'{higher_energy} consumes {pct:.0f}% more energy per client ({higher_metrics["energy_per_client"]:.2f} vs {lower_metrics["energy_per_client"]:.2f}), suggesting lower efficiency.',
            'factor': f'{pct:.0f}% lower efficiency'
        })
    
    return insights if insights else [
        {
            'type': 'general',
            'text': f'Both agencies have similar energy profiles.',
            'factor': 'No significant differences detected'
        }
    ]