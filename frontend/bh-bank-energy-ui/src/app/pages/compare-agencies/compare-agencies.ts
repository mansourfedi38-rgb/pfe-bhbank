import { NgFor, NgIf, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Region, Agency, ComparisonResponse } from '../../services/api.service';

@Component({
  selector: 'app-compare-agencies',
  standalone: true,
  imports: [NgIf, NgFor, UpperCasePipe, RouterLink, RouterLinkActive, TranslateModule, DecimalPipe, FormsModule],
  templateUrl: './compare-agencies.html',
  styleUrl: './compare-agencies.scss'
})
export class CompareAgenciesComponent implements OnInit {
  regions: Region[] = [];
  agencies: Agency[] = [];
  
  selectedRegionId: number | null = null;
  selectedAgency1Id: number | null = null;
  selectedAgency2Id: number | null = null;
  
  comparisonResult: ComparisonResponse | null = null;
  errorMessage: string | null = null;
  loadingMessage: string = '';
  isLoading = false;

  agency1Agencies: Agency[] = [];
  agency2Agencies: Agency[] = [];

  constructor(private router: Router, private api: ApiService) {}

  ngOnInit(): void {
    this.loadRegions();
  }

  loadRegions(): void {
    this.api.getRegions().subscribe({
      next: (regions) => {
        this.regions = regions;
      },
      error: (err) => {
        this.errorMessage = `Failed to load regions: ${err?.message ?? err}`;
        console.error('Load regions error', err);
      }
    });
  }

  onRegionChange(): void {
    this.selectedAgency1Id = null;
    this.selectedAgency2Id = null;
    this.comparisonResult = null;
    this.errorMessage = null;

    if (this.selectedRegionId === null) {
      this.agencies = [];
      return;
    }

    this.api.getAgencies(this.selectedRegionId).subscribe({
      next: (agencies) => {
        this.agencies = agencies;
        this.agency1Agencies = agencies;
        this.agency2Agencies = agencies;
      },
      error: (err) => {
        this.errorMessage = `Failed to load agencies: ${err?.message ?? err}`;
        console.error('Load agencies error', err);
      }
    });
  }

  onAgency1Change(): void {
    this.comparisonResult = null;
    this.errorMessage = null;
  }

  onAgency2Change(): void {
    this.comparisonResult = null;
    this.errorMessage = null;
  }

  compareAgencies(): void {
    if (!this.selectedAgency1Id || !this.selectedAgency2Id) {
      this.errorMessage = 'Please select both agencies';
      return;
    }

    if (this.selectedAgency1Id === this.selectedAgency2Id) {
      this.errorMessage = 'Please select different agencies';
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Comparing agencies...';
    this.errorMessage = null;

    this.api.compareAgencies(this.selectedAgency1Id, this.selectedAgency2Id).subscribe({
      next: (result) => {
        this.comparisonResult = result;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = `Comparison failed: ${err?.error?.error ?? err?.message ?? err}`;
        console.error('Comparison error', err);
      }
    });
  }

  logout(): void {
    this.router.navigate(['/login']);
  }

  getHigherEnergyAgency(): string {
    if (!this.comparisonResult) return '';
    return this.comparisonResult.agency_1.total_energy > this.comparisonResult.agency_2.total_energy 
      ? this.comparisonResult.agency_1.name 
      : this.comparisonResult.agency_2.name;
  }
}