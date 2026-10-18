import { Injectable, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const LAST_ACTIVITY_KEY = 'sessionLastActivityAt';
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['click', 'keydown', 'scroll', 'touchstart'];
const STORAGE_WRITE_INTERVAL_MS = 5_000;
const ACTIVITY_SYNC_INTERVAL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class SessionTimeoutService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly timeoutMs = environment.sessionIdleTimeoutMinutes * 60 * 1000;
  private readonly authSubscription: Subscription;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastActivityAt = 0;
  private lastPersistedAt = 0;
  private lastSyncedAt = 0;
  private tracking = false;
  private expiring = false;

  private readonly handleActivity = (): void => {
    if (!this.tracking || this.expiring) return;
    const now = Date.now();
    if (now - this.lastActivityAt >= this.timeoutMs) {
      this.expireSession();
      return;
    }
    this.lastActivityAt = now;
    if (now - this.lastPersistedAt >= STORAGE_WRITE_INTERVAL_MS) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      this.lastPersistedAt = now;
    }
    if (now - this.lastSyncedAt >= ACTIVITY_SYNC_INTERVAL_MS) this.syncActivity(now);
    this.scheduleTimeout();
  };

  private readonly handleVisibility = (): void => {
    if (document.visibilityState === 'visible') this.checkExpiration();
  };

  private readonly handleStorage = (event: StorageEvent): void => {
    if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
      const timestamp = Number(event.newValue);
      if (Number.isFinite(timestamp) && timestamp > this.lastActivityAt) {
        this.lastActivityAt = timestamp;
        this.lastPersistedAt = timestamp;
        this.scheduleTimeout();
      }
    }
  };

  constructor() {
    this.authSubscription = this.auth.currentUser$.subscribe((user) => {
      if (user) this.startTracking();
      else this.stopTracking();
    });
  }

  ngOnDestroy(): void {
    this.stopTracking();
    this.authSubscription.unsubscribe();
  }

  private startTracking(): void {
    if (this.tracking) return;
    this.tracking = true;
    this.expiring = false;
    const storedActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    this.lastActivityAt = Number.isFinite(storedActivity) && storedActivity > 0 ? storedActivity : Date.now();
    this.lastPersistedAt = this.lastActivityAt;
    localStorage.setItem(LAST_ACTIVITY_KEY, String(this.lastActivityAt));
    this.syncActivity(this.lastActivityAt);
    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, this.handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('storage', this.handleStorage);
    this.checkExpiration();
  }

  private stopTracking(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = null;
    if (!this.tracking) return;
    this.tracking = false;
    ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, this.handleActivity));
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('storage', this.handleStorage);
  }

  private checkExpiration(): void {
    if (!this.tracking || this.expiring) return;
    if (Date.now() - this.lastActivityAt >= this.timeoutMs) {
      this.expireSession();
    } else {
      this.scheduleTimeout();
    }
  }

  private scheduleTimeout(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    const remaining = Math.max(0, this.timeoutMs - (Date.now() - this.lastActivityAt));
    this.timeoutId = setTimeout(() => this.checkExpiration(), remaining);
  }

  private syncActivity(timestamp: number): void {
    this.lastSyncedAt = timestamp;
    this.auth.recordActivity();
  }

  private expireSession(): void {
    if (this.expiring) return;
    this.expiring = true;
    const returnUrl = this.router.url.startsWith('/auth/') ? '/' : this.router.url;
    this.auth.logout();
    void this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl },
    });
  }
}
