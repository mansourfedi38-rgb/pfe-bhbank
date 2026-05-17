import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from '../../components/navbar/navbar';
import { forkJoin } from 'rxjs';
import Chart from 'chart.js/auto';
import { ApiService, DailyEnergyKpi, MonthlyEnergyKpi } from '../../services/api.service';

type EnergyRange = 'month' | 'quarter' | 'year';
type TrendPoint = { label: string; total: number };

const ONE_MONTH_VALUE = '2026-04';
const THREE_MONTH_VALUES = ['2026-01', '2026-02', '2026-03'];
const FULL_YEAR_VALUE = '2025';

@Component({
  selector: 'app-energy-usage',
  standalone: true,
  imports: [NgIf, NgFor, TranslateModule, NavbarComponent],
  templateUrl: './energy-usage.html',
  styleUrl: './energy-usage.scss'
})
export class EnergyUsageComponent implements OnInit {
  backendStatus = '';
  isLoading = true;
  hasError = false;
  selectedRange: EnergyRange = 'month';
  monthlyRows: MonthlyEnergyKpi[] = [];
  dailyRows: DailyEnergyKpi[] = [];
  filteredRows: MonthlyEnergyKpi[] = [];
  monthTotals: { month: string; total: number }[] = [];
  trendPoints: TrendPoint[] = [];
  agencyTotals: { agency: string; total: number }[] = [];

  cards = {
    totalEnergy: '',
    averageEnergyPerMonth: '',
    peakMonth: '',
    peakDay: '',
    selectedPeriod: '',
    peakAgency: ''
  };

  private trendChart: Chart | null = null;

  constructor(
    private api: ApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    forkJoin({
      monthlyRows: this.api.getMonthlyEnergyKpi(),
      dailyRows: this.api.getDailyEnergyKpi()
    }).subscribe({
      next: ({ monthlyRows, dailyRows }) => {
        this.monthlyRows = monthlyRows;
        this.dailyRows = dailyRows;
        this.isLoading = false;
        this.hasError = false;
        this.applyRange('month');
      },
      error: (err) => {
        this.isLoading = false;
        this.hasError = true;
        this.backendStatus = this.translate.instant('energyUsage.status.failed', {
          error: String(err?.message ?? err)
        });
        this.cdr.detectChanges();
      }
    });
  }

  applyRange(range: EnergyRange): void {
    this.selectedRange = range;
    const months = Array.from(new Set(this.monthlyRows.map((row) => row.month))).sort();
    const selectedMonths =
      range === 'month'
        ? [ONE_MONTH_VALUE]
        : range === 'quarter'
          ? THREE_MONTH_VALUES
          : months.filter((month) => month.startsWith(FULL_YEAR_VALUE));

    this.filteredRows = this.monthlyRows.filter((row) => selectedMonths.includes(row.month));
    this.recalculateSummaries();
    this.createTrendChart();
  }

  private recalculateSummaries(): void {
    if (this.filteredRows.length === 0) {
      this.backendStatus = this.translate.instant('energyUsage.status.noData');
      this.setCardsNotAvailable();
      return;
    }

    const totalEnergy = this.filteredRows.reduce((sum, row) => sum + Number(row.total_energy), 0);
    const monthMap = new Map<string, number>();
    const agencyMap = new Map<string, number>();

    this.filteredRows.forEach((row) => {
      monthMap.set(row.month, (monthMap.get(row.month) || 0) + Number(row.total_energy));
      agencyMap.set(row.agency_name, (agencyMap.get(row.agency_name) || 0) + Number(row.total_energy));
    });

    this.monthTotals = Array.from(monthMap.entries()).map(([month, total]) => ({ month, total }));
    this.agencyTotals = Array.from(agencyMap.entries())
      .map(([agency, total]) => ({ agency, total }))
      .sort((a, b) => b.total - a.total);

    const peakMonth = [...this.monthTotals].sort((a, b) => b.total - a.total)[0];
    const peakAgency = this.agencyTotals[0];

    this.trendPoints = this.selectedRange === 'month'
      ? this.buildDailyTrend()
      : this.selectedRange === 'quarter'
        ? this.buildWeeklyTrend()
      : this.monthTotals.map((row) => ({ label: row.month, total: row.total }));

    this.cards.totalEnergy = `${totalEnergy.toFixed(2)} kWh`;
    this.cards.averageEnergyPerMonth = this.selectedRange === 'month'
      ? `${(totalEnergy / this.daysInMonth(ONE_MONTH_VALUE)).toFixed(2)} kWh`
      : this.selectedRange === 'quarter'
        ? `${(totalEnergy / Math.max(this.trendPoints.length, 1)).toFixed(2)} kWh`
      : `${(totalEnergy / this.monthTotals.length).toFixed(2)} kWh`;
    this.cards.peakMonth = this.selectedRange === 'month'
      ? this.formatMonth(ONE_MONTH_VALUE)
      : (peakMonth?.month ?? this.notAvailable());
    this.cards.peakDay = this.selectedRange === 'month'
      ? this.peakDayLabel()
      : this.notAvailable();
    this.cards.selectedPeriod = this.selectedPeriodLabel();
    this.cards.peakAgency = peakAgency?.agency ?? this.notAvailable();
    this.backendStatus = this.translate.instant('energyUsage.status.loaded', {
      count: this.filteredRows.length
    });
    this.cdr.detectChanges();
  }

