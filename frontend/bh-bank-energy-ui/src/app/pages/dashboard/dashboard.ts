import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService, DailyEnergyKpi } from '../../services/api.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  kpiStatus = 'Loading daily KPI...';
  compatibilityStatus = 'Checking backend/frontend subjects compatibility...';
  dailyKpiRows: DailyEnergyKpi[] = [];

  dashboardMetrics = {
    total_agencies: 0,
    active_sensors: 0,
    average_temperature: 'N/A',
    energy_status: 'N/A'
  };

  constructor(private router: Router, private api: ApiService) {}

  ngOnInit(): void {
    forkJoin({
      agencies: this.api.getAgencies(),
      sensorData: this.api.getSensorData(),
      dailyKpi: this.api.getDailyEnergyKpi()
    }).subscribe({
      next: ({ agencies, sensorData, dailyKpi }) => {
        this.dailyKpiRows = dailyKpi;

        this.dashboardMetrics.total_agencies = agencies.length;
        this.dashboardMetrics.active_sensors = sensorData.length;

        if (sensorData.length > 0) {
          const totalTemp = sensorData.reduce((sum, item) => sum + Number(item.temperature), 0);
          const avgTemp = totalTemp / sensorData.length;
          this.dashboardMetrics.average_temperature = `${avgTemp.toFixed(1)}°C`;
        } else {
          this.dashboardMetrics.average_temperature = 'N/A';
        }

        if (this.dailyKpiRows.length === 0) {
          this.dashboardMetrics.energy_status = 'No data';
        } else {
          const totalEnergy = this.dailyKpiRows.reduce((sum, item) => sum + Number(item.total_energy), 0);
          this.dashboardMetrics.energy_status = totalEnergy > 0 ? 'Tracked' : 'Idle';
        }

        this.kpiStatus = `Dashboard loaded from backend (${this.dailyKpiRows.length} KPI rows).`;
      },
      error: (err) => {
        this.kpiStatus = `Dashboard backend load failed: ${String(err?.message ?? err)}`;
        console.error('Dashboard backend load error', err);
      }
    });

    this.api.checkSubjectsCompatibility().subscribe({
      next: (result) => {
        if (result.isCompatible) {
          this.compatibilityStatus = 'Subjects compatibility: OK (backend/frontend are 100% aligned).';
          return;
        }

        const parts: string[] = [];
        if (result.frontendOnly.length > 0) {
          parts.push(`frontend only: ${result.frontendOnly.join(', ')}`);
        }
        if (result.backendOnly.length > 0) {
          parts.push(`backend only: ${result.backendOnly.join(', ')}`);
        }
        this.compatibilityStatus = `Subjects compatibility mismatch (${parts.join(' | ')}).`;
      },
      error: (err) => {
        this.compatibilityStatus = `Subjects compatibility check failed: ${String(err?.message ?? err)}`;
        console.error('Subjects compatibility check error', err);
      }
    });
  }

  logout(): void {
    this.router.navigate(['/login']);
  }
}