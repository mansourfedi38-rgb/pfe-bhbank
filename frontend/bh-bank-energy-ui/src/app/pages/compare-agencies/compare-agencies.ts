import { NgFor, NgIf, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Region, Agency, ComparisonResponse } from '../../services/api.service';

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

  // Data
  regions: Region[] = [];
  agencies: Agency[] = [];

  // Selected values
  selectedRegionId: number | null = null;
  selectedAgency1Id: number | null = null;
  selectedAgency2Id: number | null = null;

  // Result & states
  comparisonResult: ComparisonResponse | null = null;
  errorMessage: string | null = null;
  isLoading = false;
  loadingMessage = '';

  constructor(
    private router: Router,
    private api: ApiService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadRegions();
  }

  // ===============================
  // LOAD REGIONS
  // ===============================
  loadRegions(): void {
    this.api.getRegions().subscribe({
      next: (regions) => {
        this.regions = regions;
      },
      error: (err) => {
        this.errorMessage = this.translate.instant('compareAgencies.errors.loadRegions');
        console.error('Load regions error:', err);
      }
    });
  }

  // ===============================
  // REGION CHANGE
  // ===============================
  onRegionChange(): void {
    this.resetSelections();

    if (!this.selectedRegionId) {
      this.agencies = [];
      return;
    }

    this.api.getAgencies(this.selectedRegionId).subscribe({
      next: (agencies) => {
        this.agencies = agencies;
      },
      error: (err) => {
        this.errorMessage = this.translate.instant('compareAgencies.errors.loadAgencies');
        console.error('Load agencies error:', err);
      }
    });
  }

  // ===============================
  // RESET
  // ===============================
  resetSelections(): void {
    this.selectedAgency1Id = null;
    this.selectedAgency2Id = null;
    this.comparisonResult = null;
    this.errorMessage = null;
  }

  // ===============================
  // COMPARE
  // ===============================
  compareAgencies(): void {
    this.errorMessage = null;
    this.comparisonResult = null;

    // Validation
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

    this.api.compareAgencies(this.selectedAgency1Id, this.selectedAgency2Id).subscribe({
      next: (result) => {
        this.comparisonResult = result;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.error || this.translate.instant('compareAgencies.errors.comparisonFailed');
        console.error('Comparison error:', err);
      }
    });
  }

  // ===============================
  // HELPER
  // ===============================
  getHigherEnergyAgency(): string {
    if (!this.comparisonResult) return '';

    const energy1 = this.comparisonResult.agency_1.total_energy;
    const energy2 = this.comparisonResult.agency_2.total_energy;

    if (energy1 === energy2) return this.translate.instant('compareAgencies.equal');

    return energy1 > energy2
      ? this.comparisonResult.agency_1.name
      : this.comparisonResult.agency_2.name;
  }

  // ===============================
  // LOGOUT
  // ===============================
  logout(): void {
    this.router.navigate(['/login']);
  }
}