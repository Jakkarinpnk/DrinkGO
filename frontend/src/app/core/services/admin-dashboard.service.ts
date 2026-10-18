import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminStoreStatistics, ApiResponse } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  constructor(private readonly http: HttpClient) {}

  storeStatistics(): Observable<AdminStoreStatistics> {
    return this.http
      .get<ApiResponse<AdminStoreStatistics>>(`${environment.apiUrl}/admin/dashboard/statistics`)
      .pipe(map(response => response.data));
  }
}
