import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type NotificationMode = 'enabled' | 'disabled';
export type NotificationSoundMode = 'enabled' | 'disabled';

const NOTIFICATIONS_KEY = 'notificationsEnabled';
const SOUND_KEY = 'notificationSound';

@Injectable({
  providedIn: 'root'
})
export class NotificationPreferencesService {
  private readonly notificationsSubject = new BehaviorSubject<NotificationMode>(
    this.loadMode(NOTIFICATIONS_KEY)
  );
  private readonly soundSubject = new BehaviorSubject<NotificationSoundMode>(
    this.loadMode(SOUND_KEY)
  );

  readonly notifications$ = this.notificationsSubject.asObservable();
  readonly sound$ = this.soundSubject.asObservable();

  get notifications(): NotificationMode {
    return this.notificationsSubject.value;
  }

  get sound(): NotificationSoundMode {
    return this.soundSubject.value;
  }

  setNotifications(mode: NotificationMode | string): void {
    const safeMode = this.normalize(mode);
    this.notificationsSubject.next(safeMode);
    this.save(NOTIFICATIONS_KEY, safeMode);
  }

  setSound(mode: NotificationSoundMode | string): void {
    const safeMode = this.normalize(mode);
    this.soundSubject.next(safeMode);
    this.save(SOUND_KEY, safeMode);
  }

  playAlertSound(): void {
    if (this.sound !== 'enabled' || typeof window === 'undefined') {
      return;
    }

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    try {
      const audio = new AudioContextClass();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audio.currentTime);
      oscillator.frequency.setValueAtTime(660, audio.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.28);

      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.3);
      oscillator.onended = () => audio.close();
    } catch {
      // Some browsers block audio before a user gesture; the next interaction will allow it.
    }
  }

  private loadMode(key: string): NotificationMode {
    if (typeof localStorage === 'undefined') {
      return 'enabled';
    }

    return this.normalize(localStorage.getItem(key));
  }

  private normalize(mode: string | null): NotificationMode {
    return mode === 'disabled' ? 'disabled' : 'enabled';
  }

  private save(key: string, mode: NotificationMode): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, mode);
    }
  }
}
