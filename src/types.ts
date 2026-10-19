export type Language = 'en' | 'bn';

export type ServiceCategory =
  | 'GRAPHIC DESIGN'
  | 'PRINTING & PACKAGING'
  | 'DIGITAL PRINTING'
  | 'SIGN MAKING & LETTERING'
  | 'BRANDED PROMOTIONAL GIFTS'
  | 'EXHIBITION'
  | 'EVENTS MANAGEMENT'
  | 'VENUE SOURCING'
  | string;

export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  description?: string;
  isRawMaterial?: boolean;
  isRawMaterialGroup?: boolean;
}

export type LocationType = 'Factory' | 'Office' | 'Both';

export type UnitType = 'pcs' | 'sqft' | 'ream' | 'roll' | 'ltr' | 'box' | 'set' | 'job' | 'pack';

export interface CompanyServiceCapability {
  id: string;
  titleEn: string;
  titleBn: string;
  descEn: string;
  descBn: string;
  iconName?: string;
  color?: string;
  badge?: string;
}

export interface CompanyPremise {
  id: string;
  unitBadge: string;
  name: string;
  nameBn?: string;
  address: string;
  description: string;
  phone?: string;
  unitType?: 'Factory' | 'Office' | 'Warehouse' | 'Branch' | string;
}

export interface CompanyProfile {
  name: string;
  nameBn: string;
  tagline: string;
  taglineBn: string;
  category: string;
  showTagline?: boolean;
  showCategory?: boolean;
  experienceYears: number;
  phone: string;
  emails: string[];
  facebook: string;
  factoryAddress: string;
  officeAddress: string;
  currency: string;
  currencySymbol: string;
  vatTaxNumber?: string;
  tradeLicense?: string;
  website?: string;
  logoUrl?: string;
  qrCodeValue?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountTitle?: string;
  bankBranch?: string;
  routingNumber?: string;
  bkashNagadNumber?: string;
  nagadNumber?: string;
  rocketNumber?: string;
  bankingNotes?: string;
  paymentGatewayProvider?: 'none' | 'sslcommerz' | 'bkash_pgw' | 'shurjopay' | 'aamarpay';
  paymentGatewayMode?: 'sandbox' | 'live';
  paymentGatewayStoreId?: string;
  paymentGatewayApiKey?: string;
  paymentGatewaySecret?: string;
  paymentGatewayIsEnabled?: boolean;
  padTopMarginMm?: number;
  
  // Dynamic Factory Details
  factoryUnitBadge?: string;
  factoryName?: string;
  factoryNameBn?: string;
  factoryDescription?: string;
  factoryPhone?: string;

  // Dynamic Corporate Office Details
  officeUnitBadge?: string;
  officeName?: string;
  officeNameBn?: string;
  officeDescription?: string;
  officePhone?: string;

  // Dynamic Specialized Services Section
  servicesSectionTitle?: string;
  servicesSectionTitleBn?: string;
  servicesSectionSubtitle?: string;
  servicesSectionSubtitleBn?: string;
  servicesCapabilities?: CompanyServiceCapability[];

  // Dynamic Additional Branches / Premises
  customPremises?: CompanyPremise[];

  // Dynamic Footer & Copyright Customization
  footerBrandText?: string;
  footerCopyrightText?: string;
  footerPoweredByText?: string;
  footerPoweredByUrl?: string;
  footerHotline?: string;
  footerShowPoweredBy?: boolean;
}

export interface ProductItem {
  id: string;
  code: string;
  name: string;
  nameBn?: string;
  category: ServiceCategory | 'RAW MATERIAL';
  isRawMaterial: boolean;
  unit: UnitType;
  unitPrice: number; // Selling price
  costPrice: number; // Purchase / Production cost
  stockFactory: number;
  stockOffice: number;
  minStockAlert: number;
  description?: string;
}

export type Product = ProductItem;

