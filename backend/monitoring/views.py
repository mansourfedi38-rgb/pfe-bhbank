from rest_framework.viewsets import ModelViewSet
from rest_framework.filters import OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Avg, Count, Q, Max
from django.db.models.functions import TruncDate, TruncMonth
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from decimal import Decimal

from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Region, Agency, SensorData, ACMode
from .serializers import RegionSerializer, AgencySerializer, SensorDataSerializer, EmailTokenObtainPairSerializer


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

    def get_queryset(self):
        queryset = super().get_queryset()
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if date_from:
            queryset = queryset.filter(timestamp__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(timestamp__date__lte=date_to)

        return queryset


@api_view(['GET'])
def api_subjects(request):
    subjects = [
        'subjects',
        'regions',
        'agencies',
        'sensor-data',
        'kpis/energy/daily',
        'kpis/energy/monthly',
        'kpis/energy/compare',
    ]
    return Response({'subjects': subjects})


@api_view(['GET'])
def daily_energy_kpi(request):
    queryset = _filter_sensor_data_by_period(SensorData.objects.all(), request)
    data = (
        queryset
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
def monthly_energy_kpi(request):
    queryset = _filter_sensor_data_by_period(SensorData.objects.all(), request)
    data = (
        queryset
        .annotate(month=TruncMonth('timestamp'))
        .values('agency', 'agency__name', 'month')
        .annotate(
            total_energy=Sum('energy_usage'),
            avg_temperature=Avg('temperature'),
            avg_clients=Avg('clients_count'),
            readings_count=Count('id'),
        )
        .order_by('month', 'agency')
    )

    result = [
        {
            'agency': row['agency'],
            'agency_name': row['agency__name'],
            'month': row['month'].strftime('%Y-%m'),
            'total_energy': round(float(row['total_energy'] or 0), 2),
            'avg_temperature': round(float(row['avg_temperature'] or 0), 1),
            'avg_clients': round(float(row['avg_clients'] or 0), 1),
            'readings_count': row['readings_count'],
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
    base_queryset = _filter_sensor_data_by_period(SensorData.objects.all(), request)
    agency1_metrics = _calculate_agency_metrics(agency1, base_queryset)
    agency2_metrics = _calculate_agency_metrics(agency2, base_queryset)

    # Build daily chart data
    chart_data = _build_comparison_chart_data(agency1, agency2, base_queryset)

    analysis = _generate_cause_analysis(agency1_metrics, agency2_metrics)
    insights = _generate_insights(agency1_metrics, agency2_metrics)

    return Response({
        'agency_1': agency1_metrics,
        'agency_2': agency2_metrics,
        'chart_data': chart_data,
        'insights': insights,
        'main_reason': analysis['main_reason'],
        'causes': analysis['causes'],
        'recommendations': analysis['recommendations'],
        'higher_energy_agency': analysis['higher_energy_agency'],
        'region': {
            'id': agency1.region.id,
            'name': agency1.region.name
        }
    })


def _filter_sensor_data_by_period(queryset, request):
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')
    month = request.query_params.get('month')

    if month:
        year, month_number = month.split('-')
        queryset = queryset.filter(
            timestamp__year=int(year),
            timestamp__month=int(month_number),
        )
    if date_from:
        queryset = queryset.filter(timestamp__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(timestamp__date__lte=date_to)

    return queryset


def _calculate_agency_metrics(agency: Agency, base_queryset=None) -> dict:
    """Calculate metrics for a single agency"""
    sensor_data = (base_queryset or SensorData.objects.all()).filter(agency=agency)

    # Basic aggregations
    aggregates = sensor_data.aggregate(
        total_energy=Sum('energy_usage'),
        avg_temperature=Avg('temperature'),
        total_clients=Sum('clients_count'),
        peak_energy_reading=Max('energy_usage'),
        highest_temperature_reading=Max('temperature'),
    )
    total_energy = aggregates['total_energy'] or Decimal('0')
    avg_temperature = aggregates['avg_temperature'] or 0
    total_clients = aggregates['total_clients'] or 0
    count_records = sensor_data.count()
    avg_clients = Decimal(total_clients) / count_records if count_records > 0 else Decimal('0')
    energy_per_client = total_energy / Decimal(total_clients) if total_clients > 0 else Decimal('0')
    avg_energy_per_reading = total_energy / Decimal(count_records) if count_records > 0 else Decimal('0')

    business_hours_filter = Q(
        timestamp__week_day__in=[2, 3, 4, 5, 6],
        timestamp__hour__gte=8,
        timestamp__hour__lt=17,
    )
    business_hours_energy = (
        sensor_data
        .filter(business_hours_filter)
        .aggregate(total=Sum('energy_usage'))['total']
        or Decimal('0')
    )
    non_business_hours_energy = total_energy - business_hours_energy

    # AC mode counts
    ac_counts = sensor_data.values('ac_mode').annotate(count=Count('id'))
    ac_mode_counts = {ACMode.OFF: 0, ACMode.ECO: 0, ACMode.ON: 0}
    for item in ac_counts:
        ac_mode_counts[item['ac_mode']] = item['count']
    on_percentage = _safe_percentage(ac_mode_counts.get(ACMode.ON, 0), count_records)
    eco_percentage = _safe_percentage(ac_mode_counts.get(ACMode.ECO, 0), count_records)

    return {
        'id': agency.id,
        'name': agency.name,
        'region_name': agency.region.name,
        'total_energy': round(float(total_energy), 3),
        'average_temperature': round(float(avg_temperature), 2) if avg_temperature else 0,
        'total_clients': int(total_clients),
        'number_of_readings': count_records,
        'average_clients': round(float(avg_clients), 2),
        'average_energy_per_reading': round(float(avg_energy_per_reading), 3),
        'energy_per_client': round(float(energy_per_client), 4),
        'most_used_ac_mode': max(ac_mode_counts, key=ac_mode_counts.get),
        'business_hours_energy': round(float(business_hours_energy), 3),
        'non_business_hours_energy': round(float(non_business_hours_energy), 3),
        'peak_energy_reading': round(float(aggregates['peak_energy_reading'] or 0), 3),
        'highest_temperature_reading': round(float(aggregates['highest_temperature_reading'] or 0), 2),
        'ac_mode_counts': {
            'OFF': ac_mode_counts.get(ACMode.OFF, 0),
            'ECO': ac_mode_counts.get(ACMode.ECO, 0),
            'ON': ac_mode_counts.get(ACMode.ON, 0),
        },
        'ac_mode_distribution': {
            'OFF': ac_mode_counts.get(ACMode.OFF, 0),
            'ECO': ac_mode_counts.get(ACMode.ECO, 0),
            'ON': ac_mode_counts.get(ACMode.ON, 0),
            'ON_percentage': round(on_percentage, 1),
            'ECO_percentage': round(eco_percentage, 1),
        },
        'on_percentage': round(on_percentage, 1),
        'eco_percentage': round(eco_percentage, 1),
    }


def _safe_percentage(value, total):
    return (value / total * 100) if total else 0


def _build_comparison_chart_data(agency1: Agency, agency2: Agency, base_queryset=None) -> list:
    """Build daily chart data for both agencies"""
    data = (
        (base_queryset or SensorData.objects.all())
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


def _generate_cause_analysis(agency1_metrics: dict, agency2_metrics: dict) -> dict:
    """Rank realistic causes explaining why one agency consumed more energy."""
    if agency1_metrics['number_of_readings'] == 0 and agency2_metrics['number_of_readings'] == 0:
        return {
            'higher_energy_agency': None,
            'main_reason': 'No sensor readings are available for the selected period.',
            'causes': [],
            'recommendations': ['Generate or select a period with sensor readings before comparing agencies.'],
        }

    if agency1_metrics['total_energy'] == agency2_metrics['total_energy']:
        return {
            'higher_energy_agency': None,
            'main_reason': 'Both agencies consumed the same amount of energy for the selected period.',
            'causes': [
                {
                    'factor': 'Energy balance',
                    'severity': 'low',
                    'impact': '0%',
                    'message': 'Both agencies have equal total consumption, so there is no dominant consumption driver.'
                }
            ],
            'recommendations': ['Continue monitoring energy per client and AC usage to detect future deviations.'],
        }

    if agency1_metrics['total_energy'] > agency2_metrics['total_energy']:
        higher = agency1_metrics
        lower = agency2_metrics
    else:
        higher = agency2_metrics
        lower = agency1_metrics

    causes = []
    _add_ac_usage_cause(causes, higher, lower)
    _add_client_traffic_cause(causes, higher, lower)
    _add_temperature_cause(causes, higher, lower)
    _add_efficiency_cause(causes, higher, lower)
    _add_after_hours_cause(causes, higher, lower)
    _add_peak_load_cause(causes, higher, lower)

    severity_rank = {'high': 3, 'medium': 2, 'low': 1}
    causes.sort(key=lambda cause: severity_rank.get(cause['severity'], 0), reverse=True)

    if not causes:
        energy_gap = _percent_difference(higher['total_energy'], lower['total_energy'])
        causes.append({
            'factor': 'Overall load',
            'severity': 'low',
            'impact': f'+{energy_gap:.0f}%',
            'message': (
                f'{higher["name"]} consumed more energy, but the available indicators are close. '
                'The difference may come from small combined effects across occupancy, AC usage, and equipment load.'
            )
        })

    main_reason = causes[0]['message']
    return {
        'higher_energy_agency': {
            'id': higher['id'],
            'name': higher['name'],
        },
        'main_reason': main_reason,
        'causes': causes,
        'recommendations': _generate_recommendations(higher, lower, causes),
    }


def _add_ac_usage_cause(causes, higher, lower):
    on_gap = higher['on_percentage'] - lower['on_percentage']
    if on_gap >= 20:
        severity = 'high'
    elif on_gap >= 8:
        severity = 'medium'
    elif on_gap >= 3:
        severity = 'low'
    else:
        return

    causes.append({
        'factor': 'AC usage',
        'severity': severity,
        'impact': f'+{on_gap:.0f}%',
        'message': (
            f'{higher["name"]} consumed more energy mainly because AC was in ON mode '
            f'{higher["on_percentage"]:.0f}% of the time compared to {lower["on_percentage"]:.0f}% for {lower["name"]}.'
        )
    })


def _add_client_traffic_cause(causes, higher, lower):
    if lower['total_clients'] == 0:
        traffic_gap = 100 if higher['total_clients'] > 0 else 0
    else:
        traffic_gap = _percent_difference(higher['total_clients'], lower['total_clients'])

    if traffic_gap >= 30:
        severity = 'high'
    elif traffic_gap >= 12:
        severity = 'medium'
    elif traffic_gap >= 5:
        severity = 'low'
    else:
        return

    causes.append({
        'factor': 'Client traffic',
        'severity': severity,
        'impact': f'+{traffic_gap:.0f}%',
        'message': (
            f'{higher["name"]} had {traffic_gap:.0f}% more client traffic, increasing cooling demand, '
            'lighting, and equipment usage during business hours.'
        )
    })


def _add_temperature_cause(causes, higher, lower):
    temp_gap = higher['average_temperature'] - lower['average_temperature']
    if temp_gap >= 3:
        severity = 'high'
    elif temp_gap >= 1.5:
        severity = 'medium'
    elif temp_gap >= 0.7:
        severity = 'low'
    else:
        return

    causes.append({
        'factor': 'Temperature',
        'severity': severity,
        'impact': f'+{temp_gap:.1f}C',
        'message': (
            f'{higher["name"]} recorded an average temperature {temp_gap:.1f}C higher, '
            'which likely caused more frequent or stronger AC operation.'
        )
    })


def _add_efficiency_cause(causes, higher, lower):
    if higher['energy_per_client'] <= 0 or lower['energy_per_client'] <= 0:
        return

    efficiency_gap = _percent_difference(higher['energy_per_client'], lower['energy_per_client'])
    traffic_gap = abs(_percent_difference(higher['total_clients'], lower['total_clients'])) if lower['total_clients'] else 0
    if efficiency_gap >= 25:
        severity = 'high'
    elif efficiency_gap >= 10:
        severity = 'medium'
    elif efficiency_gap >= 5:
        severity = 'low'
    else:
        return

    qualifier = 'Although client traffic is relatively close, ' if traffic_gap < 15 else ''
    causes.append({
        'factor': 'Energy efficiency',
        'severity': severity,
        'impact': f'+{efficiency_gap:.0f}%',
        'message': (
            f'{qualifier}{higher["name"]} consumed {efficiency_gap:.0f}% more energy per client, '
            'suggesting lower operational efficiency or less efficient cooling/equipment usage.'
        )
    })


def _add_after_hours_cause(causes, higher, lower):
    higher_after_pct = _safe_percentage(higher['non_business_hours_energy'], higher['total_energy'])
    lower_after_pct = _safe_percentage(lower['non_business_hours_energy'], lower['total_energy'])
    after_gap = higher_after_pct - lower_after_pct

    if after_gap >= 15:
        severity = 'high'
    elif after_gap >= 7:
        severity = 'medium'
    elif after_gap >= 3:
        severity = 'low'
    else:
        return

    causes.append({
        'factor': 'After-hours usage',
        'severity': severity,
        'impact': f'+{after_gap:.0f}%',
        'message': (
            f'{higher["name"]} used a larger share of energy outside business hours '
            f'({higher_after_pct:.0f}% vs {lower_after_pct:.0f}%), which may indicate unnecessary AC or equipment operation after closing.'
        )
    })


def _add_peak_load_cause(causes, higher, lower):
    peak_gap = _percent_difference(higher['peak_energy_reading'], lower['peak_energy_reading']) if lower['peak_energy_reading'] else 0
    if peak_gap < 20:
        return

    causes.append({
        'factor': 'Peak load',
        'severity': 'medium' if peak_gap < 40 else 'high',
        'impact': f'+{peak_gap:.0f}%',
        'message': (
            f'{higher["name"]} had a higher peak energy reading '
            f'({higher["peak_energy_reading"]:.2f} kWh vs {lower["peak_energy_reading"]:.2f} kWh), '
            'indicating stronger short-term load peaks.'
        )
    })


def _generate_recommendations(higher, lower, causes):
    recommendations = []
    factors = {cause['factor'] for cause in causes}

    if 'AC usage' in factors:
        recommendations.append('Review AC scheduling during business hours and avoid unnecessary ON mode usage.')
    if 'After-hours usage' in factors:
        recommendations.append('Check whether AC, lighting, or office equipment remains ON after closing.')
    if 'Temperature' in factors:
        recommendations.append('Inspect insulation, sun exposure, and cooling efficiency for the higher-consuming agency.')
    if 'Energy efficiency' in factors:
        recommendations.append('Monitor energy per client ratio over the next month and compare operating procedures.')
    if 'Client traffic' in factors:
        recommendations.append('Adjust cooling schedules to match peak client traffic periods instead of running at full load all day.')
    if 'Peak load' in factors:
        recommendations.append('Investigate peak-load hours and stagger high-consumption equipment when possible.')

    recommendations.append('Compare equipment usage policies between agencies and document operational differences.')
    return recommendations[:5]


def _percent_difference(value, baseline):
    if not baseline:
        return 0
    return ((value - baseline) / baseline) * 100


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


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
