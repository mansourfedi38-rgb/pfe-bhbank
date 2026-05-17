import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export type ApiSubject = 'subjects' | 'regions' | 'agencies' | 'sensor-data' | 'ai-detector/demo' | 'ai-detector/daily' | 'ai-detector/monthly' | 'alerts/recent' | 'kpis/energy/daily' | 'kpis/energy/monthly' | 'kpis/energy/compare';

export const FRONTEND_API_SUBJECTS: readonly ApiSubject[] = [
  'subjects',
  'regions',
  'agencies',
  'sensor-data',
  'ai-detector/demo',
  'ai-detector/daily',
  'ai-detector/monthly',
  'alerts/recent',
  'kpis/energy/daily',
  'kpis/energy/monthly',
  'kpis/energy/compare'
];

export interface Region {
  id: number;
  name: string;
}

export interface Agency {
  id: number;
  name: string;
  region: number;
  address?: string;
  phone?: string;
  email?: string;
  latitude?: string | number;
  longitude?: string | number;
  agency_type?: string;
}

export interface SensorData {
  id: number;
  agency: number;
  temperature: string;
  clients_count: number;
  energy_usage: string;
  ac_mode: 'OFF' | 'ECO' | 'ON';
  timestamp: string;
}

export interface RecentAlert {
  agency_name: string;
  type: 'High temperature' | 'High energy usage' | 'After-hours energy waste';
  alert_key?: 'high_temperature' | 'high_energy_usage' | 'after_hours_energy_waste';
  severity: 'critical' | 'warning';
  message: string;
  timestamp: string;
  temperature?: number;
  energy_usage?: number;
  energy_threshold?: number;
}

export interface DailyEnergyKpi {
  agency: number;
  agency_name: string;
  date: string;
  total_energy: number;
}

export interface MonthlyEnergyKpi {
  agency: number;
  agency_name: string;
  month: string;
  total_energy: number;
  avg_temperature: number;
  avg_clients: number;
  readings_count: number;
}

export interface AgencyMetrics {
  id: number;
  name: string;
  region_name: string;
  total_energy: number;
  average_temperature: number;
  total_clients: number;
  number_of_readings: number;
  average_clients: number;
  average_energy_per_reading: number;
  energy_per_client: number;
  most_used_ac_mode: 'OFF' | 'ECO' | 'ON';
  business_hours_energy: number;
  non_business_hours_energy: number;
  peak_energy_reading: number;
  highest_temperature_reading: number;
  ac_mode_counts: {
    OFF: number;
    ECO: number;
    ON: number;
  };
  ac_mode_distribution: {
    OFF: number;
    ECO: number;
    ON: number;
    ON_percentage: number;
    ECO_percentage: number;
  };
  on_percentage: number;
  eco_percentage: number;
}

export interface ComparisonChartData {
  date: string;
  agency1: {
    name: string;
    energy: number | null;
  };
  agency2: {
    name: string;
    energy: number | null;
  };
}

export interface Insight {
  type: string;
  text: string;
  factor: string;
}

export interface ComparisonCause {
  factor: string;
  severity: 'high' | 'medium' | 'low';
  impact: string;
  message: string;
}

export interface ComparisonResponse {
  agency_1: AgencyMetrics;
  agency_2: AgencyMetrics;
  chart_data: ComparisonChartData[];
  insights: Insight[];
  main_reason: string;
  causes: ComparisonCause[];
  recommendations: string[];
  higher_energy_agency: {
    id: number;
    name: string;
  } | null;
  region: {
    id: number;
    name: string;
  };
}

export interface AiDetectorDemoResponse {
  image_url: string;
  image_path?: string;
  total_clients: number;
  employees_count: number;
  zones: {
    zone_1: number;
    zone_2: number;
    zone_3: number;
    zone_4: number;
  };
  message: string;
}

export interface AiDetectorCrowdedHour {
  timestamp: string;
  total_clients: number;
  crowded_zone: 'zone_1' | 'zone_2' | 'zone_3' | 'zone_4';
}

export interface AiDetectorHourlyImage {
  timestamp: string;
  image_url: string;
  total_clients: number;
  employees_count: number;
  zones: {
    zone_1: number;
    zone_2: number;
    zone_3: number;
    zone_4: number;
  };
}

export interface AiDetectorRecommendation {
  type: 'staffing' | 'ac_control' | 'zone_crowding' | 'energy_optimization';
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface AiDetectorMonthlyResponse {
  agency: number;
  agency_name: string;
  month: string;
  business_days: number;
  total_images_analyzed: number;
  total_clients: number;
  average_clients: number;
  peak_clients: number;
  peak_timestamp: string | null;
  total_employees: number;
  average_employees: number;
  zone_summary: {
    zone_1_avg: number;
    zone_2_avg: number;
    zone_3_avg: number;
    zone_4_avg: number;
  };
  crowded_hours: AiDetectorCrowdedHour[];
  sample_image_url?: string;
  hourly_images: AiDetectorHourlyImage[];
  message: string;
}

export interface AiDetectorDailyResponse {
  agency: number;
  agency_name: string;
  day: string;
  total_images: number;
  total_clients: number;
  average_clients: number;
  peak_clients: number;
  peak_timestamp: string | null;
  total_employees: number;
  average_employees: number;
  zone_summary: {
    zone_1_avg: number;
    zone_2_avg: number;
    zone_3_avg: number;
    zone_4_avg: number;
  };
  recommendations: AiDetectorRecommendation[];
  hourly_images: AiDetectorHourlyImage[];
  message: string;
}

interface BackendSubjectsResponse {
  subjects: string[];
}

export interface SubjectsCompatibilityResult {
  frontendOnly: string[];
  backendOnly: string[];
  isCompatible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private http: HttpClient) {}

