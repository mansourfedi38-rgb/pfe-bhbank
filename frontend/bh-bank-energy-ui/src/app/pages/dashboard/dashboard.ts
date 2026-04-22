import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
  kpiStatus = '';
  compatibilityStatus = '';
  dailyKpiRows: DailyEnergyKpi[] = [];

  dashboardMetrics = {
    total_agencies: 0,
    active_sensors: 0,
    average_temperature: 'N/A',
    energy_status: 'N/A'
  };

  constructor(
    private router: Router,
    private api: ApiService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.translate.onLangChange.subscribe(() => this.setLoadingState());

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
          this.dashboardMetrics.average_temperature = this.translate.instant('common.notAvailable');
        }

        if (this.dailyKpiRows.length === 0) {
          this.dashboardMetrics.energy_status = this.translate.instant('common.noData');
        } else {
          const totalEnergy = this.dailyKpiRows.reduce((sum, item) => sum + Number(item.total_energy), 0);
          this.dashboardMetrics.energy_status = totalEnergy > 0
            ? this.translate.instant('dashboard.status.tracked')
            : this.translate.instant('dashboard.status.idle');
        }

        this.kpiStatus = this.translate.instant('dashboard.status.loaded', {
          count: this.dailyKpiRows.length
        });
      },
      error: (err) => {
        this.kpiStatus = this.translate.instant('dashboard.status.failed', {
          error: String(err?.message ?? err)
        });
        console.error('Dashboard backend load error', err);
      }
    });

    this.api.checkSubjectsCompatibility().subscribe({
      next: (result) => {
        if (result.isCompatible) {
          this.compatibilityStatus = this.translate.instant('dashboard.compatibility.ok');
          return;
        }

        const parts: string[] = [];
        if (result.frontendOnly.length > 0) {
          parts.push(this.translate.instant('dashboard.compatibility.frontendOnly', {
            values: result.frontendOnly.join(', ')
          }));
        }
        if (result.backendOnly.length > 0) {
          parts.push(this.translate.instant('dashboard.compatibility.backendOnly', {
            values: result.backendOnly.join(', ')
          }));
        }
        this.compatibilityStatus = this.translate.instant('dashboard.compatibility.mismatch', {
          details: parts.join(' | ')
        });
      },
      error: (err) => {
        this.compatibilityStatus = this.translate.instant('dashboard.compatibility.failed', {
          error: String(err?.message ?? err)
        });
        console.error('Subjects compatibility check error', err);
      }
    });
  }

  logout(): void {
    this.router.navigate(['/login']);
  }

  private setLoadingState(): void {
    this.kpiStatus = this.translate.instant('dashboard.status.loading');
    this.compatibilityStatus = this.translate.instant('dashboard.compatibility.checking');
    this.dashboardMetrics.average_temperature = this.translate.instant('common.notAvailable');
    this.dashboardMetrics.energy_status = this.translate.instant('common.notAvailable');
  }
}