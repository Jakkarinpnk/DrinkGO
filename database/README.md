# DrinkGo database

The database is managed through ordered SQL migrations in `database/migrations`.

Run these commands from `backend`:

```bash
npm run db:migrate
npm run db:verify
npm run test:auth-smoke
npm run test:owner-application-smoke
```

The migration runner records applied files in `schema_migrations`. Never edit an applied migration;
add a new numbered migration for later changes.

## Active tables

Migration `018_redesign_auth_and_booking_schema.sql` removes the three session/audit tables,
renames the password reset and booking configuration tables, and adds booking-related data.
Migration `019_move_owner_approval_to_stores.sql` moves the current approval decision into
`stores.approval_status` and removes `owner_applications`. Migration
`021_remove_user_session_version.sql` removes session version tracking from member/owner accounts.
Migration `022_remove_admin_status_and_session_version.sql` removes administrator status and session
version tracking so all account types use the same stateless JWT lifecycle. Migration
`023_remove_report_response_admin.sql` removes administrator ownership from report responses.
Migration `024_replace_login_log_with_last_activity.sql` removes login history and adds the latest
user activity timestamp used by dashboard statistics. Migration `025_simplify_store_photo.sql`
renames the photo primary key to `photo_id` and removes unused photo metadata. Migration
`026_simplify_store_menu_files.sql` removes unused menu-file metadata. Migration
`027_remove_close_setting_booking_status.sql` makes every `close_setting` row represent a closed
booking date range. Migration `028_rename_close_setting_primary_key.sql` renames its primary key to
`close_setting_id`. Migration `029_simplify_booking_setting.sql` renames the booking-setting primary
key to `setting_id` and removes unused timing metadata. Migration
`030_simplify_password_resets.sql` keeps only OTP lifecycle data in `password_resets`; the second-step
reset permission is now a signed, password-bound token. Migration `031_remove_booking_tables.sql`
removes the unused booking-to-table junction table. Migration `035_add_booking_extra_tables.sql`
adds a small relation for additional tables in one reservation while keeping the twelve booking
columns unchanged. The active schema contains 16 tables:

- Accounts: `users`, `admins`, `password_resets`
- Stores: `stores`, `store_categories`, `store_photo`, `store_menu_files`
- Booking: `store_tables`, `setting`, `close_setting`, `booking`, `booking_extra_tables`, `promotion`
- Feedback: `reports`, `review`
- Migration history: `schema_migrations`

Migration `032_add_nightly_bookings.sql` introduced the first booking implementation. Migration
`033_match_booking_columns.sql` removes its extra columns and leaves exactly these twelve columns in
`booking`: `booking_id`, `user_id`, `store_id`, `table_id`, `booking_date`, `booking_time`,
`people_count`, `booking_price`, `total_price`, `status`, `slip_image`, `created_at`.
The `table_id` on `booking` is the first table; `booking_extra_tables` stores any additional table
IDs for the same reservation. `people_count` is the total number of guests across all selected tables.
Booking APIs and customer/owner pages are implemented. Promotion, report, and review remain schema only.

`booking_date` is the Bangkok calendar date on which the customer arrives. For stores closing after
midnight, the service night is calculated from `booking_date`, `booking_time`, and the store's opening
time. The store row is locked while booking or changing status; the service checks existing bookings
before inserting so concurrent API requests cannot reserve the same table for the same night.
Completed bookings still reserve the table; cancelled bookings release it. The earlier migration's
UTC arrival time was used to shift existing after-midnight bookings to their true arrival date.

New bookings are immediately `CONFIRMED`, with `booking_price` and `total_price` both zero and no
payment slip. A repeated identical request by the same user for the same table and night returns the
existing booking. Name and phone are read from the member profile rather than stored in `booking`.
Stores and tables with booking history cannot be deleted through the owner API; close/deactivate them
instead. See `docs/booking-system.md` for UI, API and validation details.

## Booking setup

`store_tables` stores each restaurant table and enforces a unique table number within one store.
Permanent table status is limited to `ACTIVE` or `INACTIVE`; nightly availability is calculated
from bookings for the selected service date. Each table may also store percentage-based `position_x` and `position_y`
coordinates for the store's single Layout image.

