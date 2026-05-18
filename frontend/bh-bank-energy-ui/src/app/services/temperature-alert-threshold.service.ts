import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const STORAGE_KEY = 'temperatureAlertThresholdCelsius';
const DEFAULT_THRESHOLD_CELSIUS = 30;

@Injectable({
  providedIn: 'root'
})
export class TemperatureAlertThresholdService {
  private readonly thresholdSubject = new BehaviorSubject<number>(this.loadInitialThreshold());
  readonly threshold$ = this.thresholdSubject.asObservable();

  get thresholdCelsius(): number {
    return this.thresholdSubject.value;
  }

  setThresholdCelsius(value: number | string): void {
    const threshold = this.normalize(value);
    this.thresholdSubject.next(threshold);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(threshold));
    }
  }

  private loadInitialThreshold(): number {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_THRESHOLD_CELSIUS;
    }

    return this.normalize(localStorage.getItem(STORAGE_KEY));
  }

  private normalize(value: number | string | null): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > -50 && parsed < 80
      ? parsed
      : DEFAULT_THRESHOLD_CELSIUS;
  }
}