export interface Customer {
  id: string;
  name: string;
  code?: string;
  company?: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchased: number;
  dueAmount: number;
  advanceBalance?: number;
  createdAt: string;
}

export interface VendorBankAccount {
  bankName: string;
  accountNumber: string;
  accountName?: string;
  branchName?: string;
}

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  category?: string;
  suppliedItems?: string[];
  totalPurchased: number;
  dueAmount: number;
  balancePayable?: number;
  bankAccountNumber?: string;
  bankName?: string;
  bankAccounts?: VendorBankAccount[];
}

export interface InvoiceItem {
  productId: string;
  name: string;
  category: string;
  region?: string;
  type?: string;
  itemType?: string;
  unit: UnitType;
  unitPrice: number;
  costPrice: number;
  qty: number;
  width?: number; // for sqft calculations
  height?: number; // for sqft calculations
  totalSqft?: number;
  totalPrice: number;
  notes?: string;
}

export type ProductionStatus =
  | 'Queued'
  | 'Designing'
  | 'In Print / Fabrication'
  | 'Finishing'
  | 'Ready'
  | 'Delivered';

export type PaymentMethodType = 'cash' | 'bank' | 'mfs' | 'gateway' | 'cheque' | 'other';

export interface PaymentMethodConfig {
  id: string;
  name: string;
  nameBn?: string;
  type: PaymentMethodType;
  accountNumber?: string;
  accountTitle?: string;
  bankName?: string;
  branchName?: string;
  routingNumber?: string;
  provider?: 'sslcommerz' | 'bkash_pgw' | 'shurjopay' | 'aamarpay' | 'other' | string;
  gatewayMode?: 'sandbox' | 'live';
  storeId?: string;
  secretKey?: string;
  notes?: string;
  chargePercent?: number;
  linkedAccountId?: string;
  isEnabled: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

export type PaymentMethod = string;

export type PaymentStatus = 'Paid' | 'Partial' | 'Due';

export interface SalesInvoice {
  id: string;
  invoiceNo: string;
  referenceNo?: string;
  purchaseRequisition?: string;
  prNo?: string;
  date: string;
  deliveryDate?: string;
  customerId: string;
  customerName: string;
  customerCompany?: string;
  customerPhone: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  vatRate: number; // percentage (e.g. 5% or 7.5%)
  vatAmount: number;
  vatType?: 'amount' | 'percent';
  vatValue?: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  productionStatus: ProductionStatus;
  warehouseLocation: 'Factory' | 'Office';
  notes?: string;
  jobSpecs?: string;
  salesPerson?: string;
  staffId?: string;
  staffName?: string;
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  splitPayments?: {
    cash?: number;
    card?: number;
    bkash?: number;
    nagad?: number;
    due?: number;
    [key: string]: number | undefined;
  };
  isQuote?: boolean;
  showRegionColumn?: boolean;
  showTypeColumn?: boolean;
  projectId?: string;
  projectCode?: string;
  chartOfAccountId?: string;
  skipLedgerTransaction?: boolean;
}

export const PRESET_INVOICE_ITEM_TYPES = [
  'Dealer New',
  'Dealer repair',
  'Traders New',
  'Project Sign',
] as const;

export interface Quotation {
  id: string;
  quoteNo: string;
  referenceNo?: string;
  purchaseRequisition?: string;
  prNo?: string;
  date: string;
  validUntil: string;
  customerName: string;
  customerPhone: string;
  customerCompany?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  vatRate: number;
  vatAmount?: number;
  vatType?: 'amount' | 'percent';
  vatValue?: number;
  grandTotal: number;
  status: 'Draft' | 'Sent' | 'Approved' | 'Declined';
  notes?: string;
  quoteType?: 'Sales' | 'Custom';
  isConverted?: boolean;
  showRegionColumn?: boolean;
  showTypeColumn?: boolean;
}

export interface PurchaseOrderItem {
  productId: string;
  name: string;
  unit: UnitType;
  unitCost: number;
  qty: number;
  receivedQty?: number;
  totalCost: number;
}

export type PurchaseItem = PurchaseOrderItem;

export interface PurchaseOrder {
  id: string;
  poNo: string;
  poNumber?: string;
  date: string;
  supplierId: string;
  supplierName: string;
  supplierPhone?: string;
  destination: 'Factory' | 'Office';
  destinationLocation?: 'Factory' | 'Office';
  items: PurchaseOrderItem[];
  subtotal?: number;
  totalAmount: number;
  grandTotal?: number;
  paidAmount: number;
  dueAmount: number;
  status: 'Pending' | 'Ordered' | 'Received' | 'Cancelled';
  paymentMethod?: PaymentMethod;
  paymentStatus?: 'Paid' | 'Partial' | 'Due' | 'Pending';
  invoiceRef?: string;
  notes?: string;
}

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
  qty: number;
  unit: UnitType;
  sourceLocation?: 'Factory' | 'Office';
  targetLocation?: 'Factory' | 'Office';
  refNo: string;
  reason: string;
}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'DEBIT' | 'CREDIT';

