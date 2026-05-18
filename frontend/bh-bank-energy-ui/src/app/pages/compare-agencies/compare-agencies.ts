import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from '../../components/navbar/navbar';
import { Agency, ApiService, ComparisonResponse, Insight, MonthlyEnergyKpi, Region } from '../../services/api.service';
import { TemperatureUnitService } from '../../services/temperature-unit.service';
import { Subscription } from 'rxjs';

type ComparisonPeriod = 'month' | 'year';

const COMPARE_REGION_NAME = 'cap bon';
const COMPARE_AGENCY_NAMES = [
  'bh bank nabeul',
  'bh bank dar chaaben',
  'bh bank mrezga'
];
const COMPARE_MONTHS = [
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
  selector: 'app-compare-agencies',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    TranslateModule,
    DecimalPipe,
    FormsModule,
    NavbarComponent
  ],
  templateUrl: './compare-agencies.html',
  styleUrl: './compare-agencies.scss'
})
export class CompareAgenciesComponent implements OnInit, OnDestroy {
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
  private readonly subscriptions = new Subscription();

  constructor(
    private api: ApiService,
    private translate: TranslateService,
    private temperatureUnit: TemperatureUnitService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(this.temperatureUnit.unit$.subscribe(() => {
      this.updateComparisonCards();
      this.cdr.detectChanges();
    }));
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadInitialData(): void {
    this.api.getMonthlyEnergyKpi().subscribe({
      next: (rows) => {
        this.monthlyRows = rows;
        this.availableMonths = this.getCompleteMonths(rows);
        this.availableYears = Array.from(new Set(this.availableMonths.map((month) => month.slice(0, 4)))).sort();
        this.selectedMonth = this.availableMonths[this.availableMonths.length - 1] || '';
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
        this.regions = regions.filter((region) => this.normalizeName(region.name) === COMPARE_REGION_NAME);
        this.selectedRegionId = this.regions[0]?.id ?? null;
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
        this.agencies = agencies
          .filter((agency) => COMPARE_AGENCY_NAMES.includes(this.normalizeName(agency.name)))
          .sort((a, b) => COMPARE_AGENCY_NAMES.indexOf(this.normalizeName(a.name)) - COMPARE_AGENCY_NAMES.indexOf(this.normalizeName(b.name)));
        this.selectedAgency1Id = this.agencies[0]?.id ?? null;
        this.selectedAgency2Id = this.agencies[1]?.id ?? null;
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

  formatTemperature(value: number): string {
    return this.temperatureUnit.format(value);
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

  getInsightType(insight: Insight): string {
    const key = `compareAgencies.insightTypes.${insight.type}`;
    const translated = this.translate.instant(key);
    return translated === key ? insight.type : translated;
  }

  getInsightFactor(insight: Insight): string {
    if (!this.comparisonResult) {
      return insight.factor;
    }

    const context = this.getInsightContext();
    switch (insight.type) {
      case 'temperature':
        return this.translate.instant('compareAgencies.insightFactors.temperature', {
          diff: context.temperatureDiff.toFixed(1)
        });
      case 'clients':
        return this.translate.instant('compareAgencies.insightFactors.clients', {
          diff: context.clientsDiff
        });
      case 'ac_mode':
        return this.translate.instant('compareAgencies.insightFactors.acMode', {
          diff: context.acOnDiff.toFixed(0)
        });
      case 'efficiency':
        return this.translate.instant('compareAgencies.insightFactors.efficiency', {
          diff: context.energyPerClientPct.toFixed(0)
        });
      case 'general':
        return this.translate.instant('compareAgencies.insightFactors.general');
      default:
        return insight.factor;
    }
  }

  getInsightText(insight: Insight): string {
    if (!this.comparisonResult) {
      return insight.text;
    }

    const context = this.getInsightContext();
    switch (insight.type) {
      case 'temperature':
        return this.translate.instant('compareAgencies.insightMessages.temperature', {
          higher: context.higher.name,
          higherTemp: context.higher.average_temperature.toFixed(1),
          lowerTemp: context.lower.average_temperature.toFixed(1)
        });
      case 'clients':
        return this.translate.instant('compareAgencies.insightMessages.clients', {
          higher: context.higher.name,
          diff: context.clientsDiff,
          percent: context.clientsPct.toFixed(0)
        });
      case 'ac_mode':
        return this.translate.instant('compareAgencies.insightMessages.acMode', {
          higher: context.higher.name,
          higherPercent: context.higher.on_percentage.toFixed(0),
          lowerPercent: context.lower.on_percentage.toFixed(0)
        });
      case 'efficiency':
        return this.translate.instant('compareAgencies.insightMessages.efficiency', {
          higher: context.higher.name,
          percent: context.energyPerClientPct.toFixed(0),
          higherValue: context.higher.energy_per_client.toFixed(2),
          lowerValue: context.lower.energy_per_client.toFixed(2)
        });
      case 'general':
        return this.translate.instant('compareAgencies.insightMessages.general');
      default:
        return insight.text;
    }
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
    this.comparisonCards.temperatureGap = this.temperatureUnit.formatDifference(tempGap);
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

  private getInsightContext() {
    const agency1 = this.comparisonResult!.agency_1;
    const agency2 = this.comparisonResult!.agency_2;
    const higher = agency1.total_energy >= agency2.total_energy ? agency1 : agency2;
    const lower = agency1.total_energy >= agency2.total_energy ? agency2 : agency1;
    const clientsDiff = Math.max(0, higher.total_clients - lower.total_clients);
    const clientsPct = lower.total_clients > 0 ? (clientsDiff / lower.total_clients) * 100 : 0;
    const acOnDiff = Math.max(0, higher.on_percentage - lower.on_percentage);
    const energyPerClientDiff = Math.max(0, higher.energy_per_client - lower.energy_per_client);
    const energyPerClientPct = lower.energy_per_client > 0
      ? (energyPerClientDiff / lower.energy_per_client) * 100
      : 0;

    return {
      higher,
      lower,
      temperatureDiff: higher.average_temperature - lower.average_temperature,
      clientsDiff,
      clientsPct,
      acOnDiff,
      energyPerClientPct
    };
  }

  private getPeriodFilter(): { month?: string; date_from?: string; date_to?: string } {
    if (this.selectedPeriod === 'month') {
      return { month: this.selectedMonth };
    }

    return {
      date_from: `${this.selectedYear}-01-01`,
      date_to: this.selectedYear === '2026' ? '2026-04-30' : `${this.selectedYear}-12-31`
    };
  }

  private getCompleteMonths(_rows: MonthlyEnergyKpi[]): string[] {
    return COMPARE_MONTHS;
  }

  private normalizeName(value: string): string {
    return value.trim().toLowerCase();
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
