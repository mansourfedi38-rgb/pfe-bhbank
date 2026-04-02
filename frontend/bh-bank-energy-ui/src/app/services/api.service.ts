import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private http: HttpClient) {}

  getDailyEnergyKpi(): Observable<unknown> {
    // Note: with Angular dev proxy, this will be forwarded to the Django backend at /api/...
    return this.http.get('/api/kpis/energy/daily/');
  }
}