export type AccountType =
  | 'Cash in Hand'
  | 'BRAC Bank A/C'
  | 'bKash / Nagad'
  | 'Factory Cash'
  | 'Office Cash'
  | 'BRAC Bank'
  | string;

export interface AccountBalances {
  cash: number;
  bank: number;
  mobile: number;
  factoryCash?: number;
  bkash?: number;
  nagad?: number;
  bankBreakdown?: { id: string; code: string; name: string; balance: number }[];
  [key: string]: any;
}

export interface AccountingTransaction {
  id: string;
  date: string;
  type: TransactionType;
  category: string;
  categoryBn?: string;
  amount: number;
  account?: AccountType;
  accountHead?: string;
  voucherNo?: string;
  reference?: string;
  location?: 'Office' | 'Factory' | 'Both' | string;
  paymentMethod?: string;
  paymentAccount?: string;
  refNo?: string;
  customerOrSupplier?: string;
  description: string;
  projectId?: string;
  projectCode?: string;
}

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  classification: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  accountGroup: string;
  normalBalance: 'Debit' | 'Credit';
  openingBalance: number;
  currentBalance: number;
  description?: string;
  isSystem?: boolean;
  isActive: boolean;
}

export interface ExpenseHead {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  category: string;
  linkedAccountId?: string;
  budgetMonthly?: number;
  monthlyBudgetLimit?: number;
  description?: string;
  isActive: boolean;
}

export interface JournalEntry {
  id: string;
  date: string;
  entryNo: string;
  refNo?: string;
  debitAccountId: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountName: string;
  amount: number;
  narration: string;
  source: 'SALES' | 'PURCHASE' | 'EXPENSE' | 'RECEIPT' | 'MANUAL' | 'PROJECT_SALES' | 'PROJECT_EXPENSE' | 'LEDGER_SYNC' | string;
  createdBy?: string;
}

export type StaffRole =
  | 'Managing Director'
  | 'Senior Accountant'
  | 'Cashier'
  | 'Sales Executive'
  | 'Production In-Charge'
  | 'Store Supervisor'
  | string;

export interface RolePermission {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  category: 'POS' | 'Sales' | 'Inventory' | 'Supply Chain' | 'Accounting' | 'Settings';
}

export interface UserRole {
  id: string;
  name: string;
  nameBn: string;
  description: string;
  isSystem?: boolean;
  permissions: string[];
}

export interface StaffMember {
  id: string;
  name: string;
  nameBn?: string;
  role: StaffRole;
  roleBn: string;
  location: 'Office' | 'Factory' | 'Both';
  phone?: string;
  email?: string;
  avatarColor: string;
  isActive?: boolean;
  customRoleId?: string;
  roleTitle?: string;
  password?: string;
}

