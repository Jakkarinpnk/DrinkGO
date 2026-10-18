import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Booking {
  id: number; code: string; storeId: number; storeName: string; storePhone: string;
  coverImageUrl?: string | null; storeCloseTime?: string | null;
  tableId: number | null; tableNumber: string; tableCount?: number; serviceDate: string; arrivalAt: string | null;
  arrivalTime: string; peopleCount: number; contactName: string | null; contactPhone: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  cancellationDeadline: string | null; canCancel: boolean; canComplete: boolean;
}
export interface BookingInput {
  storeId: number; tableIds: number[]; serviceDate: string; arrivalTime: string; peopleCount: number;
}
export interface BookingTable {
  id: number; tableNumber: string; seatCapacity: number; positionX: number | null; positionY: number | null;
  state: 'AVAILABLE' | 'BOOKED' | 'INACTIVE' | 'TOO_SMALL';
}
export interface Availability {
  storeId: number; storeName: string; serviceDate: string; openTime: string; closeTime: string;
  layoutImageUrl: string | null; cancelBeforeDays: number; bookingPolicy: string | null;
  cancellationPolicy: string | null; tables: BookingTable[];
}

export function bangkokDate(offsetDays = 0): string {
  return new Date(Date.now() + 7 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;
  availability(storeId: number, date: string, peopleCount: number) {
    return this.http.get<{ data: Availability }>(`${this.url}/stores/${storeId}/availability`, { params: { date, peopleCount } }).pipe(map(r => r.data));
  }
  create(input: BookingInput) {
    return this.http.post<{ data: Booking }>(`${this.url}/bookings`, input).pipe(map(r => r.data));
  }
  mine() { return this.http.get<{ data: Booking[] }>(`${this.url}/bookings/mine`).pipe(map(r => r.data)); }
  owned(storeId: number, date: string) {
    return this.http.get<{ data: { storeName: string; bookings: Booking[] } }>(`${this.url}/owner/stores/${storeId}/bookings`, { params: { date } }).pipe(map(r => r.data));
  }
  cancel(id: number) { return this.http.patch<{ data: Booking }>(`${this.url}/bookings/${id}/cancel`, {}).pipe(map(r => r.data)); }
  update(storeId: number, id: number, status: 'CANCELLED' | 'COMPLETED') {
    return this.http.patch<{ data: Booking }>(`${this.url}/owner/stores/${storeId}/bookings/${id}/status`, { status }).pipe(map(r => r.data));
  }
}