Each store can have one optional Layout image. Its URL is stored directly on the `stores` row;
the uploaded file is kept under `uploads/store-layouts`. Replacing or deleting the Layout does not
introduce another database table. Migration `020_keep_only_store_layout_image_url.sql` removes
the unused Layout file metadata columns.

`setting` has one row at most per store and holds the shared price, cancellation lead time,
enable switch, and policy text. `close_setting`
stores any number of closed booking date ranges for a store. All three tables are deleted
automatically when their parent store is deleted.

## Accounts

Public registration creates a `member` in `users`. When a store registration is approved, the same
account changes to `owner`; it keeps member capabilities and can manage only stores whose
`owner_user_id` matches its `user_id`.

Administrators are stored separately in `admins`, cannot register publicly, and remain active while
their row exists. The system has no
`login_type` column: `password_hash` enables local login and `google_id` enables Google login for a
user. `users.last_activity_at` is refreshed at most once per minute while a member or owner is active.
The dashboard treats an active account seen within the last five minutes as online and counts all
rows in `users` as total users. Administrators are excluded from both user statistics.

JWTs for members, owners, and administrators are stateless and valid until their configured expiry.
Logging out removes tokens from the current browser, but does not revoke copies held elsewhere.
Access tokens normally expire after 15 minutes and refresh tokens after seven days.

Password reset OTPs are stored only as hashes, expire after the configured interval, and lock after
five failed attempts. A successful OTP verification invalidates that OTP and returns a short-lived
signed reset token bound to the user's current password hash. Changing the password invalidates the
token, so reset-token metadata does not need to be stored in `password_resets`.

## Stores

Migration `034_expand_store_categories.sql` provides these store categories in display order:
`บาร์`, `ผับ`, `บาร์ไวท์`, `รูฟท็อปบาร์`, `ดราฟต์เบียร์`, `เลาน์จ`, `พื้นบ้าน`, `คาเฟ่`, and `อื่นๆ`.
It renames the old `อื่น ๆ` category and reassigns stores categorized as `ร้านอาหาร` to `อื่นๆ`
before deleting `ร้านอาหาร`.

`stores` contains the store model directly: owner, category, contact details, one combined
address, Google Maps URL, description, selected opening days, one opening time and one closing time
shared by those days, business license path, approval status, service status, and creation time.
`approval_status` is `PENDING`, `APPROVED`, or `REJECTED`; the separate `status` column tracks whether
the store is open, closed, suspended, or still awaiting a decision. The application endpoints use
`store_id` as their ID and return only the approval status, not review dates or reasons. Selected days are stored in
`open_days_mask` (Monday is bit 0 through Sunday as bit 6). Existing stores default to all seven days.
Province remains part of the combined `address` value so the existing province search and form
continue to work without adding another database column.

The combined `status` values are:

- `PENDING` — waiting for administrator review
- `OPEN` — approved and open for service
- `CLOSED` — approved and temporarily closed by the owner
- `REJECTED` — rejected application
- `SUSPENDED` — suspended by an administrator

Store deletion is permanent for the store row and cascades to its application, photos, and menu files.
The corresponding files on disk are removed after the database transaction succeeds.

## Photos and menus

The system has no shared `files` table. `store_photo` stores only `photo_id`, its store relation,
the image URL, and the cover selection; gallery order follows `photo_id`. `store_menu_files` stores
only its primary key, store relation, and file URL; menu order follows `menu_file_id`, and the UI
detects PDF or image files from their generated URL extension. The uploaded binaries remain in
`backend/uploads/store-images` and `backend/uploads/menu-files`.

Each store accepts up to 10 JPG, PNG or WebP images (5 MB each) and up to 10 PDF, JPG, PNG or WebP
menu files (10 MB each). File type and binary signature are validated before saving.

## Store locations and hours

Locations use an HTTPS Google Maps link; latitude, longitude, postal code, district, and subdistrict are
not stored. Registration and editing accept seven day entries through the API. Open days share the
same time and closed days contain no time. The database stores the shared `open_time` and `close_time`
once per store and stores selected weekdays compactly in `open_days_mask`.
