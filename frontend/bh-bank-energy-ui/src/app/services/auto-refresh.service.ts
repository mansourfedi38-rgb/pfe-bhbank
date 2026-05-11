import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AutoRefreshInterval = '10000' | '30000' | '60000' | 'manual';

const STORAGE_KEY = 'autoRefreshInterval';
const DEFAULT_INTERVAL: AutoRefreshInterval = '30000';

@Injectable({
  providedIn: 'root'
})
export class AutoRefreshService {
  private readonly intervalSubject = new BehaviorSubject<AutoRefreshInterval>(this.loadInitialInterval());
  readonly interval$ = this.intervalSubject.asObservable();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) {
          this.intervalSubject.next(this.normalize(event.newValue));
        }
      });
    }
  }

  get interval(): AutoRefreshInterval {
    return this.intervalSubject.value;
  }

  get intervalMs(): number | null {
    return this.toMilliseconds(this.interval);
  }

  setInterval(value: AutoRefreshInterval | string): void {
    const interval = this.normalize(value);
    this.intervalSubject.next(interval);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, interval);
    }
  }

  toMilliseconds(value: AutoRefreshInterval): number | null {
    return value === 'manual' ? null : Number(value);
  }

  private loadInitialInterval(): AutoRefreshInterval {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_INTERVAL;
    }

    return this.normalize(localStorage.getItem(STORAGE_KEY));
  }

  private normalize(value: string | null): AutoRefreshInterval {
    return value === '10000' || value === '30000' || value === '60000' || value === 'manual'
      ? value
      : DEFAULT_INTERVAL;
  }
}
