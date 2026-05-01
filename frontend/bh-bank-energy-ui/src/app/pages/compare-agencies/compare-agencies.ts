import { NgFor, NgIf, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService, Region, Agency, ComparisonResponse, MonthlyEnergyKpi } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

type ComparisonPeriod = 'month' | 'year';

@Component({
  selector: 'app-compare-agencies',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    UpperCasePipe,
    RouterLink,
    RouterLinkActive,
    TranslateModule,
    DecimalPipe,
    FormsModule
  ],
  templateUrl: './compare-agencies.html',
  styleUrl: './compare-agencies.scss'
})
export class CompareAgenciesComponent implements OnInit {
  regions: Region[] = [];
  agencies: Agency[] = [];
  monthlyRows: MonthlyEnergyKpi[] = [];

  selectedRegionId: number | null = null;
  selectedAgency1Id: number | null = null;
  selectedAgency2Id: number | null = null;
  selectedMonth = '';
  selectedYear = '2025';
  selectedPeriod: ComparisonPeriod = 'month';
  availableMonths: string[] = [];
  availableYears: string[] = [];
  showDetails = false;

  comparisonResult: ComparisonResponse | null = null;
  errorMessage: string | null = null;
  isLoading = false;
  loadingMessage = '';

  comparisonCards = {
    energyDifference: '',
    efficiencyWinner: '',
    temperatureGap: '',
    clientGap: '',
    mainReason: ''
  };

  constructor(
    private api: ApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.api.getMonthlyEnergyKpi().subscribe({
      next: (rows) => {
        this.monthlyRows = rows;
        this.availableMonths = this.getCompleteMonths(rows);
        this.availableYears = Array.from(new Set(rows.map((row) => row.month.slice(0, 4)))).sort();
        this.selectedMonth = this.availableMonths[this.availableMonths.length - 1] || rows[rows.length - 1]?.month || '';
        this.selectedYear = this.availableYears.includes('2025') ? '2025' : this.availableYears[this.availableYears.length - 1] || '';
        this.loadRegions();
      },
      error: () => {
        this.errorMessage = this.translate.instant('compareAgencies.errors.loadPeriods');
        this.loadRegions();
      }
    });
  }

  loadRegions(): void {
    this.api.getRegions().subscribe({
      next: (regions) => {
        this.regions = regions;
        this.selectedRegionId = regions[0]?.id ?? null;
        if (this.selectedRegionId) {
          this.loadAgenciesForRegion(true);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = this.translate.instant('compareAgencies.errors.loadRegions');
        console.error('Load regions error:', err);
        this.cdr.detectChanges();
      }
    });
  }

  onRegionChange(): void {
    this.loadAgenciesForRegion(false);
  }

  loadAgenciesForRegion(autoCompare: boolean): void {
    this.resetComparisonOnly();

    if (!this.selectedRegionId) {
      this.agencies = [];
      return;
    }

    this.api.getAgencies(this.selectedRegionId).subscribe({
      next: (agencies) => {
        this.agencies = agencies;
        this.selectedAgency1Id = agencies[0]?.id ?? null;
        this.selectedAgency2Id = agencies[1]?.id ?? null;
        this.cdr.detectChanges();

        if (autoCompare && this.selectedAgency1Id && this.selectedAgency2Id) {
          this.compareAgencies();
        }
      },
      error: (err) => {
        this.errorMessage = this.translate.instant('compareAgencies.errors.loadAgencies');
        console.error('Load agencies error:', err);
        this.cdr.detectChanges();
      }
    });
  }

  onPeriodChange(): void {
    this.resetComparisonOnly();
  }

  compareAgencies(): void {
    this.errorMessage = null;
    this.comparisonResult = null;
    this.showDetails = false;

    if (!this.selectedAgency1Id || !this.selectedAgency2Id) {
      this.errorMessage = this.translate.instant('compareAgencies.errors.selectBoth');
      return;
    }

    if (this.selectedAgency1Id === this.selectedAgency2Id) {
      this.errorMessage = this.translate.instant('compareAgencies.errors.selectDifferent');
      return;
    }

    this.isLoading = true;
    this.loadingMessage = this.translate.instant('compareAgencies.actions.comparing');

    this.api.compareAgencies(this.selectedAgency1Id, this.selectedAgency2Id, this.getPeriodFilter()).subscribe({
      next: (result) => {
        this.comparisonResult = result;
        this.updateComparisonCards();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = this.translate.instant('compareAgencies.errors.comparisonFailed');
        console.error('Comparison error:', err);
        this.cdr.detectChanges();
      }
    });
  }

  getHigherEnergyAgency(): string {
    if (!this.comparisonResult) return '';

    const energy1 = this.comparisonResult.agency_1.total_energy;
    const energy2 = this.comparisonResult.agency_2.total_energy;

    if (energy1 === energy2) return this.translate.instant('compareAgencies.equal');

    return energy1 > energy2
      ? this.comparisonResult.agency_1.name
      : this.comparisonResult.agency_2.name;
  }

  logout(): void {
    this.auth.logout();
  }

  toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }

