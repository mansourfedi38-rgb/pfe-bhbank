import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../../components/language-switcher/language-switcher';
import { forkJoin } from 'rxjs';
import Chart from 'chart.js/auto';
import { ApiService, MonthlyEnergyKpi, RecentAlert, SensorData } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, RouterLink, RouterLinkActive, TranslateModule, LanguageSwitcherComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  kpiStatus = '';
  monthlyRows: MonthlyEnergyKpi[] = [];
  recentAlerts: RecentAlert[] = [];
  selectedMonth = '';
  selectedAlertMonth = '';
  availableMonths: string[] = [];
  latestReadingTime = '';

  dashboardMetrics = {
    totalEnergyThisMonth: '',
    averageTemperatureThisMonth: '',
    peakAgencyThisMonth: '',
    latestReadingTime: '',
    activeAlerts: ''
  };

  private agencyChart: Chart | null = null;

  chartsLoading = true;
  chartsEmpty = false;
  chartError: string | null = null;

  constructor(
    private api: ApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.loadDashboardData();

    this.translate.onLangChange.subscribe(() => {
      this.updateSelectedMonthSummary();
    });
  }

  logout(): void {
    this.auth.logout();
  }

  onMonthChange(): void {
    this.updateSelectedMonthSummary();
    this.createMonthlyAgencyChart();
  }

  onAlertMonthChange(): void {
    this.loadRecentAlerts();
  }

  formatAlertTimestamp(value: string): string {
    return new Date(value).toLocaleString();
  }

  private loadDashboardData(): void {
    forkJoin({
      monthlyKpi: this.api.getMonthlyEnergyKpi(),
      latestReadings: this.api.getSensorData({ ordering: '-timestamp' })
    }).subscribe({
      next: ({ monthlyKpi, latestReadings }) => {
        this.monthlyRows = monthlyKpi;
        this.availableMonths = Array.from(new Set(monthlyKpi.map((row) => row.month))).sort();
        this.selectedMonth = this.availableMonths[this.availableMonths.length - 1] || '';
        this.selectedAlertMonth = this.selectedMonth;
        this.latestReadingTime = this.formatLatestReading(latestReadings[0]);

        this.kpiStatus = this.translate.instant('dashboard.status.loadedMonthly', { count: monthlyKpi.length });
        this.updateSelectedMonthSummary();
        this.createMonthlyAgencyChart();
        this.loadRecentAlerts();
      },
      error: (err) => {
        this.kpiStatus = this.translate.instant('dashboard.status.failed', { error: String(err?.message ?? err) });
        this.chartsLoading = false;
        this.chartError = err?.message || this.translate.instant('dashboard.status.failed', { error: '' });
        this.loadRecentAlerts();
        this.cdr.detectChanges();
      }
    });

  }

  private loadRecentAlerts(): void {
    this.api.getRecentAlerts(this.selectedAlertMonth).subscribe({
      next: (alerts) => {
        this.recentAlerts = alerts.slice(0, 5);
        this.dashboardMetrics.activeAlerts = String(this.recentAlerts.length);
        this.cdr.detectChanges();
      },
      error: () => {
        this.recentAlerts = [];
        this.dashboardMetrics.activeAlerts = this.notAvailable();
        this.cdr.detectChanges();
      }
    });
  }

  private updateSelectedMonthSummary(): void {
    const rows = this.getSelectedMonthRows();

    if (rows.length === 0) {
      this.dashboardMetrics.totalEnergyThisMonth = this.notAvailable();
      this.dashboardMetrics.averageTemperatureThisMonth = this.notAvailable();
      this.dashboardMetrics.peakAgencyThisMonth = this.notAvailable();
      this.dashboardMetrics.latestReadingTime = this.latestReadingTime;
      this.chartsEmpty = true;
      this.cdr.detectChanges();
      return;
    }

    const totalEnergy = rows.reduce((sum, row) => sum + Number(row.total_energy), 0);
    const avgTemperature =
      rows.reduce((sum, row) => sum + Number(row.avg_temperature), 0) / rows.length;
    const peakAgency = [...rows].sort((a, b) => Number(b.total_energy) - Number(a.total_energy))[0];

    this.dashboardMetrics.totalEnergyThisMonth = `${totalEnergy.toFixed(2)} kWh`;
    this.dashboardMetrics.averageTemperatureThisMonth = `${avgTemperature.toFixed(1)}°C`;
    this.dashboardMetrics.peakAgencyThisMonth = peakAgency?.agency_name ?? this.notAvailable();
    this.dashboardMetrics.latestReadingTime = this.latestReadingTime;
    this.chartsEmpty = false;
    this.cdr.detectChanges();
  }

  private createMonthlyAgencyChart(): void {
    this.chartsLoading = false;
    const rows = this.getSelectedMonthRows();

    if (rows.length === 0) {
      this.chartsEmpty = true;
      this.cdr.detectChanges();
      return;
    }

    setTimeout(() => {
      if (this.agencyChart) {
        this.agencyChart.destroy();
      }

      const ctx = document.getElementById('agencyChart') as HTMLCanvasElement;
      if (!ctx) return;

      this.agencyChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: rows.map((row) => row.agency_name),
          datasets: [{
            label: `${this.translate.instant('dashboard.monthlyEnergyByAgency')} (${this.selectedMonth})`,
            data: rows.map((row) => Number(row.total_energy)),
            backgroundColor: 'rgba(220, 53, 69, 0.72)',
            borderColor: 'rgba(220, 53, 69, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top' }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: this.translate.instant('energyUsage.totalEnergy') + ' (kWh)' }
            },
            x: {
              title: { display: true, text: this.translate.instant('sensors.agency') }
            }
          }
        }
      });

      this.cdr.detectChanges();
    }, 100);
  }

  private getSelectedMonthRows(): MonthlyEnergyKpi[] {
    return this.monthlyRows.filter((row) => row.month === this.selectedMonth);
  }

  private formatLatestReading(row?: SensorData): string {
    if (!row) return this.notAvailable();
    return new Date(row.timestamp).toLocaleString();
  }

  private setLoadingState(): void {
    this.kpiStatus = this.translate.instant('dashboard.status.loadingMonthly');
    this.chartsLoading = true;
    this.chartsEmpty = false;
    this.chartError = null;
    this.latestReadingTime = this.notAvailable();
    this.dashboardMetrics.totalEnergyThisMonth = this.notAvailable();
    this.dashboardMetrics.averageTemperatureThisMonth = this.notAvailable();
    this.dashboardMetrics.peakAgencyThisMonth = this.notAvailable();
    this.dashboardMetrics.latestReadingTime = this.notAvailable();
    this.dashboardMetrics.activeAlerts = this.notAvailable();
  }

  private notAvailable(): string {
    return this.translate.instant('common.notAvailable');
  }
}
