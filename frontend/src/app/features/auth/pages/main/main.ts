import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StoreService } from '../../../../core/services/store.service';
import { StoreCategory, StoreLocation, StoreSearch, StoreServiceStatus, StoreSummary } from '../../../../shared/models/user.model';
import { storeImageUrl } from '../../../../shared/store-image-url';
import { StoreHoursDisplay } from '../../../../shared/components/store-hours-display/store-hours-display';
import { SearchDropdown, SearchDropdownOption } from './search-dropdown';

@Component({
    selector: 'app-main',
    standalone: true,
    imports: [CommonModule, RouterModule, ReactiveFormsModule, StoreHoursDisplay, SearchDropdown],
    templateUrl: './main.html',
    styleUrls: ['./main.css']
})
export class Main implements OnInit {
    readonly imageUrl = storeImageUrl;
    restaurants: StoreSummary[] = [];
    isLoadingStores = true;
    storeError = '';
    categories: StoreCategory[] = [];
    locations: StoreLocation[] = [];
    categoryError = '';
    locationError = '';
    categoryOptions: SearchDropdownOption[] = [];
    locationOptions: SearchDropdownOption[] = [];
    readonly searchForm = inject(FormBuilder).nonNullable.group({ name: '', categoryId: 0, location: '' });
    appliedSearch: StoreSearch = {};
    private readonly destroyRef = inject(DestroyRef);
    private storesRequest?: Subscription;

    private storeService = inject(StoreService);
    private changeDetector = inject(ChangeDetectorRef);

    ngOnInit(): void {
        this.loadApprovedStores();
        this.loadCategories();
        this.loadLocations();
        this.searchForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            const value = this.searchForm.getRawValue();
            if (this.hasSearch && !value.name.trim() && !value.location.trim() && !value.categoryId) {
                this.appliedSearch = {};
                this.loadApprovedStores();
            }
        });
    }

    loadLocations(): void {
        this.locationError = '';
        this.storeService.locations().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: locations => { this.locations = locations; this.locationOptions = locations; this.changeDetector.markForCheck(); },
            error: () => { this.locationError = 'โหลดรายการสถานที่ไม่สำเร็จ'; this.changeDetector.markForCheck(); },
        });
    }

    loadCategories(): void {
        this.categoryError = '';
        this.storeService.categories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: categories => { this.categories = categories; this.categoryOptions = categories.map(category => ({ label: category.name, value: category.id })); this.changeDetector.markForCheck(); },
            error: () => { this.categoryError = 'โหลดประเภทร้านไม่สำเร็จ'; this.changeDetector.markForCheck(); },
        });
    }

    searchStores(): void {
        const value = this.searchForm.getRawValue();
        this.appliedSearch = { name: value.name.trim(), location: value.location.trim(), categoryId: value.categoryId || undefined };
        if (!this.hasSearch) this.appliedSearch = {};
        this.loadApprovedStores();
    }

    clearSearch(): void {
        this.searchForm.reset(undefined, { emitEvent: false });
        this.appliedSearch = {};
        this.loadApprovedStores();
    }

    get hasSearch(): boolean { return !!(this.appliedSearch.name || this.appliedSearch.location || this.appliedSearch.categoryId); }

    loadApprovedStores(): void {
        this.storesRequest?.unsubscribe();
        this.isLoadingStores = true;
        this.storeError = '';

        this.storesRequest = this.storeService.listApproved(this.appliedSearch).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (stores) => {
                this.restaurants = stores;
                this.isLoadingStores = false;
                this.changeDetector.markForCheck();
            },
            error: () => {
                this.storeError = 'ไม่สามารถโหลดรายการร้านค้าได้ กรุณาลองใหม่อีกครั้ง';
                this.isLoadingStores = false;
                this.changeDetector.markForCheck();
            },
        });
    }

    getLocation(shop: StoreSummary): string {
        return shop.province || 'ยังไม่ระบุสถานที่';
    }

    getServiceStatusLabel(status: StoreServiceStatus): string {
        const labels: Record<StoreServiceStatus, string> = {
            OPEN: 'เปิดให้บริการ',
            CLOSED_TEMPORARILY: 'ปิดชั่วคราว',
            CLOSED_PERMANENTLY: 'ปิดถาวร',
        };
        return labels[status];
    }

}
