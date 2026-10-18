import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  OwnerApplication,
  OwnerApplicationRequest,
  OwnerApplicationStatus,
} from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class OwnerApplicationService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  submit(request: OwnerApplicationRequest): Observable<OwnerApplication> {
    const formData = new FormData();
    formData.append('storeName', request.storeName);
    formData.append('description', request.description);
    formData.append('storePhone', request.storePhone);
    formData.append('lineUrl', request.lineUrl);
    formData.append('addressLine', request.addressLine);
    formData.append('province', request.province);
    formData.append('googleMapUrl', request.googleMapUrl);
    formData.append('documentType', request.documentType);
    formData.append('categoryId', String(request.categoryId));
    formData.append('hours', JSON.stringify(request.hours));
    formData.append('businessDocument', request.businessDocument);
    request.images.forEach(image => formData.append('images', image));
    request.menuFiles.forEach(file => formData.append('menuFiles', file));
    if (request.newCoverIndex !== undefined) formData.append('newCoverIndex', String(request.newCoverIndex));

    return this.http
      .post<ApiResponse<OwnerApplication>>(`${this.apiUrl}/owner-applications`, formData)
      .pipe(map((response) => response.data));
  }

  getStatus(): Observable<OwnerApplication | null> {
    return this.http
      .get<ApiResponse<OwnerApplication | null>>(`${this.apiUrl}/owner-applications/status`)
      .pipe(map((response) => response.data));
  }

  list(status?: OwnerApplicationStatus): Observable<OwnerApplication[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http
      .get<ApiResponse<OwnerApplication[]>>(`${this.apiUrl}/admin/owner-applications`, { params })
      .pipe(map((response) => response.data));
  }

  review(
    applicationId: number,
    status: Exclude<OwnerApplicationStatus, 'PENDING'>,
  ): Observable<OwnerApplication> {
    return this.http
      .patch<ApiResponse<OwnerApplication>>(
        `${this.apiUrl}/admin/owner-applications/${applicationId}/status`,
        { status },
      )
      .pipe(map((response) => response.data));
  }

  downloadDocument(applicationId: number): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/admin/owner-applications/${applicationId}/document`,
      { responseType: 'blob' },
    );
  }
}