  private createTrendChart(): void {
    setTimeout(() => {
      if (this.trendChart) {
        this.trendChart.destroy();
      }

      const ctx = document.getElementById('energyTrendChart') as HTMLCanvasElement;
      if (!ctx || this.trendPoints.length === 0) return;

      this.trendChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.trendPoints.map((row) => row.label),
          datasets: [{
            label: `${this.trendChartTitle()} (kWh)`,
            data: this.trendPoints.map((row) => row.total),
            borderColor: 'rgba(8, 38, 77, 1)',
            backgroundColor: 'rgba(8, 38, 77, 0.12)',
            fill: true,
            tension: 0.35
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: this.chartTextColor() },
              grid: { color: this.chartGridColor() },
              title: {
                display: true,
                text: this.translate.instant('energyUsage.totalEnergy') + ' (kWh)',
                color: this.chartTextColor()
              }
            },
            x: {
              ticks: { color: this.chartTextColor() },
              grid: { color: this.chartGridColor() }
            }
          }
        }
      });
    }, 100);
  }

  private setLoadingState(): void {
    this.isLoading = true;
    this.hasError = false;
    this.backendStatus = this.translate.instant('energyUsage.status.loading');
    this.setCardsNotAvailable();
  }

  trendChartTitle(): string {
    if (this.selectedRange === 'month') {
      return this.translate.instant('energyUsage.energyTrendByDay');
    }
    if (this.selectedRange === 'quarter') {
      return this.translate.instant('energyUsage.energyTrendByWeek');
    }
    return this.translate.instant('energyUsage.energyTrendByMonth');
  }

  averageEnergyLabel(): string {
    if (this.selectedRange === 'month') {
      return this.translate.instant('energyUsage.averageEnergyPerDay');
    }
    if (this.selectedRange === 'quarter') {
      return this.translate.instant('energyUsage.averageEnergyPerWeek');
    }
    return this.translate.instant('energyUsage.averageEnergyPerMonth');
  }

  private buildDailyTrend(): TrendPoint[] {
    const dayMap = new Map<string, number>();

    this.dailyRows
      .filter((row) => row.date.startsWith(ONE_MONTH_VALUE))
      .forEach((row) => {
        dayMap.set(row.date, (dayMap.get(row.date) || 0) + Number(row.total_energy));
      });

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ label: this.formatDay(date), total }));
  }

  private buildWeeklyTrend(): TrendPoint[] {
    const weekMap = new Map<string, { start: Date; total: number }>();

    this.dailyRows
      .filter((row) => THREE_MONTH_VALUES.some((month) => row.date.startsWith(month)))
      .forEach((row) => {
        const start = this.weekStart(row.date);
        const key = start.toISOString().slice(0, 10);
        const current = weekMap.get(key) || { start, total: 0 };
        current.total += Number(row.total_energy);
        weekMap.set(key, current);
      });

    return Array.from(weekMap.values())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((row) => ({
        label: this.weekLabel(row.start),
        total: row.total
      }));
  }

  private peakDayLabel(): string {
    const peakDay = [...this.trendPoints].sort((a, b) => b.total - a.total)[0];
    return peakDay?.label ?? this.notAvailable();
  }

  private selectedPeriodLabel(): string {
    if (this.selectedRange === 'month') {
      return this.formatMonth(ONE_MONTH_VALUE);
    }
    if (this.selectedRange === 'quarter') {
      return `${this.formatMonth(THREE_MONTH_VALUES[0])} - ${this.formatMonth(THREE_MONTH_VALUES[2])}`;
    }
    return FULL_YEAR_VALUE;
  }

  private daysInMonth(month: string): number {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber, 0).getDate();
  }

  private formatMonth(month: string): string {
    const [year, monthNumber] = month.split('-');
    return `${monthNumber}/${year}`;
  }

  private formatDay(date: string): string {
    const [, month, day] = date.split('-');
    return `${day}/${month}`;
  }

  private weekStart(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day));
    const weekday = start.getUTCDay() || 7;
    start.setUTCDate(start.getUTCDate() - weekday + 1);
    return start;
  }

  private weekLabel(start: Date): string {
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return `${this.formatDate(start)} - ${this.formatDate(end)}`;
  }

  private formatDate(value: Date): string {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  }

  private isDarkTheme(): boolean {
    return typeof document !== 'undefined' && document.body.classList.contains('theme-dark');
  }

  private chartTextColor(): string {
    return this.isDarkTheme() ? '#f8fafc' : '#555555';
  }

  private chartGridColor(): string {
    return this.isDarkTheme() ? 'rgba(219, 231, 245, 0.24)' : 'rgba(0, 0, 0, 0.1)';
  }

  private setCardsNotAvailable(): void {
    this.cards.totalEnergy = this.notAvailable();
    this.cards.averageEnergyPerMonth = this.notAvailable();
    this.cards.peakMonth = this.notAvailable();
    this.cards.peakDay = this.notAvailable();
    this.cards.selectedPeriod = this.notAvailable();
    this.cards.peakAgency = this.notAvailable();
  }

  private notAvailable(): string {
    return this.translate.instant('common.notAvailable');
  }
}
