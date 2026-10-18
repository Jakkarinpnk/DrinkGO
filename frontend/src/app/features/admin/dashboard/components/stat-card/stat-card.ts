import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-admin-stat-card',
  standalone: true,
  templateUrl: './stat-card.html',
  styleUrls: ['./stat-card.css'],
})
export class AdminStatCard {
  @Input({ required: true }) label = '';
  @Input({ required: true }) icon = 'analytics';
  @Input() value: string | number = '—';
}
