import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../../components/language-switcher/language-switcher';
import { ApiService, MonthlyEnergyKpi } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

interface MonthlyReportCard {
  month: string;
  totalEnergy: number;
  averageTemperature: number;
  highestAgency: string;
  readingsCount: number;
  status: 'High' | 'Normal' | 'Low';
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, RouterLink, RouterLinkActive, TranslateModule, LanguageSwitcherComponent],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class ReportsComponent implements OnInit {
  backendStatus = '';
  isLoading = true;
  hasError = false;
  rawRows: MonthlyEnergyKpi[] = [];
  reportCards: MonthlyReportCard[] = [];
  filteredReportCards: MonthlyReportCard[] = [];
  availableYears: string[] = [];
  selectedYear = '';

  cards = {
    totalEnergy: '',
    averageMonthlyEnergy: '',
    peakMonth: '',
    peakAgency: '',
    totalReadings: ''
  };

  constructor(
    private api: ApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.api.getMonthlyEnergyKpi().subscribe({
      next: (rows) => {
        this.rawRows = rows;
        this.reportCards = this.buildReportCards(rows);
        this.availableYears = Array.from(new Set(this.reportCards.map((report) => report.month.slice(0, 4)))).sort();
        this.selectedYear = this.availableYears.includes('2025')
          ? '2025'
          : this.availableYears[this.availableYears.length - 1] || '';

        this.isLoading = false;
        this.hasError = false;
        this.applyYearFilter();
      },
      error: (err) => {
        this.isLoading = false;
        this.hasError = true;
        this.backendStatus = this.translate.instant('reports.status.failed', {
          error: String(err?.message ?? err)
        });
        this.cdr.detectChanges();
      }
    });
  }

  logout() {
    this.auth.logout();
  }

  applyYearFilter(): void {
    this.filteredReportCards = this.reportCards.filter((report) => report.month.startsWith(this.selectedYear));
    this.updateSummary();
    this.backendStatus = this.filteredReportCards.length > 0
      ? this.translate.instant('reports.status.loaded', {
          count: this.filteredReportCards.length,
          year: this.selectedYear
        })
      : this.translate.instant('reports.status.noData', { year: this.selectedYear });
    this.cdr.detectChanges();
  }

  exportCsv(): void {
    if (this.filteredReportCards.length === 0 || !this.selectedYear) {
      this.backendStatus = this.translate.instant('reports.exportNoData', { year: this.selectedYear });
      this.cdr.detectChanges();
      return;
    }

    const headers = [
      'Month',
      'Total Energy',
      'Average Temperature',
      'Highest Consuming Agency',
      'Number of Readings',
      'Status'
    ];
    const rows = this.filteredReportCards.map((report) => [
      report.month,
      report.totalEnergy.toFixed(2),
      report.averageTemperature.toFixed(1),
      report.highestAgency,
      String(report.readingsCount),
      report.status
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `energy-report-${this.selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private buildReportCards(rows: MonthlyEnergyKpi[]): MonthlyReportCard[] {
    const monthMap = new Map<string, MonthlyEnergyKpi[]>();
    rows.forEach((row) => {
      monthMap.set(row.month, [...(monthMap.get(row.month) || []), row]);
    });

    const cards = Array.from(monthMap.entries()).map(([month, monthRows]) => {
      const totalEnergy = monthRows.reduce((sum, row) => sum + Number(row.total_energy), 0);
      const averageTemperature =
        monthRows.reduce((sum, row) => sum + Number(row.avg_temperature), 0) / monthRows.length;
      const highestAgency = [...monthRows].sort((a, b) => Number(b.total_energy) - Number(a.total_energy))[0];
      const readingsCount = monthRows.reduce((sum, row) => sum + Number(row.readings_count), 0);

      return {
        month,
        totalEnergy,
        averageTemperature,
        highestAgency: highestAgency?.agency_name || this.notAvailable(),
        readingsCount,
        status: 'Normal' as const
      };
    });

    const averageEnergy =
      cards.reduce((sum, report) => sum + report.totalEnergy, 0) / Math.max(1, cards.length);

    return cards
      .map((report) => ({
        ...report,
        status: this.getEnergyStatus(report.totalEnergy, averageEnergy)
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }

  private updateSummary(): void {
    if (this.filteredReportCards.length === 0) {
      this.setCardsNotAvailable();
      return;
    }

    const totalEnergy = this.filteredReportCards.reduce((sum, report) => sum + report.totalEnergy, 0);
    const peakMonth = [...this.filteredReportCards].sort((a, b) => b.totalEnergy - a.totalEnergy)[0];
    const agencyMap = new Map<string, number>();

    this.rawRows
      .filter((row) => row.month.startsWith(this.selectedYear))
      .forEach((row) => {
        agencyMap.set(row.agency_name, (agencyMap.get(row.agency_name) || 0) + Number(row.total_energy));
      });

    const peakAgency = Array.from(agencyMap.entries()).sort((a, b) => b[1] - a[1])[0];
    const readings = this.filteredReportCards.reduce((sum, report) => sum + report.readingsCount, 0);

    this.cards.totalEnergy = `${totalEnergy.toFixed(2)} kWh`;
    this.cards.averageMonthlyEnergy = `${(totalEnergy / this.filteredReportCards.length).toFixed(2)} kWh`;
    this.cards.peakMonth = peakMonth?.month || this.notAvailable();
    this.cards.peakAgency = peakAgency?.[0] || this.notAvailable();
    this.cards.totalReadings = `${readings}`;
  }

  private getEnergyStatus(totalEnergy: number, averageEnergy: number): 'High' | 'Normal' | 'Low' {
    if (totalEnergy >= averageEnergy * 1.15) return 'High';
    if (totalEnergy <= averageEnergy * 0.85) return 'Low';
    return 'Normal';
  }

  private setLoadingState(): void {
    this.isLoading = true;
    this.hasError = false;
    this.backendStatus = this.translate.instant('reports.status.loading');
    this.setCardsNotAvailable();
  }

  private setCardsNotAvailable(): void {
    this.cards.totalEnergy = this.notAvailable();
    this.cards.averageMonthlyEnergy = this.notAvailable();
    this.cards.peakMonth = this.notAvailable();
    this.cards.peakAgency = this.notAvailable();
    this.cards.totalReadings = this.notAvailable();
  }

  private notAvailable(): string {
    return this.translate.instant('common.notAvailable');
  }

  private escapeCsvValue(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }
}
