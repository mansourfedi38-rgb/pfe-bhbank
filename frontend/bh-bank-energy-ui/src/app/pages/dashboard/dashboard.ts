import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from '../../components/navbar/navbar';
import { forkJoin } from 'rxjs';
import { Subscription } from 'rxjs';
import Chart from 'chart.js/auto';
import { ApiService, MonthlyEnergyKpi, RecentAlert, SensorData } from '../../services/api.service';
import { AutoRefreshService } from '../../services/auto-refresh.service';
import { EnergyAlertThresholdService } from '../../services/energy-alert-threshold.service';
import { NotificationPreferencesService } from '../../services/notification-preferences.service';
import { TemperatureUnitService } from '../../services/temperature-unit.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule, NavbarComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  kpiStatus = '';
  monthlyRows: MonthlyEnergyKpi[] = [];
  private allRecentAlerts: RecentAlert[] = [];
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
  private readonly subscriptions = new Subscription();
  private refreshInterval: any;
  private latestAlertSignature = '';

  chartsLoading = true;
  chartsEmpty = false;
  chartError: string | null = null;

  constructor(
    private api: ApiService,
    private autoRefresh: AutoRefreshService,
    private translate: TranslateService,
    private energyAlertThreshold: EnergyAlertThresholdService,
    private notificationPreferences: NotificationPreferencesService,
    private temperatureUnit: TemperatureUnitService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.loadDashboardData();
    this.configureAutoRefresh(this.autoRefresh.intervalMs);

    this.subscriptions.add(this.translate.onLangChange.subscribe(() => {
      this.updateSelectedMonthSummary();
    }));

    this.subscriptions.add(this.temperatureUnit.unit$.subscribe(() => {
      this.updateSelectedMonthSummary();
    }));

    this.subscriptions.add(this.energyAlertThreshold.threshold$.subscribe(() => {
      this.loadRecentAlerts();
    }));

    this.subscriptions.add(this.autoRefresh.interval$.subscribe((interval) => {
      this.configureAutoRefresh(this.autoRefresh.toMilliseconds(interval));
    }));

    this.subscriptions.add(this.notificationPreferences.notifications$.subscribe(() => {
      this.applyNotificationVisibility();
    }));

    this.subscriptions.add(this.notificationPreferences.sound$.subscribe(() => {
      this.latestAlertSignature = '';
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  onMonthChange(): void {
    this.updateSelectedMonthSummary();
    this.createMonthlyAgencyChart();
  }

  onAlertMonthChange(): void {
    this.loadRecentAlerts();
  }

  refreshNow(): void {
    this.setLoadingState();
    this.loadDashboardData();
  }

  formatAlertTimestamp(value: string): string {
    return new Date(value).toLocaleString();
  }

  formatAlertMessage(message: string): string {
    return message.replace(/(-?\d+(?:\.\d+)?)\s*°C/g, (_match, value) => this.temperatureUnit.format(value));
  }

  areNotificationMessagesEnabled(): boolean {
    return this.notificationPreferences.notifications === 'enabled';
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
    this.api.getRecentAlerts(this.selectedAlertMonth, this.energyAlertThreshold.threshold).subscribe({
      next: (alerts) => {
        this.allRecentAlerts = alerts.slice(0, 5);
        this.playSoundForNewAlerts(this.allRecentAlerts);
        this.applyNotificationVisibility();
        this.cdr.detectChanges();
      },
      error: () => {
        this.allRecentAlerts = [];
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
    this.dashboardMetrics.averageTemperatureThisMonth = this.temperatureUnit.format(avgTemperature);
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

  private applyNotificationVisibility(): void {
    if (this.notificationPreferences.notifications === 'enabled') {
      this.recentAlerts = this.allRecentAlerts;
      this.dashboardMetrics.activeAlerts = String(this.recentAlerts.length);
    } else {
      this.recentAlerts = [];
      this.dashboardMetrics.activeAlerts = '0';
    }

    this.cdr.detectChanges();
  }

  private playSoundForNewAlerts(alerts: RecentAlert[]): void {
    if (alerts.length === 0) {
      this.latestAlertSignature = '';
      return;
    }

    const signature = alerts
      .map((alert) => `${alert.type}-${alert.agency_name}-${alert.timestamp}`)
      .join('|');

    if (signature !== this.latestAlertSignature) {
      this.latestAlertSignature = signature;
      this.notificationPreferences.playAlertSound();
    }
  }

  private configureAutoRefresh(intervalMs: number | null): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (intervalMs !== null) {
      this.refreshInterval = setInterval(() => this.loadDashboardData(), intervalMs);
    }
  }
}
