import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiMessageResponse, ApiResponse, OwnedStoreDetail, OwnedStoreSummary, PublicStoreDetail, StoreCategory, StoreImageChanges, StoreLayout, StoreLayoutTableInput, StoreLocation, StoreSearch, StoreSummary, StoreTable, StoreTableInput, StoreUpdateRequest } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class StoreService {
  constructor(private readonly http: HttpClient) {}
  categories(): Observable<StoreCategory[]> { return this.http.get<ApiResponse<StoreCategory[]>>(`${environment.apiUrl}/store-categories`).pipe(map(response => response.data)); }
  locations(): Observable<StoreLocation[]> { return this.http.get<ApiResponse<StoreLocation[]>>(`${environment.apiUrl}/store-locations`).pipe(map(response => response.data)); }

  listApproved(search: StoreSearch = {}): Observable<StoreSummary[]> {
    let params = new HttpParams();
    if (search.name?.trim()) params = params.set('name', search.name.trim());
    if (search.location?.trim()) params = params.set('location', search.location.trim());
    if (search.categoryId) params = params.set('categoryId', search.categoryId);
    return this.http
      .get<ApiResponse<StoreSummary[]>>(`${environment.apiUrl}/stores`, { params })
      .pipe(map((response) => response.data));
  }

  getApproved(id: number): Observable<PublicStoreDetail> {
    return this.http.get<ApiResponse<PublicStoreDetail>>(`${environment.apiUrl}/stores/${id}`)
      .pipe(map(response => response.data));
  }

  listMine(): Observable<OwnedStoreSummary[]> {
    return this.http
      .get<ApiResponse<OwnedStoreSummary[]>>(`${environment.apiUrl}/owner/stores`)
      .pipe(map((response) => response.data));
  }

  update(id: number, input: StoreUpdateRequest): Observable<OwnedStoreSummary> {
    return this.http.put<ApiResponse<OwnedStoreSummary>>(`${environment.apiUrl}/owner/stores/${id}`, input)
      .pipe(map(response => response.data));
  }

  delete(id: number): Observable<ApiMessageResponse> {
    return this.http.delete<ApiMessageResponse>(`${environment.apiUrl}/owner/stores/${id}`);
  }

  getMine(id: number): Observable<OwnedStoreDetail> {
    return this.http.get<ApiResponse<OwnedStoreDetail>>(`${environment.apiUrl}/owner/stores/${id}`)
      .pipe(map(response => response.data));
  }

  updateWithImages(id: number, input: StoreUpdateRequest, changes: StoreImageChanges): Observable<OwnedStoreDetail> {
    const form = new FormData();
    Object.entries(input).forEach(([key, value]) => form.append(key, key === 'hours' ? JSON.stringify(value) : value == null ? '' : String(value)));
    form.append('removedImageIds', JSON.stringify(changes.removedImageIds));
    form.append('removedMenuFileIds', JSON.stringify(changes.removedMenuFileIds));
    if (changes.coverImageId !== undefined) form.append('coverImageId', String(changes.coverImageId));
    if (changes.newCoverIndex !== undefined) form.append('newCoverIndex', String(changes.newCoverIndex));
    changes.images.forEach(image => form.append('images', image));
    changes.menuFiles.forEach(file => form.append('menuFiles', file));
    return this.http.put<ApiResponse<OwnedStoreDetail>>(`${environment.apiUrl}/owner/stores/${id}`, form)
      .pipe(map(response => response.data));
  }

  listTables(storeId: number): Observable<StoreTable[]> {
    return this.http.get<ApiResponse<StoreTable[]>>(`${environment.apiUrl}/owner/stores/${storeId}/tables`)
      .pipe(map(response => response.data));
  }

  createTable(storeId: number, input: StoreTableInput): Observable<StoreTable> {
    return this.http.post<ApiResponse<StoreTable>>(`${environment.apiUrl}/owner/stores/${storeId}/tables`, input)
      .pipe(map(response => response.data));
  }

  updateTable(storeId: number, tableId: number, input: StoreTableInput): Observable<StoreTable> {
    return this.http.put<ApiResponse<StoreTable>>(`${environment.apiUrl}/owner/stores/${storeId}/tables/${tableId}`, input)
      .pipe(map(response => response.data));
  }

  deleteTable(storeId: number, tableId: number): Observable<ApiMessageResponse> {
    return this.http.delete<ApiMessageResponse>(`${environment.apiUrl}/owner/stores/${storeId}/tables/${tableId}`);
  }

  getLayout(storeId: number): Observable<StoreLayout> {
    return this.http.get<ApiResponse<StoreLayout>>(`${environment.apiUrl}/owner/stores/${storeId}/layout`)
      .pipe(map(response => response.data));
  }

  saveLayoutImage(storeId: number, image: File): Observable<StoreLayout> {
    const form = new FormData();
    form.append('layout', image);
    return this.http.put<ApiResponse<StoreLayout>>(`${environment.apiUrl}/owner/stores/${storeId}/layout/image`, form)
      .pipe(map(response => response.data));
  }

  deleteLayoutImage(storeId: number): Observable<StoreLayout> {
    return this.http.delete<ApiResponse<StoreLayout>>(`${environment.apiUrl}/owner/stores/${storeId}/layout/image`)
      .pipe(map(response => response.data));
  }

  saveLayoutTables(storeId: number, tables: StoreLayoutTableInput[]): Observable<StoreLayout> {
    return this.http.put<ApiResponse<StoreLayout>>(`${environment.apiUrl}/owner/stores/${storeId}/layout/tables`, { tables })
      .pipe(map(response => response.data));
  }
}
