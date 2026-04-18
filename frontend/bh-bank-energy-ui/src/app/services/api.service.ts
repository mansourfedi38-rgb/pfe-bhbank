import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export type ApiSubject = 'subjects' | 'regions' | 'agencies' | 'sensor-data' | 'kpis/energy/daily' | 'kpis/energy/compare';

export const FRONTEND_API_SUBJECTS: readonly ApiSubject[] = [
  'subjects',
  'regions',
  'agencies',
  'sensor-data',
  'kpis/energy/daily',
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

export interface DailyEnergyKpi {
  agency: number;
  agency_name: string;
  date: string;
  total_energy: number;
}

export interface AgencyMetrics {
  id: number;
  name: string;
  region_name: string;
  total_energy: number;
  average_temperature: number;
  total_clients: number;
  average_clients: number;
  energy_per_client: number;
  ac_mode_counts: {
    OFF: number;
    ECO: number;
    ON: number;
  };
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

export interface ComparisonResponse {
  agency_1: AgencyMetrics;
  agency_2: AgencyMetrics;
  chart_data: ComparisonChartData[];
  insights: Insight[];
  region: {
    id: number;
    name: string;
  };
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

  getSensorData(filters?: { agency?: number; ac_mode?: 'OFF' | 'ECO' | 'ON' }): Observable<SensorData[]> {
    let params = new HttpParams();
    if (filters?.agency !== undefined) {
      params = params.set('agency', filters.agency);
    }
    if (filters?.ac_mode !== undefined) {
      params = params.set('ac_mode', filters.ac_mode);
    }
    return this.http.get<SensorData[]>('/api/sensor-data/', { params });
  }

  getDailyEnergyKpi(): Observable<DailyEnergyKpi[]> {
    return this.http.get<DailyEnergyKpi[]>('/api/kpis/energy/daily/');
  }

  compareAgencies(agency1Id: number, agency2Id: number): Observable<ComparisonResponse> {
    const params = new HttpParams()
      .set('agency1', agency1Id)
      .set('agency2', agency2Id);
    return this.http.get<ComparisonResponse>('/api/kpis/energy/compare/', { params });
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