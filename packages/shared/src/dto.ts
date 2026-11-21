import type { DigitsMode, DocumentStatus, Language, PaymentMethod } from "./schemas";

export interface InvoiceItemDto {
  id: number;
  position: number;
  name: string;
  code: string;
  qty: number;
  price: number;
  discount: number;
  notes: string;
  lineTotal: number;
}

export interface InvoiceDto {
  id: number;
  number: number;
  date: string;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  lang: Language;
  digitsMode: DigitsMode;
  itemInfo: string;
  materialsText: string;
  specialOffer: string;
  advancePercent: number;
  finalPercent: number;
  subtotal: number;
  total: number;
  advanceAmount: number;
  finalAmount: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  verifyCode: string;
  status: DocumentStatus;
  issuedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string;
  verifyCount: number;
  lastVerifiedAt: string | null;
  watermarkEnabled: boolean | null;
  items: InvoiceItemDto[];
}

export interface VoucherDto {
  id: number;
  number: number;
  date: string;
  invoiceId: number | null;
  receivedFrom: string;
  amount: number;
  amountWords: string;
  paymentFor: string;
  paymentMethod: PaymentMethod;
  preparedBy: string;
  receivedByName: string;
  approvedBy: string;
  lang: Language;
  digitsMode: DigitsMode;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  verifyCode: string;
  status: DocumentStatus;
  issuedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string;
  verifyCount: number;
  lastVerifiedAt: string | null;
  watermarkEnabled: boolean | null;
}

export interface CustomerDto {
  id: number;
  name: string;
  phone: string;
  address: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface InvoiceListItem extends Omit<InvoiceDto, "items" | "itemInfo" | "materialsText" | "specialOffer"> {
  itemCount: number;
}

export interface VoucherListItem extends VoucherDto {}
