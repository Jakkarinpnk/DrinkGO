import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SearchDropdownOption { label: string; value: string | number; }

@Component({
  selector: 'app-search-dropdown', standalone: true, imports: [CommonModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchDropdown), multi: true }],
  template: `
    <button class="dropdown-trigger" type="button" [attr.aria-label]="ariaLabel" aria-haspopup="listbox"
      [attr.aria-expanded]="isOpen" (click)="toggle()" (keydown.escape)="close()" [disabled]="disabled">
      <span [class.placeholder]="!hasSelection">{{ selectedLabel }}</span>
      <span class="material-icons arrow" aria-hidden="true">expand_more</span>
    </button>
    <div class="dropdown-panel" role="listbox" *ngIf="isOpen" [attr.aria-label]="ariaLabel">
      <button type="button" class="dropdown-option" role="option" *ngFor="let option of options"
        [class.selected]="sameValue(option.value, value)" [attr.aria-selected]="sameValue(option.value, value)"
        (click)="select(option.value)">
        <span>{{ option.label }}</span><span class="material-icons" *ngIf="sameValue(option.value, value)">check</span>
      </button>
    </div>`,
  styles: [`
    :host { position: relative; display: block; width: 100%; min-width: 0; }
    .dropdown-trigger { display: flex; width: 100%; min-height: 54px; align-items: center; justify-content: space-between; gap: 10px; padding: 0 15px 0 12px; border: 0; outline: 0; color: #172033; background: transparent; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
    .dropdown-trigger:focus-visible { border-radius: 8px; box-shadow: inset 0 0 0 2px #60a5fa; }
    .dropdown-trigger:disabled { cursor: default; opacity: .65; }
    .placeholder { color: #475569; }
    .arrow { color: #64748b; font-size: 21px; transition: transform .18s ease; }
    [aria-expanded=true] .arrow { transform: rotate(180deg); }
    .dropdown-panel { position: absolute; z-index: 20; top: calc(100% + 10px); right: 0; left: -52px; min-width: 220px; max-height: 270px; overflow-y: auto; padding: 7px; border: 1px solid #dce7f3; border-radius: 12px; background: #fff; box-shadow: 0 16px 36px rgb(15 70 120 / 18%); }
    .dropdown-option { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 0; border-radius: 8px; color: #334155; background: transparent; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
    .dropdown-option:hover, .dropdown-option:focus-visible { outline: 0; color: #075f9f; background: #eef8ff; }
    .dropdown-option.selected { color: #075f9f; background: #e3f3ff; font-weight: 700; }
    .dropdown-option .material-icons { color: #0875c9; font-size: 18px; }
    @media(max-width:700px) { .dropdown-panel { left: -48px; } }
  `],
})
export class SearchDropdown implements ControlValueAccessor {
  @Input() options: SearchDropdownOption[] = [];
  @Input() placeholder = 'เลือก';
  @Input() ariaLabel = 'ตัวเลือก';
  @Input() emptyValue: string | number = '';
  @Output() selectionChange = new EventEmitter<void>();
  private readonly element = inject(ElementRef<HTMLElement>);
  value: string | number = ''; isOpen = false; disabled = false;
  private onChange: (value: string | number) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get hasSelection(): boolean { return !this.sameValue(this.value, this.emptyValue); }
  get selectedLabel(): string { return this.options.find(option => this.sameValue(option.value, this.value))?.label || this.placeholder; }
  sameValue(a: string | number, b: string | number): boolean { return String(a) === String(b); }
  writeValue(value: string | number | null): void { this.value = value ?? this.emptyValue; }
  registerOnChange(fn: (value: string | number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
  toggle(): void { if (!this.disabled) this.isOpen = !this.isOpen; }
  close(): void { this.isOpen = false; }
  select(value: string | number): void { this.value = value; this.onChange(value); this.onTouched(); this.close(); this.selectionChange.emit(); }
  @HostListener('document:click', ['$event']) onDocumentClick(event: Event): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.close();
  }
}
