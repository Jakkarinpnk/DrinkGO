export type Role = 'member' | 'owner' | 'admin';

export interface User {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  profileImageUrl: string | null;
  role: Role;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
}

export interface ApiMessageResponse {
  message: string;
}

export interface AdminStoreStatistics {
  onlineUsers: number;
  totalUsers: number;
  totalStores: number;
  pendingStores: number;
  approvedStores: number;
}

export interface ApiErrorResponse {
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AuthenticationData {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type AuthResponse = ApiResponse<AuthenticationData>;
export type UserResponse = ApiResponse<User>;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone: string | null;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
}


export interface VerifyResetOtpRequest {
  email: string;
  otp: string;
}

export interface PasswordResetToken {
  resetToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  email: string;
  fullName: string;
  phone: string | null;
  profileImage?: File;
}

export type OwnerApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type BusinessDocumentType = 'COMMERCIAL_REGISTRATION' | 'OTHER';

export interface OwnerApplication {
  id: number;
  status: OwnerApplicationStatus;
  applicant: {
    id: number;
    fullName: string;
    email: string;
    phone: string | null;
    role: Role;
  };
  store: Partial<StoreOperations> & {
    id: number;
    name: string;
    description: string | null;
    phone: string;
    lineUrl: string;
    addressLine: string;
    province: string;
    googleMapUrl: string;
    coverImageUrl: string | null;
    images: StoreImage[];
    menuFiles: MenuFile[];
  };
  document: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    documentType: BusinessDocumentType;
  };
}

export interface OwnerApplicationRequest extends StoreOperationsInput {
  storeName: string;
  description: string;
  storePhone: string;
  lineUrl: string;
  addressLine: string;
  province: string;
  googleMapUrl: string;
  documentType: BusinessDocumentType;
  businessDocument: File;
  images: File[];
  menuFiles: File[];
  newCoverIndex?: number;
}

export type StoreServiceStatus = 'OPEN' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
export type StoreApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface StoreSearch { name?: string; categoryId?: number; location?: string; }
export interface StoreLocation { label: string; value: string; }

export interface StoreSummary extends Partial<StoreOperations> {
  id: number;
  name: string;
  description: string | null;
  province: string;
  googleMapUrl: string;
  serviceStatus: StoreServiceStatus;
  coverImageUrl?: string | null;
}

export interface PublicStoreDetail extends StoreSummary {
  phone: string;
  lineUrl: string;
  addressLine: string;
  images: StoreImage[];
  menuFiles: MenuFile[];
  layout: PublicStoreLayout;
}

export interface PublicLayoutTable {
  id: number;
  tableNumber: string;
  seatCapacity: number;
  positionX: number;
  positionY: number;
  layoutStatus: LayoutBookingStatus;
}
export interface PublicStoreLayout { imageUrl: string | null; tables: PublicLayoutTable[]; }

export interface OwnedStoreSummary extends StoreSummary {
  phone: string;
  lineUrl: string;
  addressLine: string;
  approvalStatus: StoreApprovalStatus;
}

export type StoreUpdateRequest = Pick<OwnedStoreSummary,
  'name' | 'description' | 'phone' | 'lineUrl' | 'addressLine' |
  'province' | 'googleMapUrl' | 'serviceStatus'> & StoreOperationsInput;

export interface StoreImage { id: number; url: string; altText: string | null; isCover: boolean; }
export interface MenuFile { id: number; url: string; }
export interface OwnedStoreDetail extends OwnedStoreSummary { images: StoreImage[]; menuFiles: MenuFile[]; }
export interface StoreImageChanges { images: File[]; removedImageIds: number[]; menuFiles: File[]; removedMenuFileIds: number[]; coverImageId?: number; newCoverIndex?: number; }

export interface StoreCategory { id: number; name: string; }
export interface StoreHour { dayOfWeek: number; isClosed: boolean; openTime: string | null; closeTime: string | null; closesNextDay: boolean; }
export interface StoreOperations { category: StoreCategory | null; hours: StoreHour[]; }
export interface StoreOperationsInput { categoryId: number; hours: StoreHour[]; }

export type StoreTableStatus = 'ACTIVE' | 'INACTIVE';
export interface StoreTable {
  id: number;
  storeId: number;
  tableNumber: string;
  seatCapacity: number;
  status: StoreTableStatus;
  positionX: number | null;
  positionY: number | null;
  createdAt: string;
}
export interface StoreTableInput {
  tableNumber: string;
  seatCapacity: number;
  status: StoreTableStatus;
}

export type LayoutBookingStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'PENDING_PAYMENT' | 'BOOKED';
export interface StoreLayoutTable {
  id: number;
  tableNumber: string;
  seatCapacity: number;
  status: StoreTableStatus;
  positionX: number | null;
  positionY: number | null;
  layoutStatus: LayoutBookingStatus;
}
export interface StoreLayout {
  storeId: number;
  imageUrl: string | null;
  tables: StoreLayoutTable[];
}
export interface StoreLayoutTableInput {
  id: number;
  positionX: number | null;
  positionY: number | null;
  status: StoreTableStatus;
}
