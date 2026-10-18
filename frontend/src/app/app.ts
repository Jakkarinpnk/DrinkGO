import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './core/components/navbar/navbar';
import { SessionTimeoutService } from './core/services/session-timeout.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar],
  templateUrl: './app.html',
})
export class App {
  private readonly sessionTimeout = inject(SessionTimeoutService);
  protected readonly title = signal('drinkgo');
}
