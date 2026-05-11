import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const STORAGE_KEY = 'energyAlertThreshold';
const DEFAULT_THRESHOLD = 4;

@Injectable({
  providedIn: 'root'
})
export class EnergyAlertThresholdService {
  private readonly thresholdSubject = new BehaviorSubject<number>(this.loadInitialThreshold());
  readonly threshold$ = this.thresholdSubject.asObservable();

  get threshold(): number {
    return this.thresholdSubject.value;
  }

  setThreshold(value: number | string): void {
    const threshold = this.normalize(value);
    this.thresholdSubject.next(threshold);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(threshold));
    }
  }

  private loadInitialThreshold(): number {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_THRESHOLD;
    }

    return this.normalize(localStorage.getItem(STORAGE_KEY));
  }

  private normalize(value: number | string | null): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_THRESHOLD;
  }
}
