import { NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { timeout } from 'rxjs';

import { NavbarComponent } from '../../components/navbar/navbar';
import {
  Agency,
  AiDetectorDailyResponse,
  AiDetectorHourlyImage,
  AiDetectorMonthlyResponse,
  ApiService
} from '../../services/api.service';

interface ZoneCard {
  key: 'zone_1' | 'zone_2' | 'zone_3' | 'zone_4';
  labelKey: string;
  clients: number;
}

interface ZoneTotalCard {
  labelKey: string;
  total: number;
}

interface HourlyImageDayGroup {
  date: string;
  images: AiDetectorHourlyImage[];
}

@Component({
  selector: 'app-ai-detector',
  standalone: true,
  imports: [FormsModule, NgClass, NgFor, NgIf, TranslateModule, NavbarComponent],
  templateUrl: './ai-detector.html',
  styleUrl: './ai-detector.scss'
})
export class AiDetectorComponent implements OnInit {
  dailyResult: AiDetectorDailyResponse | null = null;
  monthlyResult: AiDetectorMonthlyResponse | null = null;
  agencies: Agency[] = [];
  selectedAgencyId: number | null = null;
  selectedMonth = '2025-07';
  selectedDay = '2025-07-15';
  agenciesLoading = true;
  isDailyLoading = false;
  isMonthlyLoading = false;
  hasDailyError = false;
  hasMonthlyError = false;
  hasAgenciesError = false;
  showHourlyImages = false;
  enlargedImage: AiDetectorHourlyImage | null = null;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.api.getAgencies().subscribe({
      next: (agencies) => {
        this.agencies = agencies;
        this.selectedAgencyId = agencies[0]?.id ?? null;
        this.agenciesLoading = false;
        this.hasAgenciesError = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.agencies = [];
        this.selectedAgencyId = null;
        this.agenciesLoading = false;
        this.hasAgenciesError = true;
        this.cdr.detectChanges();
      }
    });
  }

  onMonthChange(): void {
    if (!this.selectedDay || !this.selectedDay.startsWith(this.selectedMonth)) {
      this.selectedDay = `${this.selectedMonth}-15`;
    }
  }

  runDailyAnalysis(): void {
    if (!this.selectedAgencyId || !this.selectedDay) {
      this.hasDailyError = true;
      return;
    }

    this.isDailyLoading = true;
    this.hasDailyError = false;
    this.cdr.detectChanges();

    this.api.getAiDetectorDaily(this.selectedAgencyId, this.selectedDay).pipe(timeout(30000)).subscribe({
      next: (result) => {
        this.dailyResult = result;
        this.isDailyLoading = false;
        this.hasDailyError = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.dailyResult = null;
        this.isDailyLoading = false;
        this.hasDailyError = true;
        this.cdr.detectChanges();
      }
    });
  }

  runMonthlyAnalysis(): void {
    if (!this.selectedAgencyId || !this.selectedMonth) {
      this.hasMonthlyError = true;
      return;
    }

    this.isMonthlyLoading = true;
    this.hasMonthlyError = false;
    this.cdr.detectChanges();

    this.api.getAiDetectorMonthly(this.selectedAgencyId, this.selectedMonth)
      .pipe(timeout(120000))
      .subscribe({
        next: (result) => {
          this.monthlyResult = result;
          this.showHourlyImages = false;
          this.isMonthlyLoading = false;
          this.hasMonthlyError = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.monthlyResult = null;
          this.isMonthlyLoading = false;
          this.hasMonthlyError = true;
          this.cdr.detectChanges();
        }
      });
  }

  get zoneCards(): ZoneCard[] {
    const zones = this.dailyResult?.zone_summary;
    return [
      { key: 'zone_1', labelKey: 'aiDetector.zone1', clients: zones?.zone_1_avg ?? 0 },
      { key: 'zone_2', labelKey: 'aiDetector.zone2', clients: zones?.zone_2_avg ?? 0 },
      { key: 'zone_3', labelKey: 'aiDetector.zone3', clients: zones?.zone_3_avg ?? 0 },
      { key: 'zone_4', labelKey: 'aiDetector.zone4', clients: zones?.zone_4_avg ?? 0 }
    ];
  }

  occupancyLabelKey(clients: number): string {
    if (clients <= 3) return 'aiDetector.occupancy.low';
    if (clients <= 7) return 'aiDetector.occupancy.normal';
    return 'aiDetector.occupancy.crowded';
  }

  occupancyClass(clients: number): string {
    if (clients <= 3) return 'low';
    if (clients <= 7) return 'normal';
    return 'crowded';
  }

  get zoneTotalCards(): ZoneTotalCard[] {
    const totals = this.monthlyResult?.zone_totals;
    return [
      { labelKey: 'aiDetector.zone1', total: totals?.zone_1 ?? 0 },
      { labelKey: 'aiDetector.zone2', total: totals?.zone_2 ?? 0 },
      { labelKey: 'aiDetector.zone3', total: totals?.zone_3 ?? 0 },
      { labelKey: 'aiDetector.zone4', total: totals?.zone_4 ?? 0 }
    ];
  }

  formatTimestamp(value: string | null): string {
    if (!value) return '';
    return new Date(value).toLocaleString();
  }

  toggleHourlyImages(): void {
    this.showHourlyImages = !this.showHourlyImages;
  }

  get hourlyImageGroups(): HourlyImageDayGroup[] {
    const groups = new Map<string, AiDetectorHourlyImage[]>();

    for (const image of this.monthlyResult?.hourly_images ?? []) {
      const date = image.timestamp.slice(0, 10);
      const group = groups.get(date) ?? [];
      group.push(image);
      groups.set(date, group);
    }

    return [...groups.entries()].map(([date, images]) => ({ date, images }));
  }

  formatHour(value: string): string {
    return value.slice(11, 16);
  }

  get dailyPeakImage(): AiDetectorHourlyImage | null {
    if (!this.dailyResult?.peak_timestamp) return null;
    return this.dailyResult.hourly_images.find(
      (image) => image.timestamp === this.dailyResult?.peak_timestamp
    ) ?? null;
  }

  get monthlyPeakImage(): AiDetectorHourlyImage | null {
    if (!this.monthlyResult?.peak_timestamp) return null;
    return this.monthlyResult.hourly_images.find(
      (image) => image.timestamp === this.monthlyResult?.peak_timestamp
    ) ?? null;
  }

  isPeakHour(image: AiDetectorHourlyImage): boolean {
    return image.timestamp === this.dailyResult?.peak_timestamp;
  }

  openImage(image: AiDetectorHourlyImage): void {
    this.enlargedImage = image;
  }

  closeImage(): void {
    this.enlargedImage = null;
  }

  recommendationTypeLabelKey(type: string): string {
    return `aiDetector.recommendationTypes.${type}`;
  }

  severityLabelKey(severity: string): string {
    return `aiDetector.severity.${severity}`;
  }

  recommendationMessageKey(type: string): string {
    return `aiDetector.recommendationMessages.${type}`;
  }
}
