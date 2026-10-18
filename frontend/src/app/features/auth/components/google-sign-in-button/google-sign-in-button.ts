import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { environment } from '../../../../../environments/environment';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }): void;
      renderButton(element: HTMLElement, options: {
        theme: 'outline';
        size: 'large';
        width: number;
      }): void;
    };
  };
}

@Component({
  selector: 'app-google-sign-in-button',
  standalone: true,
  template: '<div #buttonHost></div>',
})
export class GoogleSignInButton implements AfterViewInit, OnDestroy {
  @Output() success = new EventEmitter<string>();
  @Output() error = new EventEmitter<string>();
  @ViewChild('buttonHost', { static: true }) private buttonHost!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);
  private sdkPoll: number | null = null;
  private sdkScript: HTMLScriptElement | null = null;
  private initialized = false;
  private destroyed = false;

  private readonly onScriptError = (): void => {
    this.stopWaiting();
    this.zone.run(() => this.error.emit('ไม่สามารถโหลดปุ่ม Google ได้ กรุณาลองใหม่'));
  };

  ngAfterViewInit(): void {
    if (this.renderButton()) return;

    this.sdkScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    this.sdkScript?.addEventListener('error', this.onScriptError, { once: true });
    this.sdkPoll = window.setInterval(() => {
      if (this.renderButton()) this.stopWaiting();
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopWaiting();
  }

  private stopWaiting(): void {
    if (this.sdkPoll !== null) {
      window.clearInterval(this.sdkPoll);
      this.sdkPoll = null;
    }
    this.sdkScript?.removeEventListener('error', this.onScriptError);
    this.sdkScript = null;
  }

  private renderButton(): boolean {
    if (this.initialized || this.destroyed) return true;

    const google = (window as Window & { google?: GoogleIdentity }).google;
    if (!google?.accounts?.id) return false;

    try {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response) => {
          if (this.destroyed) return;
          this.zone.run(() => {
            if (response.credential) this.success.emit(response.credential);
            else this.error.emit('ไม่ได้รับ Google ID Token กรุณาลองใหม่');
          });
        },
      });
      google.accounts.id.renderButton(this.buttonHost.nativeElement, {
        theme: 'outline',
        size: 'large',
        width: 250,
      });
      this.initialized = true;
    } catch {
      this.zone.run(() => this.error.emit('ไม่สามารถแสดงปุ่ม Google ได้ กรุณาลองใหม่'));
    }

    return true;
  }
}
