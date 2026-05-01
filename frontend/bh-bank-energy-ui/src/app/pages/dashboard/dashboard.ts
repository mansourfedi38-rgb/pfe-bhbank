import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService, DailyEnergyKpi } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin } from 'rxjs';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit {
  kpiStatus = '';
  compatibilityStatus = '';
  dailyKpiRows: DailyEnergyKpi[] = [];

  dashboardMetrics = {
    total_agencies: 0,
    active_sensors: 0,
    average_temperature: 'N/A',
    energy_status: 'N/A'
  };

  // Chart instances
  private agencyChart: Chart | null = null;
  private timeChart: Chart | null = null;

  chartsLoading = true;
  chartsEmpty = false;
  chartError: string | null = null;

  constructor(
    private router: Router,
    private api: ApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    
    // Handle language changes WITHOUT resetting chart states
    this.translate.onLangChange.subscribe(() => {
      this.kpiStatus = this.translate.instant('dashboard.status.loading');
      this.compatibilityStatus = this.translate.instant('dashboard.compatibility.checking');
      this.dashboardMetrics.average_temperature = this.translate.instant('common.notAvailable');
      this.dashboardMetrics.energy_status = this.translate.instant('common.notAvailable');
      
      // Recreate charts if data already exists
      if (this.dailyKpiRows.length > 0) {
        this.createCharts();
      }
    });

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

        // Create charts
        this.createCharts();
      },
      error: (err) => {
        console.error('Dashboard backend load error', err);
        this.kpiStatus = this.translate.instant('dashboard.status.failed', {
          error: String(err?.message ?? err)
        });
        this.chartsLoading = false;
        this.chartsEmpty = false;
        this.chartError = err?.message || 'Failed to load chart data';
        this.cdr.detectChanges();
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

  ngAfterViewInit(): void {
    // Charts will be created after data is loaded
  }

  logout(): void {
    this.auth.logout();
  }

  private createCharts(): void {
    this.chartsLoading = false;
    this.cdr.detectChanges();

    if (!this.dailyKpiRows || this.dailyKpiRows.length === 0) {
      this.chartsEmpty = true;
      this.cdr.detectChanges();
      return;
    }

    this.chartsEmpty = false;

    // Process data for Chart 1: Energy by Agency
    const agencyEnergyMap = new Map<string, number>();
    this.dailyKpiRows.forEach(row => {
      const current = agencyEnergyMap.get(row.agency_name) || 0;
      agencyEnergyMap.set(row.agency_name, current + Number(row.total_energy));
    });

    const agencyLabels = Array.from(agencyEnergyMap.keys());
    const agencyValues = Array.from(agencyEnergyMap.values());

    // Process data for Chart 2: Energy Over Time
    const dateEnergyMap = new Map<string, number>();
    this.dailyKpiRows.forEach(row => {
      const current = dateEnergyMap.get(row.date) || 0;
      dateEnergyMap.set(row.date, current + Number(row.total_energy));
    });

    const sortedDates = Array.from(dateEnergyMap.keys()).sort();
    const dateValues = sortedDates.map(date => dateEnergyMap.get(date) || 0);

    // Wait for DOM to update, then create charts
    setTimeout(() => {
      // Destroy existing charts if they exist
      if (this.agencyChart) {
        this.agencyChart.destroy();
      }
      if (this.timeChart) {
        this.timeChart.destroy();
      }

      // Create Agency Chart (Bar)
      const ctx1 = document.getElementById('agencyChart') as HTMLCanvasElement;
      if (ctx1) {
        this.agencyChart = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels: agencyLabels,
            datasets: [{
              label: 'Total Energy (kWh)',
              data: agencyValues,
              backgroundColor: 'rgba(220, 53, 69, 0.7)',
              borderColor: 'rgba(220, 53, 69, 1)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'top'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Energy (kWh)'
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Agency'
                }
              }
            }
          }
        });
      }

      // Create Time Chart (Line)
      const ctx2 = document.getElementById('timeChart') as HTMLCanvasElement;
      if (ctx2) {
        this.timeChart = new Chart(ctx2, {
          type: 'line',
          data: {
            labels: sortedDates,
            datasets: [{
              label: 'Daily Energy Consumption',
              data: dateValues,
              borderColor: 'rgba(0, 123, 255, 1)',
              backgroundColor: 'rgba(0, 123, 255, 0.1)',
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'top'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Energy (kWh)'
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Date'
                }
              }
            }
          }
        });
      }

      this.cdr.detectChanges();
    }, 200);
  }

  private setLoadingState(): void {
    this.kpiStatus = this.translate.instant('dashboard.status.loading');
    this.compatibilityStatus = this.translate.instant('dashboard.compatibility.checking');
    this.dashboardMetrics.average_temperature = this.translate.instant('common.notAvailable');
    this.dashboardMetrics.energy_status = this.translate.instant('common.notAvailable');
    this.chartsLoading = true;
    this.chartsEmpty = false;
    this.chartError = null;
  }
}