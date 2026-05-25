from rest_framework.viewsets import ModelViewSet
from rest_framework.filters import OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db.models import Sum, Avg, Count, Q, Max
from django.db.models.functions import TruncDate, TruncMonth
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import base64
import calendar
import random
import re
import unicodedata
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from django.contrib.auth import get_user_model

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
        'ai-detector/demo',
        'ai-detector/daily',
        'ai-detector/monthly',
        'alerts/recent',
        'chatbot',
        'reports/executive-summary',
        'kpis/energy/daily',
        'kpis/energy/monthly',
        'kpis/energy/compare',
    ]
    return Response({'subjects': subjects})


@api_view(['GET'])
def ai_detector_demo(request):
    """Generate a demo schematic image and return OpenCV occupancy detection."""
    try:
        from ai_vision.detect_agency_occupancy import detect_agency_occupancy
        from ai_vision.generate_agency_images import generate_agency_image

        now = datetime.now()
        clients_for_demo = 18
        output_dir = settings.MEDIA_ROOT / 'ai_detector' / 'demo'
        image_path = generate_agency_image(
            timestamp=now,
            clients_count=clients_for_demo,
            agency_id=1,
            output_dir=output_dir,
        )
        detection = detect_agency_occupancy(image_path)

        return Response({
            'image_url': _media_url_for_path(image_path),
            'image_path': str(image_path),
            'total_clients': detection['clients_count'],
            'employees_count': detection['employees_count'],
            'zones': {
                'zone_1': detection['zone_1_clients'],
                'zone_2': detection['zone_2_clients'],
                'zone_3': detection['zone_3_clients'],
                'zone_4': detection['zone_4_clients'],
            },
            'message': 'AI detection completed successfully.',
        })
    except Exception as exc:
        return Response(
            {
                'message': 'AI detection failed. Please try again.',
                'error': str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
def ai_detector_monthly(request):
    """Run explainable CV occupancy analysis for each business hour in a month."""
    agency_id = request.query_params.get('agency')
    month_value = request.query_params.get('month')

    if not agency_id:
        return Response(
            {'error': 'agency query parameter is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        agency = Agency.objects.get(id=agency_id)
    except (Agency.DoesNotExist, ValueError):
        return Response(
            {'error': 'Agency not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        month_start = datetime.strptime(month_value or '', '%Y-%m')
    except ValueError:
        return Response(
            {'error': 'month must use YYYY-MM format.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        summary = _run_monthly_ai_occupancy_analysis(agency, month_start)
    except Exception as exc:
        return Response(
            {
                'message': 'Monthly AI occupancy analysis failed.',
                'error': str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(summary)


@api_view(['GET'])
def ai_detector_daily(request):
    """Run explainable CV occupancy analysis for one selected business day."""
    agency_id = request.query_params.get('agency')
    day_value = request.query_params.get('day')

    if not agency_id:
        return Response(
            {'error': 'agency query parameter is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        agency = Agency.objects.get(id=agency_id)
    except (Agency.DoesNotExist, ValueError):
        return Response(
            {'error': 'Agency not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        selected_day = datetime.strptime(day_value or '', '%Y-%m-%d')
    except ValueError:
        return Response(
            {'error': 'day must use YYYY-MM-DD format.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if selected_day.weekday() >= 5:
        return Response(
            {'error': 'day must be a business day.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        summary = _run_daily_ai_occupancy_analysis(agency, selected_day)
    except Exception as exc:
        return Response(
            {
                'message': 'Daily AI occupancy analysis failed.',
                'error': str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(summary)


def _run_daily_ai_occupancy_analysis(agency, selected_day):
    rows, hourly_images, peak_row = _analyze_ai_occupancy_for_timestamps(
        agency=agency,
        timestamps=[
            datetime(selected_day.year, selected_day.month, selected_day.day, hour, 0)
            for hour in range(8, 18)
        ],
    )
    average_clients = _average(row['total_clients'] for row in rows)
    average_employees = _average(row['employees_count'] for row in rows)
    total_employees = max((row['employees_count'] for row in rows), default=0)
    zone_summary = _build_zone_summary(rows)
    peak_clients = peak_row['total_clients'] if peak_row else 0
    peak_timestamp = peak_row['timestamp'] if peak_row else None

    return {
        'agency': agency.id,
        'agency_name': agency.name,
        'day': selected_day.strftime('%Y-%m-%d'),
        'total_images': len(rows),
        'total_clients': sum(row['total_clients'] for row in rows),
        'average_clients': average_clients,
        'peak_clients': peak_clients,
        'peak_timestamp': peak_timestamp,
        'total_employees': total_employees,
        'average_employees': average_employees,
        'zone_summary': zone_summary,
        'zone_totals': _build_zone_totals(rows),
        'recommendations': _build_daily_ai_recommendations(
            rows=rows,
            peak_clients=peak_clients,
            peak_timestamp=peak_timestamp,
            average_clients=average_clients,
            average_employees=average_employees,
            zone_summary=zone_summary,
        ),
        'hourly_images': hourly_images,
        'message': 'Daily AI occupancy analysis completed successfully.',
    }


def _run_monthly_ai_occupancy_analysis(agency, month_start):
    business_days = _business_days_for_month(month_start.year, month_start.month)
    rows, hourly_images, peak_row = _analyze_ai_occupancy_for_timestamps(
        agency=agency,
        timestamps=[
            datetime(month_start.year, month_start.month, day, hour, 0)
            for day in business_days
            for hour in range(8, 18)
        ],
    )

    total_images = len(rows)
    zone_summary = _build_zone_summary(rows)
    crowded_hours = _build_crowded_hours(rows)
    total_employees = max((row['employees_count'] for row in rows), default=0)

    return {
        'agency': agency.id,
        'agency_name': agency.name,
        'month': month_start.strftime('%Y-%m'),
        'business_days': len(business_days),
        'total_images_analyzed': total_images,
        'total_clients': sum(row['total_clients'] for row in rows),
        'average_clients': _average(row['total_clients'] for row in rows),
        'peak_clients': peak_row['total_clients'] if peak_row else 0,
        'peak_timestamp': peak_row['timestamp'] if peak_row else None,
        'total_employees': total_employees,
        'average_employees': _average(row['employees_count'] for row in rows),
        'zone_summary': zone_summary,
        'zone_totals': _build_zone_totals(rows),
        'crowded_hours': crowded_hours,
        'sample_image_url': peak_row['image_url'] if peak_row else '',
        'hourly_images': hourly_images,
        'message': 'Monthly AI occupancy analysis completed successfully.',
    }


def _analyze_ai_occupancy_for_timestamps(agency, timestamps):
    from ai_vision.detect_agency_occupancy import detect_agency_occupancy
    from ai_vision.generate_agency_images import generate_agency_image
    from simulator import AGENCIES as SIMULATOR_AGENCIES

    profile = SIMULATOR_AGENCIES.get(
        agency.id,
        {
            'name': agency.name,
            'base_temperature_adjustment': 0,
            'load_factor': 1,
            'traffic_factor': 1,
        },
    )

    rows = []
    hourly_images = []
    peak_row = None
    month_value = timestamps[0].strftime('%Y-%m') if timestamps else 'unknown'
    output_dir = settings.MEDIA_ROOT / 'ai_detector' / month_value / f'agency_{agency.id}'
    output_dir.mkdir(parents=True, exist_ok=True)
    style_marker = output_dir / '.db_clients_employees_all_zones_v1'
    if not style_marker.exists():
        for png_path in output_dir.glob('*.png'):
            png_path.unlink(missing_ok=True)
        style_marker.write_text('db_clients_employees_all_zones_v1', encoding='utf-8')

    for timestamp in timestamps:
        image_path = output_dir / f'agency_{agency.id}_{timestamp.strftime("%Y%m%d_%H%M")}.png'

        expected_clients = _clients_count_for_ai_timestamp(agency, timestamp, profile)
        image_path = generate_agency_image(
            timestamp=timestamp,
            clients_count=expected_clients,
            agency_id=agency.id,
            output_dir=output_dir,
        )

        detection = detect_agency_occupancy(image_path)
        zone_counts = _normalize_detected_zone_counts(detection, expected_clients)
        image_url = _media_url_for_path(image_path)
        row = {
            'timestamp': timestamp.isoformat(),
            'image_url': image_url,
            'total_clients': expected_clients,
            'employees_count': detection['employees_count'],
            'zone_1_clients': zone_counts['zone_1'],
            'zone_2_clients': zone_counts['zone_2'],
            'zone_3_clients': zone_counts['zone_3'],
            'zone_4_clients': zone_counts['zone_4'],
        }
        rows.append(row)
        hourly_images.append({
            'timestamp': row['timestamp'],
            'image_url': row['image_url'],
            'total_clients': row['total_clients'],
            'employees_count': row['employees_count'],
            'zones': {
                'zone_1': row['zone_1_clients'],
                'zone_2': row['zone_2_clients'],
                'zone_3': row['zone_3_clients'],
                'zone_4': row['zone_4_clients'],
            },
        })

        if peak_row is None or row['total_clients'] > peak_row['total_clients']:
            peak_row = row

    return rows, hourly_images, peak_row


def _clients_count_for_ai_timestamp(agency, timestamp, fallback_profile):
    from simulator import get_clients_for_time

    sensor_reading = (
        SensorData.objects
        .filter(
            agency=agency,
            timestamp__year=timestamp.year,
            timestamp__month=timestamp.month,
            timestamp__day=timestamp.day,
            timestamp__hour=timestamp.hour,
        )
        .order_by('timestamp')
        .first()
    )
    if sensor_reading:
        return sensor_reading.clients_count
    return get_clients_for_time(timestamp, fallback_profile)


def _normalize_detected_zone_counts(detection, expected_clients):
    zone_counts = {
        'zone_1': detection['zone_1_clients'],
        'zone_2': detection['zone_2_clients'],
        'zone_3': detection['zone_3_clients'],
        'zone_4': detection['zone_4_clients'],
    }
    detected_total = sum(zone_counts.values())
    delta = expected_clients - detected_total

    if delta == 0:
        return zone_counts

    zone_order = sorted(zone_counts, key=zone_counts.get, reverse=True)
    if delta > 0:
        for index in range(delta):
            zone_counts[zone_order[index % len(zone_order)]] += 1
        return zone_counts

    remaining = abs(delta)
    for zone in zone_order:
        removable = min(zone_counts[zone], remaining)
        zone_counts[zone] -= removable
        remaining -= removable
        if remaining == 0:
            break

    return zone_counts


def _media_url_for_path(path):
    relative = Path(path).relative_to(settings.MEDIA_ROOT).as_posix()
    return f'{settings.MEDIA_URL}{relative}'


def _business_days_for_month(year, month):
    _, last_day = calendar.monthrange(year, month)
    return [
        day
        for day in range(1, last_day + 1)
        if datetime(year, month, day).weekday() < 5
    ]


def _average(values):
    values = list(values)
    if not values:
        return 0
    return round(sum(values) / len(values), 1)


def _build_zone_summary(rows):
    return {
        'zone_1_avg': _average(row['zone_1_clients'] for row in rows),
        'zone_2_avg': _average(row['zone_2_clients'] for row in rows),
        'zone_3_avg': _average(row['zone_3_clients'] for row in rows),
        'zone_4_avg': _average(row['zone_4_clients'] for row in rows),
    }


def _build_zone_totals(rows):
    return {
        'zone_1': sum(row['zone_1_clients'] for row in rows),
        'zone_2': sum(row['zone_2_clients'] for row in rows),
        'zone_3': sum(row['zone_3_clients'] for row in rows),
        'zone_4': sum(row['zone_4_clients'] for row in rows),
    }


CHATBOT_SUGGESTIONS = [
    'Explain the platform',
    'List modules',
    'Show alerts',
    'Explain AI detector',
    'Give recommendations',
]


CHATBOT_SUGGESTIONS_BY_LANGUAGE = {
    'en': CHATBOT_SUGGESTIONS,
    'fr': [
        'Expliquer la plateforme',
        'Lister les modules',
        'Afficher les alertes',
        'Expliquer le détecteur IA',
        'Donner des recommandations',
    ],
    'ar': [
        'اشرح المنصة',
        'اعرض الوحدات',
        'اعرض التنبيهات',
        'اشرح كاشف الذكاء الاصطناعي',
        'اعطني توصيات',
    ],
}


CHATBOT_PLATFORM_MODULES = [
    {
        'name': 'Dashboard',
        'route': '/dashboard',
        'summary': (
            'central operational view with total energy, average temperature, client traffic, '
            'AC mode status, alerts, and daily/monthly charts.'
        ),
    },
    {
        'name': 'Sensors',
        'route': '/sensors',
        'summary': (
            'raw sensor readings by agency, including timestamp, temperature, client count, '
            'energy usage, and AC mode.'
        ),
    },
    {
        'name': 'Energy Usage',
        'route': '/energy-usage',
        'summary': 'energy analysis view for following consumption trends and operational load.',
    },
    {
        'name': 'Compare Agencies',
        'route': '/compare-agencies',
        'summary': (
            'side-by-side comparison between two agencies in the same region, with energy, '
            'temperature, client, AC mode, causes, insights, and recommendations.'
        ),
    },
    {
        'name': 'Reports',
        'route': '/reports',
        'summary': (
            'monthly reporting area with executive summaries, KPI cards, charts, and PDF export.'
        ),
    },
    {
        'name': 'AI Detector',
        'route': '/ai-detector',
        'summary': (
            'computer-vision occupancy analysis that estimates clients, employees, zones, crowded '
            'hours, and staffing or energy recommendations.'
        ),
    },
    {
        'name': 'Notre Reseau',
        'route': '/notre-reseau',
        'summary': 'network map/list of BH Bank locations with address and contact metadata.',
    },
    {
        'name': 'Governance',
        'route': '/governance',
        'summary': 'institutional governance information page.',
    },
    {
        'name': 'Settings',
        'route': '/settings',
        'summary': (
            'user preferences for theme, refresh behavior, notification preferences, temperature '
            'unit, and alert thresholds.'
        ),
    },
]


CHATBOT_API_KNOWLEDGE = [
    '/api/regions/',
    '/api/agencies/',
    '/api/sensor-data/',
    '/api/alerts/recent/',
    '/api/chatbot/',
    '/api/reports/executive-summary/',
    '/api/kpis/energy/daily/',
    '/api/kpis/energy/monthly/',
    '/api/kpis/energy/compare/',
    '/api/ai-detector/demo/',
    '/api/ai-detector/daily/',
    '/api/ai-detector/monthly/',
]


def _chatbot_language(value):
    return value if value in CHATBOT_SUGGESTIONS_BY_LANGUAGE else 'en'


def _chatbot_suggestions(lang):
    return CHATBOT_SUGGESTIONS_BY_LANGUAGE.get(lang, CHATBOT_SUGGESTIONS)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chatbot(request):
    message = str(request.data.get('message') or '').strip()
    requested_month = request.data.get('month') or None
    requested_agency_id = request.data.get('agency_id') or None
    lang = _chatbot_language(request.data.get('language') or request.data.get('lang') or 'en')

    agency = _resolve_chatbot_agency_from_message(message)
    if not agency and requested_agency_id not in (None, ''):
        try:
            agency = Agency.objects.get(id=requested_agency_id)
        except (Agency.DoesNotExist, ValueError):
            return Response(
                {
                    'reply': _localized_chatbot_text('agency_not_found', lang),
                    'intent': 'fallback',
                    'suggestions': _chatbot_suggestions(lang),
                },
                status=status.HTTP_200_OK,
            )

    detected_month = _resolve_chatbot_month_from_message(message, agency)
    month_value = detected_month or requested_month

    if month_value:
        try:
            if len(str(month_value)) != 7 or str(month_value)[4] != '-':
                raise ValueError
            selected_month = datetime.strptime(str(month_value), '%Y-%m')
        except ValueError:
            return Response(
                {'error': 'month must use YYYY-MM format.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        selected_month = _latest_sensor_month() or datetime.now()
        month_value = selected_month.strftime('%Y-%m')

    queryset = _chatbot_month_queryset(selected_month, agency)
    intent = _detect_chatbot_intent(message)
    reply_builders = {
        'greeting': _chatbot_greeting_reply,
        'platform_overview': _chatbot_platform_overview_reply,
        'modules': _chatbot_modules_reply,
        'navigation': _chatbot_navigation_reply,
        'agency_network': _chatbot_agency_network_reply,
        'data_model': _chatbot_data_model_reply,
        'ai_detector': _chatbot_ai_detector_reply,
        'reports': _chatbot_reports_reply,
        'settings': _chatbot_settings_reply,
        'security': _chatbot_security_reply,
        'api': _chatbot_api_reply,
        'energy_kpi': _chatbot_energy_kpi_reply,
        'alerts': _chatbot_alerts_reply,
        'compare_agencies': _chatbot_compare_agencies_reply,
        'recommendations': _chatbot_recommendations_reply,
        'monthly_summary': _chatbot_monthly_summary_reply,
        'explain_dashboard': _chatbot_explain_dashboard_reply,
        'fallback': _chatbot_fallback_reply,
    }
    reply = reply_builders[intent](queryset, month_value, agency)
    reply = _localize_chatbot_reply(intent, queryset, month_value, agency, lang, reply)

    return Response({
        'reply': reply,
        'intent': intent,
        'month': month_value,
        'agency_id': agency.id if agency else None,
        'agency_name': agency.name if agency else None,
        'suggestions': _chatbot_suggestions(lang),
    })


def _localized_chatbot_text(key, lang):
    texts = {
        'agency_not_found': {
            'en': 'I could not find the selected agency.',
            'fr': "Je n'ai pas trouvé l'agence sélectionnée.",
            'ar': 'لم أجد الوكالة المحددة.',
        },
    }
    return texts.get(key, {}).get(lang, texts.get(key, {}).get('en', ''))


def _chatbot_scope_text(agency, lang, all_agencies=False):
    if agency:
        if lang == 'fr':
            return f' pour {agency.name}'
        if lang == 'ar':
            return f' لوكالة {agency.name}'
        return f' for {agency.name}'
    if all_agencies:
        return {
            'en': ' for all agencies',
            'fr': ' pour toutes les agences',
            'ar': ' لكل الوكالات',
        }.get(lang, ' for all agencies')
    return ''


def _chatbot_no_data_localized(month_value, agency, lang):
    scope = _chatbot_scope_text(agency, lang)
    if lang == 'fr':
        return f"Aucune donnée capteur n'est disponible pour {month_value}{scope}. Essayez un autre mois ou une autre agence."
    if lang == 'ar':
        return f'لا توجد بيانات حساسات متاحة لشهر {month_value}{scope}. جرب شهرا أو وكالة أخرى.'
    return _chatbot_no_data_reply(month_value, agency)


def _localize_chatbot_reply(intent, queryset, month_value, agency, lang, english_reply):
    if lang == 'en':
        return english_reply
    if intent in {
        'greeting',
        'platform_overview',
        'modules',
        'navigation',
        'agency_network',
        'data_model',
        'ai_detector',
        'reports',
        'settings',
        'security',
        'api',
        'energy_kpi',
        'alerts',
        'compare_agencies',
        'recommendations',
        'monthly_summary',
        'explain_dashboard',
        'fallback',
    }:
        return _build_localized_chatbot_reply(intent, queryset, month_value, agency, lang)
    return english_reply


def _build_localized_chatbot_reply(intent, queryset, month_value, agency, lang):
    if intent == 'greeting':
        scope = _chatbot_scope_text(agency, lang)
        if lang == 'fr':
            return (
                "Bonjour, je suis l'assistant énergie. Je connais la plateforme BH Bank au-delà des KPI: "
                f"modules, navigation, agences, données capteurs, rapports, détection IA, paramètres, API, "
                f"alertes, comparaisons et recommandations pour {month_value}{scope}."
            )
        return (
            'مرحبا، أنا مساعد الطاقة. أفهم منصة BH Bank وليس مؤشرات الطاقة فقط. '
            f'يمكنني شرح الوحدات والتنقل والوكالات وبيانات الحساسات والتقارير وكاشف الذكاء الاصطناعي '
            f'والإعدادات وواجهات API والتنبيهات والمقارنات والتوصيات لشهر {month_value}{scope}.'
        )

    if intent == 'platform_overview':
        agency_count = Agency.objects.count()
        region_count = Region.objects.count()
        reading_count = SensorData.objects.count()
        if lang == 'fr':
            return (
                "Cette plateforme est une application de suivi énergétique et d'aide à la décision pour BH Bank. "
                f"Elle suit {agency_count} agence(s) dans {region_count} région(s), stocke {reading_count} lecture(s) "
                "capteur, puis transforme la température, le trafic clients, la consommation et le mode climatisation "
                "en tableaux de bord, alertes, comparaisons, rapports et analyses d'occupation par IA. "
                "Le flux principal est: collecter, analyser les KPI, détecter les anomalies, comparer, rapporter, puis agir."
            )
        return (
            f'هذه منصة لمراقبة الطاقة ودعم القرار في BH Bank. تتابع {agency_count} وكالة ضمن {region_count} جهة، '
            f'وتخزن {reading_count} قراءة حساسات، ثم تحول الحرارة وعدد العملاء واستهلاك الطاقة ووضع المكيف '
            'إلى لوحات قيادة وتنبيهات ومقارنات وتقارير ورؤى إشغال بالذكاء الاصطناعي. سير العمل هو: جمع البيانات، '
            'تحليل المؤشرات، كشف الحالات غير العادية، مقارنة الوكالات، إنشاء التقارير، ثم تطبيق التوصيات.'
        )

    if intent == 'modules':
        modules = '; '.join(
            f'{module["name"]} ({module["route"]}): {module["summary"]}'
            for module in CHATBOT_PLATFORM_MODULES
        )
        if lang == 'fr':
            return f'Les modules de la plateforme sont: {modules}'
        return f'وحدات المنصة هي: {modules}'

    if intent == 'navigation':
        if lang == 'fr':
            return (
                "Utilisez Dashboard pour la vue globale, Sensors pour les lectures brutes, Energy Usage pour les tendances, "
                "Compare Agencies pour le diagnostic côte à côte, Reports pour les synthèses et PDF, AI Detector pour "
                "l'occupation et les zones, Notre Reseau pour les agences, Governance pour les informations institutionnelles, "
                "et Settings pour les seuils, notifications, actualisation, thème et unités."
            )
        return (
            'استخدم Dashboard للنظرة العامة، وSensors للقراءات الخام، وEnergy Usage لاتجاهات الاستهلاك، '
            'وCompare Agencies للمقارنة، وReports للتقارير وPDF، وAI Detector لتحليل الإشغال والمناطق، '
            'وNotre Reseau لمواقع الوكالات، وGovernance للمعلومات المؤسسية، وSettings للعتبات والتنبيهات والتحديث والمظهر والوحدات.'
        )

    if intent == 'agency_network':
        return _localized_agency_network_reply(agency, lang)

    if intent == 'data_model':
        if lang == 'fr':
            return (
                "Le modèle de données principal contient Region, Agency et SensorData. Region regroupe le réseau. "
                "Agency stocke nom, région, adresse, téléphone, email, latitude, longitude et type d'agence. "
                "SensorData stocke agence, température, clients_count, energy_usage, ac_mode et timestamp."
            )
        return (
            'نموذج البيانات الأساسي يحتوي على Region وAgency وSensorData. Region تجمع الشبكة، وAgency تخزن الاسم '
            'والجهة والعنوان والهاتف والبريد والإحداثيات ونوع الوكالة، وSensorData تخزن الوكالة والحرارة وعدد العملاء '
            'واستهلاك الطاقة ووضع المكيف والتاريخ.'
        )

    if intent == 'ai_detector':
        scope = _chatbot_scope_text(agency, lang)
        if lang == 'fr':
            return (
                f"Le détecteur IA analyse des images simulées d'agence{scope}. Il estime les clients, employés, "
                "quatre zones, heures chargées, pic et occupation moyenne, puis fournit des recommandations de personnel, "
                "climatisation, zones et optimisation énergétique."
            )
        return (
            f'كاشف الذكاء الاصطناعي يحلل صورا محاكاة للوكالة{scope}. يقدر عدد العملاء والموظفين وأربع مناطق '
            'وساعات الازدحام والذروة والمتوسط، ثم يعطي توصيات للتوظيف والمكيف والمناطق وتحسين الطاقة.'
        )

    if intent == 'reports':
        scope = _chatbot_scope_text(agency, lang, all_agencies=True)
        if lang == 'fr':
            return (
                f"Les rapports transforment {month_value}{scope} en synthèse exécutive avec énergie totale, température moyenne, "
                "nombre d'alertes, clients, énergie hors horaires, lectures, énergie par client et niveau d'efficacité. "
                "L'interface prépare aussi des cartes KPI, graphiques et export PDF."
            )
        return (
            f'التقارير تحول بيانات {month_value}{scope} إلى ملخص تنفيذي فيه الطاقة الكلية ومتوسط الحرارة وعدد التنبيهات '
            'والعملاء والطاقة خارج أوقات العمل وعدد القراءات والطاقة لكل عميل ومستوى الكفاءة، مع بطاقات KPI ورسوم وتصدير PDF.'
        )

    if intent == 'settings':
        if lang == 'fr':
            return (
                "Les paramètres contrôlent le thème, l'actualisation automatique, les notifications, l'unité de température, "
                "le seuil d'alerte énergie et le seuil d'alerte température."
            )
        return 'الإعدادات تتحكم في المظهر والتحديث التلقائي والتنبيهات ووحدة الحرارة وعتبة تنبيه الطاقة وعتبة تنبيه الحرارة.'

    if intent == 'security':
        if lang == 'fr':
            return (
                "L'accès est protégé par authentification. Angular utilise un guard et un interceptor, et le backend Django "
                "fournit des JWT, la réinitialisation du mot de passe et des API opérationnelles réservées aux utilisateurs authentifiés."
            )
        return 'الوصول محمي بالمصادقة. Angular يستخدم حارسا واعتراضي API، وDjango يوفر JWT وإعادة تعيين كلمة المرور وواجهات محمية.'

    if intent == 'api':
        endpoints = ', '.join(CHATBOT_API_KNOWLEDGE)
        if lang == 'fr':
            return f"Le backend est une API Django REST. Les principaux endpoints sont: {endpoints}."
        return f'الخلفية هي Django REST API. أهم المسارات هي: {endpoints}.'

    if intent == 'energy_kpi':
        if not queryset.exists():
            return _chatbot_no_data_localized(month_value, agency, lang)
        stats = _chatbot_stats(queryset)
        scope = agency.name if agency else ('toutes les agences sélectionnées' if lang == 'fr' else 'كل الوكالات المحددة')
        if lang == 'fr':
            return (
                f'Pour {month_value}, {scope} a enregistré {stats["total_energy"]:.2f} kWh, '
                f'une température moyenne de {stats["avg_temperature"]:.1f}C, '
                f'{stats["total_clients"]} clients et {stats["readings"]} lectures capteur.'
            )
        return (
            f'في {month_value}، سجلت {scope} {stats["total_energy"]:.2f} kWh، '
            f'ومتوسط حرارة {stats["avg_temperature"]:.1f}C، و{stats["total_clients"]} عميلا، '
            f'و{stats["readings"]} قراءة حساسات.'
        )

    if intent == 'alerts':
        return _localized_alerts_reply(queryset, month_value, agency, lang)

    if intent == 'compare_agencies':
        return _localized_compare_agencies_reply(queryset, month_value, agency, lang)

    if intent == 'recommendations':
        return _localized_recommendations_reply(queryset, month_value, agency, lang)

    if intent == 'monthly_summary':
        return _localized_monthly_summary_reply(queryset, month_value, agency, lang)

    if intent == 'explain_dashboard':
        if lang == 'fr':
            return (
                "Les indicateurs Dashboard résument l'opérationnel: énergie totale en kWh, température moyenne, trafic clients, "
                "alertes anormales et état de climatisation OFF, ECO ou ON."
            )
        return 'مؤشرات Dashboard تلخص التشغيل: الطاقة الكلية kWh، متوسط الحرارة، حركة العملاء، التنبيهات، وحالة المكيف OFF أو ECO أو ON.'

    if lang == 'fr':
        return (
            "Je peux répondre aux questions sur toute la plateforme BH Bank: modules, navigation, agences, données capteurs, "
            "KPI, alertes, comparaisons, rapports, détecteur IA, paramètres, sécurité, API et recommandations."
        )
    return (
        'يمكنني الإجابة عن أسئلة تخص منصة BH Bank: الوحدات والتنقل والوكالات وبيانات الحساسات والمؤشرات والتنبيهات '
        'والمقارنات والتقارير وكاشف الذكاء الاصطناعي والإعدادات والأمان وواجهات API والتوصيات.'
    )


def _localized_agency_network_reply(agency, lang):
    if agency:
        contact = []
        if agency.address:
            contact.append(f'adresse: {agency.address}' if lang == 'fr' else f'العنوان: {agency.address}')
        if agency.phone:
            contact.append(f'téléphone: {agency.phone}' if lang == 'fr' else f'الهاتف: {agency.phone}')
        if agency.email:
            contact.append(f'email: {agency.email}' if lang == 'fr' else f'البريد: {agency.email}')
        contact_text = '; '.join(contact) if contact else ("aucun détail de contact enregistré" if lang == 'fr' else 'لا توجد تفاصيل اتصال محفوظة')
        if lang == 'fr':
            return f'{agency.name} appartient à {agency.region.name}. Type: {agency.agency_type}. Métadonnées: {contact_text}.'
        return f'{agency.name} تتبع {agency.region.name}. النوع: {agency.agency_type}. بيانات الموقع: {contact_text}.'

    regions = Region.objects.annotate(agency_count=Count('agencies')).order_by('name')
    region_text = ', '.join(f'{region.name}: {region.agency_count}' for region in regions)
    if lang == 'fr':
        return f'Le réseau contient {Agency.objects.count()} agence(s), regroupées par région: {region_text or "aucune région configurée"}.'
    return f'تحتوي الشبكة على {Agency.objects.count()} وكالة، مجمعة حسب الجهة: {region_text or "لا توجد جهات مهيأة"}.'


def _localized_alerts_reply(queryset, month_value, agency, lang):
    if not queryset.exists():
        return _chatbot_no_data_localized(month_value, agency, lang)
    candidates = []
    for reading in queryset.order_by('-timestamp')[:200]:
        candidates.extend(_build_alerts_for_reading(reading))
    alerts = _summarize_alerts_for_dashboard(candidates)
    if not alerts:
        if lang == 'fr':
            return f"Aucune alerte énergie, température ou hors horaires n'a été détectée pour {month_value}."
        return f'لم يتم كشف أي تنبيه للطاقة أو الحرارة أو خارج أوقات العمل في {month_value}.'
    if lang == 'fr':
        return f"J'ai trouvé {len(alerts)} groupe(s) d'alertes pour {month_value}. Vérifiez les plus récents dans Dashboard ou Alerts."
    return f'وجدت {len(alerts)} مجموعة تنبيهات في {month_value}. راجع أحدثها في Dashboard أو Alerts.'


def _localized_compare_agencies_reply(queryset, month_value, agency, lang):
    comparison = (
        queryset
        .values('agency', 'agency__name')
        .annotate(total_energy=Sum('energy_usage'), avg_temperature=Avg('temperature'), total_clients=Sum('clients_count'))
        .order_by('-total_energy')
    )
    rows = list(comparison)
    if not rows:
        return _chatbot_no_data_localized(month_value, agency, lang)
    if len(rows) == 1:
        row = rows[0]
        if lang == 'fr':
            return f'{row["agency__name"]} a consommé {float(row["total_energy"] or 0):.2f} kWh en {month_value}. Ajoutez une autre agence pour comparer.'
        return f'{row["agency__name"]} استهلكت {float(row["total_energy"] or 0):.2f} kWh في {month_value}. أضف وكالة أخرى للمقارنة.'
    highest = rows[0]
    lowest = rows[-1]
    gap = float(highest['total_energy'] or 0) - float(lowest['total_energy'] or 0)
    if lang == 'fr':
        return (
            f'{highest["agency__name"]} a consommé le plus en {month_value}: {float(highest["total_energy"] or 0):.2f} kWh. '
            f'{lowest["agency__name"]} a consommé le moins: {float(lowest["total_energy"] or 0):.2f} kWh, soit un écart de {gap:.2f} kWh.'
        )
    return (
        f'{highest["agency__name"]} هي الأعلى استهلاكا في {month_value}: {float(highest["total_energy"] or 0):.2f} kWh. '
        f'{lowest["agency__name"]} هي الأقل: {float(lowest["total_energy"] or 0):.2f} kWh، بفارق {gap:.2f} kWh.'
    )


def _localized_recommendations_reply(queryset, month_value, agency, lang):
    if not queryset.exists():
        return _chatbot_no_data_localized(month_value, agency, lang)
    stats = _chatbot_stats(queryset)
    if lang == 'fr':
        recommendations = []
        if stats['avg_temperature'] >= 28:
            recommendations.append('réviser les réglages de climatisation car la température moyenne est élevée')
        if stats['on_percentage'] >= 55:
            recommendations.append('utiliser ECO pendant les périodes de fréquentation modérée')
        if stats['energy_per_client'] > 0.2:
            recommendations.append("surveiller l'énergie par client et vérifier éclairage, climatisation et équipements")
        if stats['after_hours_energy'] > 0:
            recommendations.append('contrôler la climatisation, les lumières et les équipements après fermeture')
        if not recommendations:
            recommendations.append('la consommation semble stable; continuez à surveiller les pics et le mode ECO')
        return f'Recommandations pour {month_value}: ' + '; '.join(recommendations[:4]) + '.'

    recommendations = []
    if stats['avg_temperature'] >= 28:
        recommendations.append('راجع إعدادات التبريد لأن متوسط الحرارة مرتفع')
    if stats['on_percentage'] >= 55:
        recommendations.append('استخدم وضع ECO أثناء الإشغال المتوسط بدلا من ON طوال الوقت')
    if stats['energy_per_client'] > 0.2:
        recommendations.append('راقب الطاقة لكل عميل وافحص الإنارة والمكيف والمعدات')
    if stats['after_hours_energy'] > 0:
        recommendations.append('تحقق من المكيف والإنارة والمعدات بعد وقت الإغلاق')
    if not recommendations:
        recommendations.append('الاستهلاك مستقر؛ واصل مراقبة ساعات الذروة واستخدم ECO عندما تسمح الراحة')
    return f'توصيات {month_value}: ' + '؛ '.join(recommendations[:4]) + '.'


def _localized_monthly_summary_reply(queryset, month_value, agency, lang):
    if not queryset.exists():
        return _chatbot_no_data_localized(month_value, agency, lang)
    stats = _chatbot_stats(queryset)
    peak = queryset.values('agency__name').annotate(total_energy=Sum('energy_usage')).order_by('-total_energy').first()
    if lang == 'fr':
        peak_text = f' L’agence la plus consommatrice est {peak["agency__name"]}.' if peak and not agency else ''
        return (
            f'Résumé mensuel {month_value}: énergie totale {stats["total_energy"]:.2f} kWh, '
            f'température moyenne {stats["avg_temperature"]:.1f}C, clients moyens {stats["avg_clients"]:.1f}, '
            f'et climatisation ON {stats["on_percentage"]:.1f}% du temps.{peak_text}'
        )
    peak_text = f' أعلى وكالة استهلاكا هي {peak["agency__name"]}.' if peak and not agency else ''
    return (
        f'ملخص {month_value}: الطاقة الكلية {stats["total_energy"]:.2f} kWh، '
        f'متوسط الحرارة {stats["avg_temperature"]:.1f}C، متوسط العملاء {stats["avg_clients"]:.1f}، '
        f'والمكيف ON بنسبة {stats["on_percentage"]:.1f}% من الوقت.{peak_text}'
    )


def _latest_sensor_month():
    latest = SensorData.objects.order_by('-timestamp').first()
    if not latest:
        return None
    return latest.timestamp.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


CHATBOT_MONTH_NAMES = {
    'january': 1,
    'janvier': 1,
    'february': 2,
    'february': 2,
    'fevrier': 2,
    'fÃ©vrier': 2,
    'march': 3,
    'mars': 3,
    'april': 4,
    'avril': 4,
    'may': 5,
    'mai': 5,
    'june': 6,
    'juin': 6,
    'july': 7,
    'juillet': 7,
    'august': 8,
    'aout': 8,
    'aoÃ»t': 8,
    'september': 9,
    'septembre': 9,
    'october': 10,
    'octobre': 10,
    'november': 11,
    'novembre': 11,
    'december': 12,
    'decembre': 12,
    'dÃ©cembre': 12,
}


CHATBOT_AGENCY_STOPWORDS = {'bh', 'bank', 'banque', 'agence', 'agency'}


def _normalize_chatbot_lookup(value):
    text = unicodedata.normalize('NFKD', str(value or ''))
    text = ''.join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r'[^a-zA-Z0-9]+', ' ', text).lower()
    return re.sub(r'\s+', ' ', text).strip()


def _specific_chatbot_tokens(value):
    return [
        token
        for token in _normalize_chatbot_lookup(value).split()
        if token not in CHATBOT_AGENCY_STOPWORDS
    ]


def _resolve_chatbot_agency_from_message(message):
    text = _normalize_chatbot_lookup(message)
    if not text:
        return None

    best_agency = None
    best_score = 0
    for agency in Agency.objects.select_related('region').all():
        full_name = _normalize_chatbot_lookup(agency.name)
        specific_tokens = _specific_chatbot_tokens(agency.name)
        specific_name = ' '.join(specific_tokens)
        candidates = [full_name, specific_name]
        if agency.email:
            candidates.append(_normalize_chatbot_lookup(agency.email.split('@')[0]))

        score = 0
        for candidate in candidates:
            if candidate and candidate in text:
                score = max(score, len(candidate))
        if specific_tokens and all(token in text for token in specific_tokens):
            score = max(score, sum(len(token) for token in specific_tokens))

        if score > best_score:
            best_agency = agency
            best_score = score

    return best_agency


def _latest_chatbot_month_for_year(year, agency=None):
    queryset = SensorData.objects.filter(timestamp__year=year)
    if agency:
        queryset = queryset.filter(agency=agency)
    latest = queryset.order_by('-timestamp').first()
    if latest:
        return latest.timestamp.strftime('%Y-%m')

    latest_any_agency = SensorData.objects.filter(timestamp__year=year).order_by('-timestamp').first()
    if latest_any_agency:
        return latest_any_agency.timestamp.strftime('%Y-%m')

    return f'{year}-01'


def _resolve_chatbot_month_from_message(message, agency=None):
    raw_text = str(message or '').lower()
    direct_month = re.search(r'\b(20\d{2})-(0[1-9]|1[0-2])\b', raw_text)
    if direct_month:
        return direct_month.group(0)

    text = _normalize_chatbot_lookup(message)
    direct_month = re.search(r'\b(20\d{2})\s+(0[1-9]|1[0-2])\b', text)
    if direct_month:
        return f'{direct_month.group(1)}-{direct_month.group(2)}'

    year_match = re.search(r'\b(20\d{2})\b', text)
    year = int(year_match.group(1)) if year_match else None
    if not year:
        return None

    for month_name, month_number in CHATBOT_MONTH_NAMES.items():
        if month_name in text:
            return f'{year}-{month_number:02d}'

    return _latest_chatbot_month_for_year(year, agency)


def _chatbot_month_queryset(selected_month, agency=None):
    queryset = SensorData.objects.select_related('agency').filter(
        timestamp__year=selected_month.year,
        timestamp__month=selected_month.month,
    )
    if agency:
        queryset = queryset.filter(agency=agency)
    return queryset


def _detect_chatbot_intent(message):
    text = message.lower()
    if any(word in text for word in ['hello', 'hi', 'hey', 'bonjour', 'salut', 'salam']):
        return 'greeting'
    if any(phrase in text for phrase in ['all platform', 'whole platform', 'platform overview', 'about the platform', 'what is this platform', 'explain the platform', 'explain platform', 'plateforme', 'application', 'app overview']):
        return 'platform_overview'
    if any(phrase in text for phrase in ['module', 'page', 'screen', 'feature', 'fonctionnalit', 'rubrique', 'section']):
        return 'modules'
    if any(phrase in text for phrase in ['where can i', 'where do i', 'how can i access', 'go to', 'navigate', 'navigation', 'route', 'menu']):
        return 'navigation'
    if any(phrase in text for phrase in ['agency list', 'agency network', 'agencies list', 'network', 'notre reseau', 'notre rÃ©seau', 'region', 'regions', 'address', 'phone', 'email']):
        return 'agency_network'
    if any(phrase in text for phrase in ['data model', 'database', 'sensor data', 'stored data', 'fields', 'schema', 'model']):
        return 'data_model'
    if any(phrase in text for phrase in ['ai detector', 'occupancy', 'computer vision', 'vision', 'zone', 'crowded', 'client detection', 'detecteur', 'dÃ©tecteur']):
        return 'ai_detector'
    if any(phrase in text for phrase in ['report', 'pdf', 'executive summary', 'rapport', 'summary report']):
        return 'reports'
    if any(phrase in text for phrase in ['setting', 'threshold', 'preference', 'theme', 'dark mode', 'notification', 'temperature unit', 'parametre', 'paramÃ¨tre']):
        return 'settings'
    if any(phrase in text for phrase in ['login', 'auth', 'jwt', 'password', 'security', 'secure', 'reset password', 'forgot password', 'connexion']):
        return 'security'
    if any(phrase in text for phrase in ['api', 'endpoint', 'backend', 'django', 'rest']):
        return 'api'
    if any(phrase in text for phrase in ['explain dashboard', 'dashboard', 'indicator', 'indicators', 'indicateur', 'tableau de bord']):
        return 'explain_dashboard'
    if any(phrase in text for phrase in ['recommend', 'advice', 'saving', 'optimize', 'optimise', 'recommandation', 'conseil', 'econom', 'économ']):
        return 'recommendations'
    if any(phrase in text for phrase in ['summary', 'summarize', 'monthly performance', 'resume', 'résumé', 'bilan']):
        return 'monthly_summary'
    if any(phrase in text for phrase in ['alert', 'warning', 'alerte']):
        return 'alerts'
    if any(phrase in text for phrase in ['compare', 'comparison', 'most energy', 'highest energy', 'consumes the most', 'more energy', 'comparer', 'plus consom']):
        return 'compare_agencies'
    if any(phrase in text for phrase in ['kpi', 'energy', 'temperature', 'client', 'consumption', 'consommation', 'energie', 'énergie']):
        return 'energy_kpi'
    return 'fallback'


def _chatbot_greeting_reply(queryset, month_value, agency):
    scope = f' for {agency.name}' if agency else ''
    return (
        f'Hello, I am the Energy Assistant. I understand the BH Bank energy platform, not only KPIs. '
        f'I can explain modules, navigation, agencies, sensor data, reports, AI detection, settings, APIs, '
        f'alerts, comparisons, and recommendations for {month_value}{scope}.'
    )


def _chatbot_no_data_reply(month_value, agency):
    scope = f' for {agency.name}' if agency else ''
    return f'No sensor data is available for {month_value}{scope}. Try another month or agency.'


def _chatbot_platform_overview_reply(queryset, month_value, agency):
    agency_count = Agency.objects.count()
    region_count = Region.objects.count()
    reading_count = SensorData.objects.count()
    return (
        'This platform is a BH Bank energy monitoring and decision-support application. '
        f'It tracks {agency_count} agency location(s) across {region_count} region(s), stores '
        f'{reading_count} sensor reading(s), and turns temperature, client traffic, energy usage, '
        'and AC mode data into dashboards, alerts, comparisons, reports, and AI occupancy insights. '
        'The main workflow is: collect sensor readings, analyze KPIs, detect anomalies, compare agencies, '
        'generate reports, then apply operational recommendations.'
    )


def _chatbot_modules_reply(queryset, month_value, agency):
    modules = '; '.join(
        f'{module["name"]} ({module["route"]}): {module["summary"]}'
        for module in CHATBOT_PLATFORM_MODULES
    )
    return f'The platform modules are: {modules}'


def _chatbot_navigation_reply(queryset, month_value, agency):
    return (
        'Use Dashboard for the overall situation, Sensors for raw readings, Energy Usage for consumption trends, '
        'Compare Agencies for side-by-side diagnosis, Reports for monthly executive output and PDF export, '
        'AI Detector for occupancy and zone analysis, Notre Reseau for BH Bank locations, Governance for '
        'institutional information, and Settings for thresholds, notifications, refresh, theme, and units.'
    )


def _chatbot_agency_network_reply(queryset, month_value, agency):
    if agency:
        contact = []
        if agency.address:
            contact.append(f'address: {agency.address}')
        if agency.phone:
            contact.append(f'phone: {agency.phone}')
        if agency.email:
            contact.append(f'email: {agency.email}')
        contact_text = '; '.join(contact) if contact else 'no contact details are saved yet'
        return (
            f'{agency.name} belongs to {agency.region.name}. Type: {agency.agency_type}. '
            f'Location metadata: {contact_text}.'
        )

    regions = (
        Region.objects
        .annotate(agency_count=Count('agencies'))
        .order_by('name')
    )
    region_text = ', '.join(
        f'{region.name}: {region.agency_count}'
        for region in regions
    ) or 'no regions are configured yet'
    return (
        f'The network contains {Agency.objects.count()} agency location(s). '
        f'Agencies are grouped by region: {region_text}. Select a specific agency in the assistant filter '
        'if you want its address, phone, email, type, and region.'
    )


def _chatbot_data_model_reply(queryset, month_value, agency):
    return (
        'The core data model has Region, Agency, and SensorData. Region stores the network grouping. '
        'Agency stores name, region, address, phone, email, latitude, longitude, and agency type. '
        'SensorData stores agency, temperature, clients_count, energy_usage, ac_mode, and timestamp. '
        'Each agency can have only one sensor reading for the same timestamp, which keeps KPI aggregation clean.'
    )


def _chatbot_ai_detector_reply(queryset, month_value, agency):
    scope = f' for {agency.name}' if agency else ''
    return (
        f'The AI Detector analyzes simulated agency images{scope}. It estimates total clients, employees, '
        'four zone counts, crowded hours, peak occupancy, and average occupancy. Daily analysis returns hourly '
        'images plus staffing, AC control, zone crowding, and energy optimization recommendations. Monthly '
        'analysis summarizes business days, total images, peak client time, zone averages, zone totals, and crowded hours.'
    )


def _chatbot_reports_reply(queryset, month_value, agency):
    scope = f' for {agency.name}' if agency else ' for all agencies'
    return (
        f'Reports convert {month_value}{scope} into an executive summary with total energy, average temperature, '
        'alert count, client count, after-hours energy, readings count, energy per client, and efficiency level. '
        'The frontend also prepares KPI cards, charts, and PDF export for management review.'
    )


def _chatbot_settings_reply(queryset, month_value, agency):
    return (
        'Settings control how the platform behaves for the user: visual theme, automatic refresh, notification '
        'preferences, temperature unit, energy alert threshold, and temperature alert threshold. These thresholds '
        'influence how alerts are interpreted in the interface.'
    )


def _chatbot_security_reply(queryset, month_value, agency):
    return (
        'Access is protected with authentication. The Angular frontend uses an auth guard for private pages and '
        'an interceptor for API authentication. The Django backend exposes login through JWT tokens, includes '
        'password reset code endpoints, and requires authenticated access for operational APIs such as chatbot, '
        'KPIs, reports, alerts, agencies, and sensor data.'
    )


def _chatbot_api_reply(queryset, month_value, agency):
    return (
        'The backend is a Django REST API. Main endpoints are: '
        f'{", ".join(CHATBOT_API_KNOWLEDGE)}. '
        'They cover reference data, sensor readings, alerts, chatbot answers, executive reports, daily/monthly KPIs, '
        'agency comparison, and AI detector analysis.'
    )


def _chatbot_energy_kpi_reply(queryset, month_value, agency):
    if not queryset.exists():
        return _chatbot_no_data_reply(month_value, agency)
    stats = _chatbot_stats(queryset)
    scope = agency.name if agency else 'all selected agencies'
    return (
        f'For {month_value}, {scope} recorded {stats["total_energy"]:.2f} kWh, '
        f'an average temperature of {stats["avg_temperature"]:.1f}C, '
        f'{stats["total_clients"]} total clients, and {stats["readings"]} sensor readings.'
    )


def _chatbot_alerts_reply(queryset, month_value, agency):
    if not queryset.exists():
        return _chatbot_no_data_reply(month_value, agency)
    candidates = []
    for reading in queryset.order_by('-timestamp')[:200]:
        candidates.extend(_build_alerts_for_reading(reading))
    alerts = _summarize_alerts_for_dashboard(candidates)
    if not alerts:
        return f'No energy, temperature, or after-hours alerts were detected for {month_value}.'
    top_alerts = alerts[:3]
    details = ' '.join(alert['message'] for alert in top_alerts)
    return f'I found {len(alerts)} alert group(s) for {month_value}. {details}'


def _chatbot_compare_agencies_reply(queryset, month_value, agency):
    comparison = (
        queryset
        .values('agency', 'agency__name')
        .annotate(total_energy=Sum('energy_usage'), avg_temperature=Avg('temperature'), total_clients=Sum('clients_count'))
        .order_by('-total_energy')
    )
    rows = list(comparison)
    if not rows:
        return _chatbot_no_data_reply(month_value, agency)
    if len(rows) == 1:
        row = rows[0]
        return f'{row["agency__name"]} consumed {float(row["total_energy"] or 0):.2f} kWh in {month_value}. Add another agency to compare performance.'
    highest = rows[0]
    lowest = rows[-1]
    gap = float(highest['total_energy'] or 0) - float(lowest['total_energy'] or 0)
    return (
        f'{highest["agency__name"]} consumed the most energy in {month_value} with '
        f'{float(highest["total_energy"] or 0):.2f} kWh. '
        f'{lowest["agency__name"]} consumed the least with {float(lowest["total_energy"] or 0):.2f} kWh, '
        f'a gap of {gap:.2f} kWh.'
    )


def _chatbot_recommendations_reply(queryset, month_value, agency):
    if not queryset.exists():
        return _chatbot_no_data_reply(month_value, agency)
    stats = _chatbot_stats(queryset)
    recommendations = []
    if stats['avg_temperature'] >= 28:
        recommendations.append('Review cooling settings because the average temperature is high.')
    if stats['on_percentage'] >= 55:
        recommendations.append('Use ECO mode during moderate occupancy instead of keeping AC ON most of the time.')
    if stats['energy_per_client'] > 0.2:
        recommendations.append('Monitor energy per client and check lighting, AC, and equipment routines.')
    if stats['after_hours_energy'] > 0:
        recommendations.append('Check AC, lighting, and office equipment after closing hours.')
    if stats['avg_clients'] < 5 and stats['total_energy'] > 0:
        recommendations.append('Reduce AC intensity during low client traffic periods.')
    if not recommendations:
        recommendations.append('Consumption looks stable. Continue monitoring peak hours and keep ECO mode active when comfort allows.')
    return f'Recommendations for {month_value}: ' + ' '.join(f'{index + 1}. {item}' for index, item in enumerate(recommendations[:4]))


def _chatbot_monthly_summary_reply(queryset, month_value, agency):
    if not queryset.exists():
        return _chatbot_no_data_reply(month_value, agency)
    stats = _chatbot_stats(queryset)
    peak = (
        queryset
        .values('agency__name')
        .annotate(total_energy=Sum('energy_usage'))
        .order_by('-total_energy')
        .first()
    )
    peak_text = f' The highest-consuming agency was {peak["agency__name"]}.' if peak and not agency else ''
    return (
        f'Monthly summary for {month_value}: total energy was {stats["total_energy"]:.2f} kWh, '
        f'average temperature was {stats["avg_temperature"]:.1f}C, average client count was {stats["avg_clients"]:.1f}, '
        f'and AC was ON {stats["on_percentage"]:.1f}% of the time.{peak_text}'
    )


def _chatbot_explain_dashboard_reply(queryset, month_value, agency):
    return (
        'Dashboard indicators are simple operational KPIs: total energy shows consumed kWh, '
        'average temperature shows comfort conditions, clients show agency traffic, alerts show abnormal energy or temperature events, '
        'and AC status shows whether cooling was OFF, ECO, or ON.'
    )


def _chatbot_fallback_reply(queryset, month_value, agency):
    return (
        'I can only answer questions about BH Bank energy monitoring: KPIs, alerts, agency comparison, '
        'recommendations, monthly summaries, and dashboard indicators.'
    )


def _chatbot_stats(queryset):
    aggregates = queryset.aggregate(
        total_energy=Sum('energy_usage'),
        avg_temperature=Avg('temperature'),
        total_clients=Sum('clients_count'),
        avg_clients=Avg('clients_count'),
        readings=Count('id'),
    )
    readings = aggregates['readings'] or 0
    total_energy = float(aggregates['total_energy'] or 0)
    total_clients = int(aggregates['total_clients'] or 0)
    ac_counts = queryset.values('ac_mode').annotate(count=Count('id'))
    on_count = sum(item['count'] for item in ac_counts if item['ac_mode'] == ACMode.ON)
    after_hours_energy = (
        queryset
        .filter(
            Q(timestamp__week_day__in=[1, 7])
            | Q(timestamp__hour__lt=8)
            | Q(timestamp__hour__gte=17)
        )
        .aggregate(total=Sum('energy_usage'))['total']
        or Decimal('0')
    )
    return {
        'total_energy': total_energy,
        'avg_temperature': float(aggregates['avg_temperature'] or 0),
        'total_clients': total_clients,
        'avg_clients': float(aggregates['avg_clients'] or 0),
        'readings': readings,
        'on_percentage': _safe_percentage(on_count, readings),
        'energy_per_client': total_energy / total_clients if total_clients else 0,
        'after_hours_energy': float(after_hours_energy),
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def executive_summary(request):
    month_value = request.data.get('month')
    agency_id = request.data.get('agency_id') or None

    try:
        selected_month = _parse_report_month(month_value)
    except ValueError:
        return Response(
            {'error': 'month must use YYYY-MM format.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    agency = None
    if agency_id not in (None, ''):
        try:
            agency = Agency.objects.get(id=agency_id)
        except (Agency.DoesNotExist, ValueError):
            return Response(
                {'error': 'Agency not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

    queryset = SensorData.objects.select_related('agency').filter(
        timestamp__year=selected_month.year,
        timestamp__month=selected_month.month,
    )
    regional_queryset = queryset
    if agency:
        queryset = queryset.filter(agency=agency)

    metrics = _build_executive_summary_metrics(queryset, regional_queryset)
    summary = _build_executive_summary_text(
        month_value=selected_month.strftime('%Y-%m'),
        agency=agency,
        metrics=metrics,
        regional_average=_regional_energy_average(regional_queryset),
        has_data=queryset.exists(),
    )

    return Response({
        'summary': summary,
        'metrics': metrics,
    })


def _parse_report_month(month_value):
    month_text = str(month_value or '')
    if len(month_text) != 7 or month_text[4] != '-':
        raise ValueError
    return datetime.strptime(month_text, '%Y-%m')


def _build_executive_summary_metrics(queryset, regional_queryset):
    aggregates = queryset.aggregate(
        total_energy=Sum('energy_usage'),
        avg_temperature=Avg('temperature'),
        clients_count=Sum('clients_count'),
        readings_count=Count('id'),
    )
    total_energy = float(aggregates['total_energy'] or 0)
    avg_temperature = float(aggregates['avg_temperature'] or 0)
    clients_count = int(aggregates['clients_count'] or 0)
    alerts_count = _count_alerts_for_queryset(queryset)
    after_hours_usage = float(_after_hours_energy(queryset))
    energy_per_client = total_energy / clients_count if clients_count else 0

    return {
        'total_energy': round(total_energy, 2),
        'avg_temperature': round(avg_temperature, 1),
        'alerts_count': alerts_count,
        'clients_count': clients_count,
        'after_hours_energy': round(after_hours_usage, 2),
        'readings_count': aggregates['readings_count'] or 0,
        'energy_per_client': round(energy_per_client, 4),
        'efficiency_level': _efficiency_level(total_energy, clients_count, alerts_count, after_hours_usage, regional_queryset),
    }


def _count_alerts_for_queryset(queryset):
    count = 0
    for reading in queryset:
        count += len(_build_alerts_for_reading(reading))
    return count


def _after_hours_energy(queryset):
    return (
        queryset
        .filter(
            Q(timestamp__week_day__in=[1, 7])
            | Q(timestamp__hour__lt=8)
            | Q(timestamp__hour__gte=17)
        )
        .aggregate(total=Sum('energy_usage'))['total']
        or Decimal('0')
    )


def _regional_energy_average(queryset):
    agency_totals = (
        queryset
        .values('agency')
        .annotate(total_energy=Sum('energy_usage'))
    )
    totals = [float(row['total_energy'] or 0) for row in agency_totals]
    return sum(totals) / len(totals) if totals else 0


def _efficiency_level(total_energy, clients_count, alerts_count, after_hours_usage, regional_queryset):
    if total_energy <= 0:
        return 'Moderate'

    score = 0
    regional_average = _regional_energy_average(regional_queryset)
    energy_per_client = total_energy / clients_count if clients_count else total_energy

    if regional_average and total_energy > regional_average * 1.2:
        score += 2
    elif regional_average and total_energy > regional_average * 1.05:
        score += 1

    if energy_per_client > 0.25:
        score += 2
    elif energy_per_client > 0.16:
        score += 1

    if alerts_count >= 8:
        score += 2
    elif alerts_count >= 3:
        score += 1

    if after_hours_usage > total_energy * 0.12:
        score += 2
    elif after_hours_usage > 0:
        score += 1

    if score <= 1:
        return 'Excellent'
    if score <= 3:
        return 'Good'
    if score <= 5:
        return 'Moderate'
    return 'Poor'


def _build_executive_summary_text(month_value, agency, metrics, regional_average, has_data):
    scope = agency.name if agency else 'BH Bank agencies'
    if not has_data:
        return (
            f'No sensor readings were available for {scope} during {month_value}. '
            'The reporting view should be refreshed once operational data is collected for the selected period.'
        )

    observations = [
        f'During {month_value}, {scope} recorded {metrics["total_energy"]:.2f} kWh of energy consumption '
        f'for {metrics["clients_count"]} client visits, with an average temperature of {metrics["avg_temperature"]:.1f}C.'
    ]

    if regional_average and metrics['total_energy'] > regional_average * 1.15:
        observations.append('Energy consumption remained above the regional average during the selected period.')
    elif regional_average and metrics['total_energy'] < regional_average * 0.85:
        observations.append('Energy consumption remained below the regional average, indicating controlled operational load.')
    else:
        observations.append('Energy consumption was broadly aligned with the observed portfolio average.')

    if metrics['avg_temperature'] >= 28:
        observations.append('Elevated temperatures increased cooling demand across the agency.')
    elif metrics['avg_temperature'] <= 20 and metrics['readings_count']:
        observations.append('Temperature conditions were moderate, limiting the expected cooling load.')

    if metrics['alerts_count'] >= 5:
        observations.append('Several operational alerts were triggered, indicating optimization opportunities.')
    elif metrics['alerts_count'] > 0:
        observations.append('A limited number of alerts were detected and should be monitored.')
    else:
        observations.append('No significant alert activity was detected for the period.')

    if metrics['after_hours_energy'] > 0:
        observations.append('Unusual after-hours energy activity was observed and should be reviewed by operations.')

    observations.append(f'The overall energy efficiency level is assessed as {metrics["efficiency_level"]}.')
    return ' '.join(observations)


def _build_daily_ai_recommendations(
    rows,
    peak_clients,
    peak_timestamp,
    average_clients,
    average_employees,
    zone_summary,
):
    recommendations = []
    peak_hour = _format_hour(peak_timestamp)

    if peak_clients >= 25:
        recommendations.append({
            'type': 'staffing',
            'severity': 'high',
            'message': (
                f'Peak client flow reached {peak_clients} clients around {peak_hour}. '
                'Additional staff may reduce waiting time during this period.'
            ),
        })
    elif peak_clients >= 18:
        recommendations.append({
            'type': 'staffing',
            'severity': 'medium',
            'message': (
                f'Peak client flow reached {peak_clients} clients around {peak_hour}. '
                'Consider reinforcing the front desk during the busiest hour.'
            ),
        })

    if average_clients >= 15 or peak_clients >= 25:
        recommendations.append({
            'type': 'ac_control',
            'severity': 'medium',
            'message': (
                'High occupancy increases cooling demand. AC ON mode is recommended '
                f'during peak hours around {peak_hour}.'
            ),
        })
    elif 8 <= average_clients <= 14:
        recommendations.append({
            'type': 'ac_control',
            'severity': 'medium',
            'message': (
                'Moderate occupancy was detected through the day. ECO mode should keep '
                'comfort stable while limiting energy usage.'
            ),
        })
    else:
        recommendations.append({
            'type': 'ac_control',
            'severity': 'low',
            'message': (
                'Low average occupancy was detected. Reducing AC intensity can help avoid '
                'unnecessary energy consumption.'
            ),
        })

    busiest_zone, busiest_zone_avg = _busiest_zone(zone_summary)
    if busiest_zone_avg >= 8:
        recommendations.append({
            'type': 'zone_crowding',
            'severity': 'high',
            'message': (
                f'{_zone_label(busiest_zone)} shows repeated crowding with an average of '
                f'{busiest_zone_avg:.1f} clients. Consider improving queue distribution.'
            ),
        })
    elif busiest_zone_avg >= 5:
        recommendations.append({
            'type': 'zone_crowding',
            'severity': 'medium',
            'message': (
                f'{_zone_label(busiest_zone)} is the busiest area. Monitor waiting queues '
                'and redistribute clients when possible.'
            ),
        })

    afternoon_rows = [row for row in rows if datetime.fromisoformat(row['timestamp']).hour >= 15]
    afternoon_average = _average(row['total_clients'] for row in afternoon_rows)
    if afternoon_rows and afternoon_average < average_clients:
        recommendations.append({
            'type': 'energy_optimization',
            'severity': 'low',
            'message': (
                'Low afternoon occupancy suggests ECO mode can reduce energy waste after 15:00.'
            ),
        })
    elif average_clients < 8:
        recommendations.append({
            'type': 'energy_optimization',
            'severity': 'low',
            'message': (
                'Low daily occupancy suggests ECO mode and reduced AC intensity can limit energy waste.'
            ),
        })
    elif average_clients >= 15:
        recommendations.append({
            'type': 'energy_optimization',
            'severity': 'medium',
            'message': (
                'Client presence stays high across the day. Maintain comfort mode while '
                'watching for unnecessary cooling outside peak hours.'
            ),
        })

    if average_employees > 0 and peak_clients / average_employees > 6:
        recommendations.append({
            'type': 'staffing',
            'severity': 'high',
            'message': (
                'The peak client-to-employee ratio is high. Adding staff during peak flow '
                'can improve service quality.'
            ),
        })

    return recommendations[:5]


def _format_hour(timestamp):
    if not timestamp:
        return 'the peak hour'
    return datetime.fromisoformat(timestamp).strftime('%H:%M')


def _busiest_zone(zone_summary):
    mapping = {
        'zone_1': zone_summary.get('zone_1_avg', 0),
        'zone_2': zone_summary.get('zone_2_avg', 0),
        'zone_3': zone_summary.get('zone_3_avg', 0),
        'zone_4': zone_summary.get('zone_4_avg', 0),
    }
    return max(mapping.items(), key=lambda item: item[1])


def _zone_label(zone):
    return zone.replace('zone_', 'Zone ')


def _build_crowded_hours(rows):
    crowded = []
    zone_keys = [
        ('zone_1', 'zone_1_clients'),
        ('zone_2', 'zone_2_clients'),
        ('zone_3', 'zone_3_clients'),
        ('zone_4', 'zone_4_clients'),
    ]

    for row in rows:
        crowded_zone, _ = max(
            zone_keys,
            key=lambda item: row[item[1]],
        )
        if row['total_clients'] >= 18:
            crowded.append({
                'timestamp': row['timestamp'],
                'total_clients': row['total_clients'],
                'crowded_zone': crowded_zone,
            })

    return sorted(crowded, key=lambda item: item['total_clients'], reverse=True)


@api_view(['GET'])
def recent_alerts(request):
    month = request.query_params.get('month')
    agency = request.query_params.get('agency')
    energy_threshold = _get_energy_alert_threshold(request)
    temperature_threshold = _get_temperature_alert_threshold(request)
    queryset = (
        SensorData.objects
        .select_related('agency')
        .filter(
            Q(temperature__gt=temperature_threshold)
            | Q(energy_usage__gt=energy_threshold)
            | (
                Q(energy_usage__gt=1)
                & (
                    Q(timestamp__week_day__in=[1, 7])
                    | Q(timestamp__hour__lt=8)
                    | Q(timestamp__hour__gte=17)
                )
            )
        )
    )

    if month:
        try:
            year, month_number = month.split('-')
            year = int(year)
            month_number = int(month_number)
        except ValueError:
            return Response(
                {'error': 'month must use YYYY-MM format'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        queryset = queryset.filter(
            timestamp__year=year,
            timestamp__month=month_number,
        )

    if agency:
        queryset = queryset.filter(agency_id=agency)

    queryset = queryset.order_by('-timestamp')[:200]

    candidates = []
    for reading in queryset:
        candidates.extend(_build_alerts_for_reading(reading, energy_threshold, temperature_threshold))

    return Response(_summarize_alerts_for_dashboard(candidates))


def _get_energy_alert_threshold(request):
    raw_value = request.query_params.get('energy_threshold')
    try:
        threshold = float(raw_value) if raw_value is not None else 4
    except (TypeError, ValueError):
        threshold = 4
    return threshold if threshold > 0 else 4


def _get_temperature_alert_threshold(request):
    raw_value = request.query_params.get('temperature_threshold')
    try:
        threshold = float(raw_value) if raw_value is not None else 30
    except (TypeError, ValueError):
        threshold = 30
    return threshold if -50 < threshold < 80 else 30


def _build_alerts_for_reading(reading, energy_threshold=4, temperature_threshold=30):
    alerts = []
    temperature = float(reading.temperature)
    energy_usage = float(reading.energy_usage)

    if temperature > temperature_threshold:
        alerts.append({
            'agency_name': reading.agency.name,
            'type': 'High temperature',
            'alert_key': 'high_temperature',
            'severity': 'critical',
            'message': f'{reading.agency.name} recorded {temperature:.1f}°C, above the {temperature_threshold:.1f}°C temperature alert threshold.',
            'timestamp': reading.timestamp,
            'temperature': round(temperature, 1),
            'temperature_threshold': round(temperature_threshold, 1),
        })

    if energy_usage > energy_threshold:
        alerts.append({
            'agency_name': reading.agency.name,
            'type': 'High energy usage',
            'alert_key': 'high_energy_usage',
            'severity': 'critical',
            'message': f'{reading.agency.name} consumed {energy_usage:.2f} kWh, above the {energy_threshold:.2f} kWh alert threshold.',
            'timestamp': reading.timestamp,
            'energy_usage': round(energy_usage, 2),
            'energy_threshold': round(energy_threshold, 2),
        })

    if energy_usage > 1 and _is_outside_business_hours(reading.timestamp):
        alerts.append({
            'agency_name': reading.agency.name,
            'type': 'After-hours energy waste',
            'alert_key': 'after_hours_energy_waste',
            'severity': 'warning',
            'message': f'{reading.agency.name} used {energy_usage:.2f} kWh outside business hours.',
            'timestamp': reading.timestamp,
            'energy_usage': round(energy_usage, 2),
        })

    return alerts


def _summarize_alerts_for_dashboard(candidates):
    """Keep dashboard alerts concise: one monthly remark per agency and alert type."""
    grouped = {}

    for alert in candidates:
        month = _alert_month(alert)
        key = (
            month,
            alert['agency_name'],
            alert.get('alert_key') or alert['type'],
        )
        existing = grouped.get(key)

        if not existing:
            grouped[key] = {**alert, 'occurrences': 1}
            continue

        existing['occurrences'] += 1
        if alert['timestamp'] > existing['timestamp']:
            existing['timestamp'] = alert['timestamp']

        if 'temperature' in alert:
            existing['temperature'] = max(
                existing.get('temperature', alert['temperature']),
                alert['temperature'],
            )
            existing['temperature_threshold'] = alert.get(
                'temperature_threshold',
                existing.get('temperature_threshold'),
            )

        if 'energy_usage' in alert:
            existing['energy_usage'] = max(
                existing.get('energy_usage', alert['energy_usage']),
                alert['energy_usage'],
            )
            existing['energy_threshold'] = alert.get(
                'energy_threshold',
                existing.get('energy_threshold'),
            )

    return sorted(
        grouped.values(),
        key=lambda alert: alert['timestamp'],
        reverse=True,
    )


def _is_outside_business_hours(value):
    return value.weekday() >= 5 or value.hour < 8 or value.hour >= 17


def _select_diverse_recent_alerts(candidates, limit=5):
    selected = []
    remaining = list(candidates)
    used_agencies = set()
    used_types = set()
    used_months = set()

    while remaining and len(selected) < limit:
        best_index = 0
        best_score = -1

        for index, alert in enumerate(remaining):
            month = _alert_month(alert)
            score = 0
            if alert['agency_name'] not in used_agencies:
                score += 3
            if alert['type'] not in used_types:
                score += 3
            if month not in used_months:
                score += 2

            if score > best_score:
                best_score = score
                best_index = index

        alert = remaining.pop(best_index)
        selected.append(alert)
        used_agencies.add(alert['agency_name'])
        used_types.add(alert['type'])
        used_months.add(_alert_month(alert))

    return selected


def _alert_month(alert):
    return alert['timestamp'].strftime('%Y-%m')


@api_view(['GET'])
def daily_energy_kpi(request):
    queryset = _filter_sensor_data_by_period(SensorData.objects.all(), request)
    data = (
        queryset
        .annotate(date=TruncDate('timestamp'))
        .values('agency', 'agency__name', 'date')
        .annotate(
            total_energy=Sum('energy_usage'),
            total_clients=Sum('clients_count'),
            avg_clients=Avg('clients_count'),
            readings_count=Count('id'),
        )
        .order_by('agency', 'date')
    )

    result = [
        {
            'agency': row['agency'],
            'agency_name': row['agency__name'],
            'date': row['date'],
            'total_energy': round(float(row['total_energy'] or 0), 2),
            'total_clients': row['total_clients'] or 0,
            'avg_clients': round(float(row['avg_clients'] or 0), 1),
            'readings_count': row['readings_count'],
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


User = get_user_model()

PASSWORD_RESET_ADMINS = {
    'hedi': 'medhedibousnina01@gmail.com',
    'fedi': 'mansourfedi38@gmail.com',
}
PASSWORD_RESET_CODE_TTL_SECONDS = 10 * 60


def _normalize_reset_admin(value):
    return str(value or '').strip().lower()


def _normalize_reset_email(value):
    return str(value or '').strip().lower()


def _validate_reset_identity(admin, email):
    admin_key = _normalize_reset_admin(admin)
    email_key = _normalize_reset_email(email)
    expected_email = PASSWORD_RESET_ADMINS.get(admin_key)

    if not expected_email or email_key != expected_email:
        return None, None, Response(
            {'error': 'Selected admin and email address do not match.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return admin_key, email_key, None


def _reset_code_cache_key(admin, email):
    return f'password-reset-code:{admin}:{email}'


@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset_code(request):
    admin = request.data.get('admin')
    email = request.data.get('email')
    admin_key, email_key, error_response = _validate_reset_identity(admin, email)

    if error_response:
        return error_response

    if not User.objects.filter(email__iexact=email_key).exists():
        return Response(
            {'error': 'No account found with this email address.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    code = f'{random.SystemRandom().randint(100000, 999999)}'
    cache.set(
        _reset_code_cache_key(admin_key, email_key),
        code,
        timeout=PASSWORD_RESET_CODE_TTL_SECONDS,
    )

    send_mail(
        subject='BH Bank password reset code',
        message=f'Your BH Bank password reset verification code is: {code}\n\nThis code expires in 10 minutes.',
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
        recipient_list=[email_key],
        fail_silently=False,
    )

    return Response(
        {'message': 'Verification code sent successfully.'},
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    admin = request.data.get('admin')
    email = request.data.get('email')
    code = str(request.data.get('code') or '').strip()
    new_password = request.data.get('new_password')

    if not admin or not email or not code or not new_password:
        return Response(
            {'error': 'Admin, email, verification code and new password are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    admin_key, email_key, error_response = _validate_reset_identity(admin, email)
    if error_response:
        return error_response

    cached_code = cache.get(_reset_code_cache_key(admin_key, email_key))
    if not cached_code or cached_code != code:
        return Response(
            {'error': 'Invalid or expired verification code.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(email__iexact=email_key)
    except User.DoesNotExist:
        return Response(
            {'error': 'No account found with this email address.'},
            status=status.HTTP_404_NOT_FOUND
        )

    user.set_password(new_password)
    user.save()
    cache.delete(_reset_code_cache_key(admin_key, email_key))

    return Response(
        {'message': 'Password has been reset successfully.'},
        status=status.HTTP_200_OK
    )


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
