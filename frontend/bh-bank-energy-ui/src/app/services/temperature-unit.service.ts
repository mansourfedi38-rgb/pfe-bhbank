import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type TemperatureUnit = 'celsius' | 'fahrenheit';

const STORAGE_KEY = 'temperatureUnit';

@Injectable({
  providedIn: 'root'
})
export class TemperatureUnitService {
  private readonly unitSubject = new BehaviorSubject<TemperatureUnit>(this.loadInitialUnit());
  readonly unit$ = this.unitSubject.asObservable();

  get unit(): TemperatureUnit {
    return this.unitSubject.value;
  }

  setUnit(unit: TemperatureUnit): void {
    this.unitSubject.next(unit);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, unit);
    }
  }

  format(valueInCelsius: number | string, fractionDigits = 1): string {
    const value = Number(valueInCelsius);

    if (!Number.isFinite(value)) {
      return '';
    }

    const converted = this.unit === 'fahrenheit'
      ? (value * 9 / 5) + 32
      : value;

    return `${converted.toFixed(fractionDigits)}${this.symbol}`;
  }

  formatDifference(valueInCelsius: number | string, fractionDigits = 1): string {
    const value = Number(valueInCelsius);

    if (!Number.isFinite(value)) {
      return '';
    }

    const converted = this.unit === 'fahrenheit'
      ? value * 9 / 5
      : value;

    return `${converted.toFixed(fractionDigits)}${this.symbol}`;
  }

  get symbol(): string {
    return this.unit === 'fahrenheit' ? '°F' : '°C';
  }

  private loadInitialUnit(): TemperatureUnit {
    if (typeof localStorage === 'undefined') {
      return 'celsius';
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  }
}
