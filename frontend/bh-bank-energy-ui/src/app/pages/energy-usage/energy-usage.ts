import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import Chart from 'chart.js/auto';
import { ApiService, MonthlyEnergyKpi } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

type EnergyRange = 'month' | 'quarter' | 'year';

@Component({
  selector: 'app-energy-usage',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './energy-usage.html',
  styleUrl: './energy-usage.scss'
})
export class EnergyUsageComponent implements OnInit {
  backendStatus = '';
  isLoading = true;
  hasError = false;
  selectedRange: EnergyRange = 'month';
  monthlyRows: MonthlyEnergyKpi[] = [];
  filteredRows: MonthlyEnergyKpi[] = [];
  monthTotals: { month: string; total: number }[] = [];
  agencyTotals: { agency: string; total: number }[] = [];

  cards = {
    totalEnergy: '',
    averageEnergyPerMonth: '',
    peakMonth: '',
    peakAgency: ''
  };

  private trendChart: Chart | null = null;

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
        this.monthlyRows = rows;
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
    const takeCount = range === 'month' ? 1 : range === 'quarter' ? 3 : 12;
    const selectedMonths = months.slice(-takeCount);

    this.filteredRows = this.monthlyRows.filter((row) => selectedMonths.includes(row.month));
    this.recalculateSummaries();
    this.createTrendChart();
  }

  logout() {
    this.auth.logout();
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

    this.cards.totalEnergy = `${totalEnergy.toFixed(2)} kWh`;
    this.cards.averageEnergyPerMonth = `${(totalEnergy / this.monthTotals.length).toFixed(2)} kWh`;
    this.cards.peakMonth = peakMonth?.month ?? this.notAvailable();
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
      if (!ctx || this.monthTotals.length === 0) return;

      this.trendChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.monthTotals.map((row) => row.month),
          datasets: [{
            label: this.translate.instant('energyUsage.energyTrendByMonth') + ' (kWh)',
            data: this.monthTotals.map((row) => row.total),
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
            y: { beginAtZero: true, title: { display: true, text: this.translate.instant('energyUsage.totalEnergy') + ' (kWh)' } }
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

  private setCardsNotAvailable(): void {
    this.cards.totalEnergy = this.notAvailable();
    this.cards.averageEnergyPerMonth = this.notAvailable();
    this.cards.peakMonth = this.notAvailable();
    this.cards.peakAgency = this.notAvailable();
  }

  private notAvailable(): string {
    return this.translate.instant('common.notAvailable');
  }
}
