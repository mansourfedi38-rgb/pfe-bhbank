import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from '../../components/navbar/navbar';
import { forkJoin } from 'rxjs';
import Chart from 'chart.js/auto';
import { ApiService, DailyEnergyKpi, MonthlyEnergyKpi } from '../../services/api.service';

type EnergyRange = 'month' | 'quarter' | 'year';
type ChartMetric = 'energy' | 'clients';
type TrendPoint = { label: string; total: number };
type AgencyTrendPanel = { agency: string; labels: string[]; data: number[]; color: string; backgroundColor: string };

const ONE_MONTH_FALLBACK_VALUE = '2025-07';
const THREE_MONTH_VALUES = ['2025-06', '2025-07', '2025-08'];
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
  selectedChartMetric: ChartMetric = 'energy';
  selectedAgencyFilter = '';
  monthlyRows: MonthlyEnergyKpi[] = [];
  dailyRows: DailyEnergyKpi[] = [];
  filteredRows: MonthlyEnergyKpi[] = [];
  monthTotals: { month: string; total: number }[] = [];
  trendPoints: TrendPoint[] = [];
  agencyTrendPanels: AgencyTrendPanel[] = [];
  agencyTotals: { agency: string; total: number }[] = [];
  agencyClientTotals: { agency: string; total: number }[] = [];

  cards = {
    totalEnergy: '',
    averageEnergyPerMonth: '',
    peakMonth: '',
    peakDay: '',
    selectedPeriod: '',
    peakAgency: ''
  };

  private trendCharts: Chart[] = [];

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
        ? [this.oneMonthValue()]
        : range === 'quarter'
          ? THREE_MONTH_VALUES
          : months.filter((month) => month.startsWith(FULL_YEAR_VALUE));

    this.filteredRows = this.monthlyRows.filter((row) => selectedMonths.includes(row.month));
    this.ensureSelectedAgencyFilter();
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
    const agencyClientMap = new Map<string, number>();

    this.filteredRows.forEach((row) => {
      monthMap.set(row.month, (monthMap.get(row.month) || 0) + Number(row.total_energy));
      agencyMap.set(row.agency_name, (agencyMap.get(row.agency_name) || 0) + Number(row.total_energy));
      const totalClients = this.monthlyTotalClients(row);
      agencyClientMap.set(row.agency_name, (agencyClientMap.get(row.agency_name) || 0) + totalClients);
    });

    this.monthTotals = Array.from(monthMap.entries()).map(([month, total]) => ({ month, total }));
    this.agencyTotals = Array.from(agencyMap.entries())
      .map(([agency, total]) => ({ agency, total }))
      .sort((a, b) => b.total - a.total);
    this.agencyClientTotals = Array.from(agencyClientMap.entries())
      .map(([agency, total]) => ({ agency, total }))
      .sort((a, b) => b.total - a.total);

    const peakMonth = [...this.monthTotals].sort((a, b) => b.total - a.total)[0];
    const peakAgency = this.agencyTotals[0];

    this.trendPoints = this.selectedRange === 'month'
      ? this.buildDailyTrend()
      : this.selectedRange === 'quarter'
        ? this.buildWeeklyTrend()
      : this.monthTotals.map((row) => ({ label: row.month, total: row.total }));
    this.buildAgencyTrendPanels();

    this.cards.totalEnergy = `${totalEnergy.toFixed(2)} kWh`;
    this.cards.averageEnergyPerMonth = this.selectedRange === 'month'
      ? `${(totalEnergy / this.daysInMonth(this.oneMonthValue())).toFixed(2)} kWh`
      : this.selectedRange === 'quarter'
        ? `${(totalEnergy / Math.max(this.trendPoints.length, 1)).toFixed(2)} kWh`
      : `${(totalEnergy / this.monthTotals.length).toFixed(2)} kWh`;
    this.cards.peakMonth = this.selectedRange === 'month'
      ? this.formatMonth(this.oneMonthValue())
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
      this.trendCharts.forEach((chart) => chart.destroy());
      this.trendCharts = [];

      this.agencyTrendPanels.forEach((panel, index) => {
        const ctx = document.getElementById(`energyTrendChart-${index}`) as HTMLCanvasElement;
        if (!ctx) return;

        this.trendCharts.push(new Chart(ctx, {
          type: 'line',
          data: {
            labels: panel.labels,
            datasets: [{
              label: this.chartDatasetLabel(panel.agency),
              data: panel.data,
              borderColor: panel.color,
              backgroundColor: panel.backgroundColor,
              fill: true,
              tension: 0.35,
              pointRadius: this.selectedRange === 'year' ? 4 : 2,
              pointHoverRadius: 5,
              borderWidth: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { color: this.chartTextColor() },
                grid: { color: this.chartGridColor() },
                title: {
                  display: true,
                  text: this.chartYAxisTitle(),
                  color: this.chartTextColor()
                }
              },
              x: {
                ticks: { color: this.chartTextColor() },
                grid: { color: this.chartGridColor() }
              }
            }
          }
        }));
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
    if (this.selectedChartMetric === 'clients') {
      if (this.selectedRange === 'month') {
        return this.translate.instant('energyUsage.clientTrendByDay');
      }
      if (this.selectedRange === 'quarter') {
        return this.translate.instant('energyUsage.clientTrendByWeek');
      }
      return this.translate.instant('energyUsage.clientTrendByMonth');
    }

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

  applyChartMetric(metric: ChartMetric): void {
    this.selectedChartMetric = metric;
    this.buildAgencyTrendPanels();
    this.createTrendChart();
  }

  applyAgencyFilter(event: Event): void {
    this.selectedAgencyFilter = (event.target as HTMLSelectElement).value;
    this.buildAgencyTrendPanels();
    this.createTrendChart();
  }

  availableAgencies(): string[] {
    return Array.from(new Set(this.filteredRows.map((row) => row.agency_name))).sort();
  }

  comparisonTitle(): string {
    return this.selectedChartMetric === 'clients'
      ? this.translate.instant('energyUsage.clientComparison')
      : this.translate.instant('energyUsage.agencyComparison');
  }

  chartYAxisTitle(): string {
    return this.selectedChartMetric === 'clients'
      ? this.translate.instant('energyUsage.totalClients')
      : `${this.translate.instant('energyUsage.totalEnergy')} (kWh)`;
  }

  chartDatasetLabel(agency: string): string {
    return this.selectedChartMetric === 'clients'
      ? `${agency} (${this.translate.instant('energyUsage.totalClients')})`
      : `${agency} (kWh)`;
  }

  private buildDailyTrend(): TrendPoint[] {
    const dayMap = new Map<string, number>();

    this.dailyRows
      .filter((row) => row.date.startsWith(this.oneMonthValue()))
      .forEach((row) => {
        dayMap.set(row.date, (dayMap.get(row.date) || 0) + Number(row.total_energy));
      });

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ label: this.formatDay(date), total }));
  }

  private buildWeeklyTrend(): TrendPoint[] {
    const weekMap = new Map<string, { start: Date; total: number }>();
    const selectedStart = this.monthStart(THREE_MONTH_VALUES[0]);
    const selectedEnd = this.monthEnd(THREE_MONTH_VALUES[THREE_MONTH_VALUES.length - 1]);

    this.dailyRows
      .filter((row) => THREE_MONTH_VALUES.some((month) => row.date.startsWith(month)))
      .forEach((row) => {
        const start = this.weekStart(row.date);
        const end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 6);
        if (start < selectedStart || end > selectedEnd) {
          return;
        }
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

  private buildAgencyTrendPanels(): void {
    const trendLabels = this.trendPoints.map((row) => row.label);
    const allAgencies = this.availableAgencies();
    const agencies = allAgencies.filter((agency) => agency === this.selectedAgencyFilter);
    const labelIndex = new Map(trendLabels.map((label, index) => [label, index]));

    this.agencyTrendPanels = agencies.map((agency, index) => {
      const color = this.chartPalette(index);
      return {
        agency,
        labels: trendLabels,
        data: new Array(trendLabels.length).fill(0),
        color: color.border,
        backgroundColor: color.background
      };
    });

    const panelByAgency = new Map(this.agencyTrendPanels.map((panel) => [panel.agency, panel]));

    if (this.selectedRange === 'month') {
      this.dailyRows
        .filter((row) => row.date.startsWith(this.oneMonthValue()))
        .forEach((row) => {
          const panel = panelByAgency.get(row.agency_name);
          const index = labelIndex.get(this.formatDay(row.date));
          if (panel && index !== undefined) {
            panel.data[index] += this.dailyChartValue(row);
          }
        });
      return;
    }

    if (this.selectedRange === 'quarter') {
      const selectedStart = this.monthStart(THREE_MONTH_VALUES[0]);
      const selectedEnd = this.monthEnd(THREE_MONTH_VALUES[THREE_MONTH_VALUES.length - 1]);

      this.dailyRows
        .filter((row) => THREE_MONTH_VALUES.some((month) => row.date.startsWith(month)))
        .forEach((row) => {
          const start = this.weekStart(row.date);
          const end = new Date(start);
          end.setUTCDate(start.getUTCDate() + 6);
          if (start < selectedStart || end > selectedEnd) {
            return;
          }
          const panel = panelByAgency.get(row.agency_name);
          const index = labelIndex.get(this.weekLabel(start));
          if (panel && index !== undefined) {
            panel.data[index] += this.dailyChartValue(row);
          }
        });
      return;
    }

    this.filteredRows.forEach((row) => {
      const panel = panelByAgency.get(row.agency_name);
      const index = labelIndex.get(row.month);
      if (panel && index !== undefined) {
        panel.data[index] += this.monthlyChartValue(row);
      }
    });
  }

  private dailyChartValue(row: DailyEnergyKpi): number {
    return this.selectedChartMetric === 'clients'
      ? Number(row.total_clients || 0)
      : Number(row.total_energy);
  }

  private monthlyChartValue(row: MonthlyEnergyKpi): number {
    return this.selectedChartMetric === 'clients'
      ? this.monthlyTotalClients(row)
      : Number(row.total_energy);
  }

  private monthlyTotalClients(row: MonthlyEnergyKpi): number {
    return Number(row.avg_clients || 0) * Number(row.readings_count || 0);
  }

  private chartPalette(index: number): { border: string; background: string } {
    const colors = [
      ['rgba(8, 38, 77, 1)', 'rgba(8, 38, 77, 0.12)'],
      ['rgba(227, 6, 19, 1)', 'rgba(227, 6, 19, 0.12)'],
      ['rgba(14, 116, 144, 1)', 'rgba(14, 116, 144, 0.12)'],
      ['rgba(180, 83, 9, 1)', 'rgba(180, 83, 9, 0.12)'],
      ['rgba(22, 101, 52, 1)', 'rgba(22, 101, 52, 0.12)']
    ];
    const [border, background] = colors[index % colors.length];
    return { border, background };
  }

  private peakDayLabel(): string {
    const peakDay = [...this.trendPoints].sort((a, b) => b.total - a.total)[0];
    return peakDay?.label ?? this.notAvailable();
  }

  private selectedPeriodLabel(): string {
    if (this.selectedRange === 'month') {
      return this.formatMonth(this.oneMonthValue());
    }
    if (this.selectedRange === 'quarter') {
      return THREE_MONTH_VALUES.map((month) => this.formatMonth(month)).join(' / ');
    }
    return FULL_YEAR_VALUE;
  }

  private ensureSelectedAgencyFilter(): void {
    const agencies = this.availableAgencies();
    if (!agencies.includes(this.selectedAgencyFilter)) {
      this.selectedAgencyFilter = agencies[0] || '';
    }
  }

  private oneMonthValue(): string {
    const totalsByMonth = new Map<string, number>();

    this.monthlyRows
      .filter((row) => row.month.startsWith(FULL_YEAR_VALUE))
      .forEach((row) => {
        totalsByMonth.set(row.month, (totalsByMonth.get(row.month) || 0) + Number(row.total_energy));
      });

    return Array.from(totalsByMonth.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || ONE_MONTH_FALLBACK_VALUE;
  }

  private daysInMonth(month: string): number {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber, 0).getDate();
  }

  private monthStart(month: string): Date {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber - 1, 1));
  }

  private monthEnd(month: string): Date {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber, 0));
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