  getMainReasonText(): string {
    const firstCause = this.comparisonResult?.causes?.[0];
    if (!firstCause) {
      return this.translate.instant('compareAgencies.noDominantCause');
    }
    return this.getCauseMessage(firstCause.factor);
  }

  getCauseFactor(factor: string): string {
    const key = `compareAgencies.factors.${factor}`;
    const translated = this.translate.instant(key);
    return translated === key ? factor : translated;
  }

  getCauseMessage(factor: string): string {
    const key = `compareAgencies.causeMessages.${factor}`;
    const translated = this.translate.instant(key);
    return translated === key ? (this.comparisonResult?.main_reason || factor) : translated;
  }

  getRecommendationText(recommendation: string): string {
    const key = this.getRecommendationKey(recommendation);
    const translated = this.translate.instant(`compareAgencies.recommendationText.${key}`);
    return translated === `compareAgencies.recommendationText.${key}` ? recommendation : translated;
  }

  private updateComparisonCards(): void {
    if (!this.comparisonResult) return;

    const agency1 = this.comparisonResult.agency_1;
    const agency2 = this.comparisonResult.agency_2;
    const energyDiff = Math.abs(agency1.total_energy - agency2.total_energy);
    const tempGap = Math.abs(agency1.average_temperature - agency2.average_temperature);
    const clientGap = Math.abs(agency1.average_clients - agency2.average_clients);

    this.comparisonCards.energyDifference = `${energyDiff.toFixed(2)} kWh`;
    this.comparisonCards.efficiencyWinner = agency1.energy_per_client <= agency2.energy_per_client
      ? agency1.name
      : agency2.name;
    this.comparisonCards.temperatureGap = `${tempGap.toFixed(1)}°C`;
    this.comparisonCards.clientGap = `${clientGap.toFixed(1)} ${this.translate.instant('common.clientsUnit')}`;
    this.comparisonCards.mainReason =
      this.comparisonResult.main_reason || this.translate.instant('compareAgencies.noDominantCause');
  }

  private getRecommendationKey(recommendation: string): string {
    if (recommendation.includes('AC scheduling')) return 'acSchedule';
    if (recommendation.includes('after closing')) return 'afterHours';
    if (recommendation.includes('insulation')) return 'insulation';
    if (recommendation.includes('energy per client')) return 'efficiency';
    if (recommendation.includes('peak client traffic')) return 'traffic';
    if (recommendation.includes('peak-load')) return 'peakLoad';
    if (recommendation.includes('equipment usage policies')) return 'policies';
    if (recommendation.includes('Generate or select')) return 'generateData';
    if (recommendation.includes('Continue monitoring')) return 'monitor';
    return 'policies';
  }

  private getPeriodFilter(): { month?: string; date_from?: string; date_to?: string } {
    if (this.selectedPeriod === 'month') {
      return { month: this.selectedMonth };
    }

    return {
      date_from: `${this.selectedYear}-01-01`,
      date_to: `${this.selectedYear}-12-31`
    };
  }

  private getCompleteMonths(rows: MonthlyEnergyKpi[]): string[] {
    const byMonth = new Map<string, MonthlyEnergyKpi[]>();
    rows.forEach((row) => {
      byMonth.set(row.month, [...(byMonth.get(row.month) || []), row]);
    });

    return Array.from(byMonth.entries())
      .filter(([, monthRows]) => monthRows.length >= 2 && monthRows.reduce((sum, row) => sum + row.readings_count, 0) >= 100)
      .map(([month]) => month)
      .sort();
  }

  private resetComparisonOnly(): void {
    this.comparisonResult = null;
    this.errorMessage = null;
    this.showDetails = false;
    this.setCardsNotAvailable();
  }

  private setCardsNotAvailable(): void {
    this.comparisonCards.energyDifference = this.notAvailable();
    this.comparisonCards.efficiencyWinner = this.notAvailable();
    this.comparisonCards.temperatureGap = this.notAvailable();
    this.comparisonCards.clientGap = this.notAvailable();
    this.comparisonCards.mainReason = this.notAvailable();
  }

  private notAvailable(): string {
    return this.translate.instant('common.notAvailable');
  }
}
