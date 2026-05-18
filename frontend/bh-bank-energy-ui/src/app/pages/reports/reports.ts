import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from '../../components/navbar/navbar';
import { Agency, ApiService, ExecutiveSummaryResponse, MonthlyEnergyKpi } from '../../services/api.service';
import { TemperatureUnitService } from '../../services/temperature-unit.service';
import { Subscription } from 'rxjs';

interface MonthlyReportCard {
  month: string;
  totalEnergy: number;
  averageTemperature: number;
  highestAgency: string;
  readingsCount: number;
  status: 'High' | 'Normal' | 'Low';
}

const REPORT_MONTHS = [
  '2025-01',
  '2025-02',
  '2025-03',
  '2025-04',
  '2025-05',
  '2025-06',
  '2025-07',
  '2025-08',
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04'
];

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule, NavbarComponent],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class ReportsComponent implements OnInit, OnDestroy {
  backendStatus = '';
  isLoading = true;
  hasError = false;
  rawRows: MonthlyEnergyKpi[] = [];
  reportCards: MonthlyReportCard[] = [];
  filteredReportCards: MonthlyReportCard[] = [];
  availableYears: string[] = [];
  selectedYear = '';
  selectedReportMonth = '';
  selectedAgencyId: number | null = null;
  availableMonths: string[] = [];
  agencies: Agency[] = [];
  executiveSummary: ExecutiveSummaryResponse | null = null;
  summaryLoading = false;
  summaryError = '';
  pdfExporting = false;

  cards = {
    totalEnergy: '',
    averageMonthlyEnergy: '',
    peakMonth: '',
    peakAgency: '',
    totalReadings: ''
  };
  private readonly subscriptions = new Subscription();

  constructor(
    private api: ApiService,
    private translate: TranslateService,
    private temperatureUnit: TemperatureUnitService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.subscriptions.add(this.temperatureUnit.unit$.subscribe(() => {
      this.cdr.detectChanges();
    }));

    this.api.getMonthlyEnergyKpi().subscribe({
      next: (rows) => {
        this.rawRows = rows.filter((row) => REPORT_MONTHS.includes(row.month));
        this.reportCards = this.buildReportCards(this.rawRows);
        this.availableYears = Array.from(new Set(this.reportCards.map((report) => report.month.slice(0, 4)))).sort();
        this.availableMonths = Array.from(new Set(this.rawRows.map((row) => row.month))).sort();
        this.selectedYear = this.availableYears.includes('2025')
          ? '2025'
          : this.availableYears[this.availableYears.length - 1] || '';
        this.selectedReportMonth = this.availableMonths[this.availableMonths.length - 1] || '';

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

    this.api.getAgencies().subscribe({
      next: (agencies) => {
        this.agencies = agencies;
        this.cdr.detectChanges();
      },
      error: () => {
        this.agencies = [];
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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

  generateSummary(): void {
    if (!this.selectedReportMonth || this.summaryLoading) return;

    this.summaryLoading = true;
    this.summaryError = '';
    this.executiveSummary = null;

    this.api.generateExecutiveSummary({
      month: this.selectedReportMonth,
      agency_id: this.selectedAgencyId
    }).subscribe({
      next: (summary) => {
        this.executiveSummary = summary;
        this.summaryLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.summaryError = this.translate.instant('reports.executiveSummary.error');
        this.summaryLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  async exportPdf(): Promise<void> {
    if (!this.selectedReportMonth || this.pdfExporting) return;

    this.pdfExporting = true;
    this.summaryError = '';
    this.cdr.detectChanges();

    try {
      if (!this.executiveSummary) {
        await this.loadSummaryForPdf();
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      let y = 18;
      const summary = this.executiveSummary;
      const selectedAgencyName = this.selectedAgencyName();

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(227, 6, 19);
      pdf.setFontSize(18);
      pdf.text('BH Bank', margin, y);
      pdf.setTextColor(10, 35, 66);
      pdf.setFontSize(14);
      pdf.text(this.translate.instant('reports.pdf.title'), margin, y + 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`${this.translate.instant('reports.pdf.agency')}: ${selectedAgencyName}`, margin, y + 17);
      pdf.text(`${this.translate.instant('reports.pdf.month')}: ${this.selectedReportMonth}`, margin, y + 23);
      pdf.text(`${this.translate.instant('reports.pdf.exportDate')}: ${new Date().toLocaleDateString()}`, margin, y + 29);
      y += 42;

      y = this.addPdfSection(pdf, y, '1. ' + this.translate.instant('reports.pdf.executiveSummary'), summary?.summary || this.notAvailable());
      y = this.addPdfSection(pdf, y, '2. ' + this.translate.instant('reports.pdf.mainKpis'), this.kpiTextForPdf());
      y = this.addPdfSection(pdf, y, '3. ' + this.translate.instant('reports.pdf.energyAnalysis'), this.energyAnalysisForPdf());
      y = this.addPdfSection(pdf, y, '4. ' + this.translate.instant('reports.pdf.alerts'), this.alertsTextForPdf());
      y = this.addPdfSection(pdf, y, '5. ' + this.translate.instant('reports.pdf.recommendations'), this.recommendationsForPdf());

      const chartElement = document.getElementById('reportPdfCapture');
      if (chartElement) {
        if (y > pageHeight - 90) {
          pdf.addPage();
          y = 18;
        }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('6. ' + this.translate.instant('reports.pdf.charts'), margin, y);
        y += 5;
        const canvas = await html2canvas(chartElement, { scale: 2, backgroundColor: '#ffffff' });
        const image = canvas.toDataURL('image/png');
        const imageWidth = pageWidth - margin * 2;
        const imageHeight = Math.min((canvas.height * imageWidth) / canvas.width, pageHeight - y - 12);
        pdf.addImage(image, 'PNG', margin, y, imageWidth, imageHeight);
      }

      pdf.save(`BHBank_Report_${this.selectedReportMonth}.pdf`);
    } catch (_error) {
      this.summaryError = this.translate.instant('reports.pdf.error');
    } finally {
      this.pdfExporting = false;
      this.cdr.detectChanges();
    }
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
      `Average Temperature (${this.temperatureUnit.symbol})`,
      'Highest Consuming Agency',
      'Number of Readings',
      'Status'
    ];
    const rows = this.filteredReportCards.map((report) => [
      report.month,
      report.totalEnergy.toFixed(2),
      this.formatTemperatureValue(report.averageTemperature),
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

  reportChartBars(): { label: string; value: number; height: number }[] {
    const rows = this.filteredReportCards.slice().reverse();
    const maxValue = Math.max(...rows.map((row) => row.totalEnergy), 1);
    return rows.map((row) => ({
      label: row.month,
      value: row.totalEnergy,
      height: Math.max(8, Math.round((row.totalEnergy / maxValue) * 130))
    }));
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

  private loadSummaryForPdf(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api.generateExecutiveSummary({
        month: this.selectedReportMonth,
        agency_id: this.selectedAgencyId
      }).subscribe({
        next: (summary) => {
          this.executiveSummary = summary;
          resolve();
        },
        error: (error) => reject(error)
      });
    });
  }

  private addPdfSection(pdf: jsPDF, y: number, title: string, body: string): number {
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2;
    const lines = pdf.splitTextToSize(body, maxWidth);

    if (y + 12 + lines.length * 5 > pageHeight - 14) {
      pdf.addPage();
      y = 18;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(10, 35, 66);
    pdf.setFontSize(12);
    pdf.text(title, margin, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(51, 65, 85);
    pdf.text(lines, margin, y);
    return y + lines.length * 5 + 8;
  }

  private selectedAgencyName(): string {
    if (this.selectedAgencyId === null) {
      return this.translate.instant('reports.allAgencies');
    }
    return this.agencies.find((agency) => agency.id === this.selectedAgencyId)?.name || this.notAvailable();
  }

  private kpiTextForPdf(): string {
    const metrics = this.executiveSummary?.metrics;
    if (!metrics) return this.notAvailable();
    return [
      `${this.translate.instant('reports.totalEnergy')}: ${metrics.total_energy.toFixed(2)} kWh`,
      `${this.translate.instant('reports.averageTemperature')}: ${this.formatTemperature(metrics.avg_temperature)}`,
      `${this.translate.instant('reports.clientsCount')}: ${metrics.clients_count}`,
      `${this.translate.instant('reports.alertsCount')}: ${metrics.alerts_count}`,
      `${this.translate.instant('reports.occupancyEstimation')}: ${this.occupancyEstimation(metrics.clients_count, metrics.readings_count)}`
    ].join('\n');
  }

  private energyAnalysisForPdf(): string {
    const metrics = this.executiveSummary?.metrics;
    const report = this.reportCards.find((item) => item.month === this.selectedReportMonth);
    if (!metrics) return this.notAvailable();
    return [
      `${this.translate.instant('reports.efficiencyLevel')}: ${metrics.efficiency_level}`,
      `${this.translate.instant('reports.afterHoursEnergy')}: ${metrics.after_hours_energy.toFixed(2)} kWh`,
      `${this.translate.instant('reports.peakMonth')}: ${report?.month || this.notAvailable()}`,
      metrics.after_hours_energy > 0
        ? this.translate.instant('reports.pdf.afterHoursObservation')
        : this.translate.instant('reports.pdf.normalOperationsObservation')
    ].join('\n');
  }

  private alertsTextForPdf(): string {
    const metrics = this.executiveSummary?.metrics;
    if (!metrics) return this.notAvailable();
    if (metrics.alerts_count === 0) {
      return this.translate.instant('reports.pdf.noAlerts');
    }
    return this.translate.instant('reports.pdf.alertsDetected', { count: metrics.alerts_count });
  }

  private recommendationsForPdf(): string {
    const metrics = this.executiveSummary?.metrics;
    if (!metrics) return this.notAvailable();
    const recommendations = [];
    if (metrics.after_hours_energy > 0) recommendations.push(this.translate.instant('reports.pdf.recommendationAfterHours'));
    if (metrics.avg_temperature >= 28) recommendations.push(this.translate.instant('reports.pdf.recommendationCooling'));
    if (metrics.alerts_count > 0) recommendations.push(this.translate.instant('reports.pdf.recommendationAlerts'));
    recommendations.push(this.translate.instant('reports.pdf.recommendationTraffic'));
    return recommendations.map((item, index) => `${index + 1}. ${item}`).join('\n');
  }

  private occupancyEstimation(clientsCount: number, readingsCount: number): string {
    if (!readingsCount) return this.notAvailable();
    const average = clientsCount / readingsCount;
    if (average >= 18) return this.translate.instant('reports.occupancy.high');
    if (average >= 8) return this.translate.instant('reports.occupancy.moderate');
    return this.translate.instant('reports.occupancy.low');
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

  formatTemperature(value: number): string {
    return this.temperatureUnit.format(value);
  }

  private formatTemperatureValue(value: number): string {
    return this.temperatureUnit.format(value).replace(this.temperatureUnit.symbol, '');
  }

  private escapeCsvValue(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }
}