export type AuditActionType =
  | 'EXPENSE_RECORDED'
  | 'PAYMENT_COLLECTED'
  | 'ADVANCE_ADJUSTED'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'PO_CREATED'
  | 'PO_RECEIVED'
  | 'SUPPLIER_PAID'
  | 'STOCK_ADJUSTED'
  | 'STOCK_TRANSFERRED'
  | 'BULK_PRODUCTS_IMPORTED'
  | 'AUDIT_NOTE_ADDED'
  | 'PROFILE_UPDATED'
  | 'BACKUP_EXPORTED'
  | 'BACKUP_RESTORED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'
  | 'SUPPLIER_CREATED'
  | 'SUPPLIER_UPDATED'
  | 'SUPPLIER_DELETED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'ROLE_UPDATED'
  | 'DATA_CLEANED'
  | 'COA_CREATED'
  | 'COA_UPDATED'
  | 'COA_DELETED'
  | 'EXPENSE_HEAD_CREATED'
  | 'EXPENSE_HEAD_UPDATED'
  | 'EXPENSE_HEAD_DELETED'
  | 'CATEGORY_CREATED'
  | 'CATEGORY_UPDATED'
  | 'CATEGORY_DELETED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'JOURNAL_ENTRY_CREATED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  | 'PROJECT_SALES_ADDED'
  | 'PROJECT_EXPENSE_ADDED'
  | 'PROJECT_DUE_COLLECTED';

export interface ProjectExpenseItem {
  id: string;
  category: 'Conveyance' | 'Labor Charge' | 'Entertainment' | 'Raw Materials Purchase' | 'Subcontract' | 'Utility / Others' | string;
  categoryBn?: string;
  amount: number;
  date: string;
  note?: string;
  linkedExpenseHeadId?: string;
  linkedAccountId?: string;
  linkedAccountCode?: string;
  paymentMethod?: string;
  paymentAccountId?: string;
  breakdownBatchId?: string;
}

export interface ProjectSalesPaymentBreakdown {
  id: string;
  method: string;
  amount: number;
  note?: string;
  referenceNo?: string;
}

export interface ProjectSalesCollection {
  id: string;
  date: string;
  amount: number;
  paymentMethod: string;
  paymentAccountId?: string;
  note?: string;
  referenceNo?: string;
  createdBy?: string;
}

export interface ProjectSalesItem {
  id: string;
  invoiceNo?: string;
  description: string;
  amount: number;
  date: string;
  clientName?: string;
  note?: string;
  paymentMethod?: string;
  paymentBreakdown?: ProjectSalesPaymentBreakdown[];
  linkedAccountId?: string;
  paidAmount?: number;
  dueAmount?: number;
  collections?: ProjectSalesCollection[];
}

export interface Project {
  id: string;
  code: string;
  name: string;
  nameBn?: string;
  clientName: string;
  clientPhone?: string;
  startDate: string;
  endDate?: string;
  status: 'Planning' | 'In Progress' | 'Completed' | 'On Hold';
  statusBn?: string;
  budget: number;
  salesItems: ProjectSalesItem[];
  expenseItems: ProjectExpenseItem[];
  totalSales: number;
  totalExpenses: number;
  totalCollected?: number;
  totalDue?: number;
  netProfit: number;
  profitMargin: number;
  notes?: string;
  chartOfAccountId?: string;
  projectAccountCode?: string;
  invoiceId?: string;
  invoiceNo?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  location: 'Office' | 'Factory' | 'Both' | 'All';
  actionType: AuditActionType;
  entityType: 'Accounting' | 'Sales' | 'POS' | 'Inventory' | 'Supply Chain' | 'System' | 'Configuration' | 'Projects';
  refNo?: string;
  details: string;
  detailsBn?: string;
  amount?: number;
  severity?: 'info' | 'success' | 'warning' | 'critical';
}