  getSubjects(): Observable<BackendSubjectsResponse> {
    return this.http.get<BackendSubjectsResponse>('/api/subjects/');
  }

  getRegions(): Observable<Region[]> {
    return this.http.get<Region[]>('/api/regions/');
  }

  getAgencies(regionId?: number): Observable<Agency[]> {
    let params = new HttpParams();
    if (regionId !== undefined) {
      params = params.set('region', regionId);
    }
    return this.http.get<Agency[]>('/api/agencies/', { params });
  }

  getSensorData(filters?: {
    agency?: number;
    ac_mode?: 'OFF' | 'ECO' | 'ON';
    date_from?: string;
    date_to?: string;
    ordering?: string;
  }): Observable<SensorData[]> {
    let params = new HttpParams();
    if (filters?.agency !== undefined) {
      params = params.set('agency', filters.agency);
    }
    if (filters?.ac_mode !== undefined) {
      params = params.set('ac_mode', filters.ac_mode);
    }
    if (filters?.date_from) {
      params = params.set('date_from', filters.date_from);
    }
    if (filters?.date_to) {
      params = params.set('date_to', filters.date_to);
    }
    if (filters?.ordering) {
      params = params.set('ordering', filters.ordering);
    }
    return this.http.get<SensorData[]>('/api/sensor-data/', { params });
  }

  getRecentAlerts(month?: string, energyThreshold?: number): Observable<RecentAlert[]> {
    let params = new HttpParams();
    if (month) {
      params = params.set('month', month);
    }
    if (energyThreshold !== undefined) {
      params = params.set('energy_threshold', energyThreshold);
    }
    return this.http.get<RecentAlert[]>('/api/alerts/recent/', { params });
  }

  getDailyEnergyKpi(): Observable<DailyEnergyKpi[]> {
    return this.http.get<DailyEnergyKpi[]>('/api/kpis/energy/daily/');
  }

  getMonthlyEnergyKpi(filters?: { month?: string; date_from?: string; date_to?: string }): Observable<MonthlyEnergyKpi[]> {
    let params = new HttpParams();
    if (filters?.month) {
      params = params.set('month', filters.month);
    }
    if (filters?.date_from) {
      params = params.set('date_from', filters.date_from);
    }
    if (filters?.date_to) {
      params = params.set('date_to', filters.date_to);
    }
    return this.http.get<MonthlyEnergyKpi[]>('/api/kpis/energy/monthly/', { params });
  }

  compareAgencies(agency1Id: number, agency2Id: number, filters?: { month?: string; date_from?: string; date_to?: string }): Observable<ComparisonResponse> {
    let params = new HttpParams()
      .set('agency1', agency1Id)
      .set('agency2', agency2Id);
    if (filters?.month) {
      params = params.set('month', filters.month);
    }
    if (filters?.date_from) {
      params = params.set('date_from', filters.date_from);
    }
    if (filters?.date_to) {
      params = params.set('date_to', filters.date_to);
    }
    return this.http.get<ComparisonResponse>('/api/kpis/energy/compare/', { params });
  }

  getAiDetectorDemo(): Observable<AiDetectorDemoResponse> {
    return this.http.get<AiDetectorDemoResponse>('/api/ai-detector/demo/');
  }

  getAiDetectorDaily(agencyId: number, day: string): Observable<AiDetectorDailyResponse> {
    const params = new HttpParams()
      .set('agency', agencyId)
      .set('day', day);
    return this.http.get<AiDetectorDailyResponse>('/api/ai-detector/daily/', { params });
  }

  getAiDetectorMonthly(agencyId: number, month: string): Observable<AiDetectorMonthlyResponse> {
    const params = new HttpParams()
      .set('agency', agencyId)
      .set('month', month);
    return this.http.get<AiDetectorMonthlyResponse>('/api/ai-detector/monthly/', { params });
  }

  checkSubjectsCompatibility(): Observable<SubjectsCompatibilityResult> {
    return this.getSubjects().pipe(
      map((res) => {
        const backendSubjects = new Set(res.subjects);
        const frontendSubjects = new Set(FRONTEND_API_SUBJECTS);
        const frontendOnly = [...frontendSubjects].filter((subject) => !backendSubjects.has(subject));
        const backendOnly = [...backendSubjects].filter((subject) => !frontendSubjects.has(subject as ApiSubject));
        return {
          frontendOnly,
          backendOnly,
          isCompatible: frontendOnly.length === 0 && backendOnly.length === 0
        };
      })
    );
  }
}
