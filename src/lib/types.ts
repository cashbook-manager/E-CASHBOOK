export type OrderStatus = 'pending' | 'cutting' | 'stitching' | 'ready' | 'delivered';

export type SaleType = 'tailoring' | 'readymade' | 'fabric';

export type OrderPaymentStatus = 'unpaid' | 'paid_in_full' | 'outstanding' | 'written_off';

export type DeliveryPaymentMethod = 'cash' | 'bank' | 'pos' | 'other';

export type LossReason =
  | 'Customer Discount'
  | 'Late Delivery Compensation'
  | 'Design Issue'
  | 'Customer Complaint'
  | 'Other';

export type WorkerCategory = 'cutting' | 'embroidery' | 'rhinestone' | 'stitching';

export interface Settings {
  id: number;
  shop_name: string;
  owner_name: string;
  phone: string;
  whatsapp: string;
  address: string;
  currency: string;
  theme: string;
  profile_photo: string;
  logo: string;
  reminder_days: number;
  opening_cash: number;
  admin_password: string;
}

export interface Worker {
  id: string;
  name: string;
  whatsapp: string;
  category: WorkerCategory;
  photo: string;
  join_date: string;
  status: string;
  monthly_salary: number;
  created_at: string;
  shop_id: string | null;
}

export interface WorkerDesign {
  id: string;
  worker_id: string;
  design_number: string;
  design_name: string;
  price: number;
  description: string;
  created_at: string;
}

export interface WorkerPayment {
  id: string;
  worker_id: string;
  order_id: string | null;
  design_number: string;
  receipt_number: string;
  submission_date: string;
  price: number;
  quantity: number;
  amount: number;
  remarks: string;
  created_at: string;
}

export interface WorkerFinalPayment {
  id: string;
  worker_id: string;
  total_earned: number;
  discount: number;
  final_amount: number;
  payment_method: string;
  remarks: string;
  payment_date: string;
  created_at: string;
  shop_id: string | null;
  payment_account_id: string | null;
}

export interface WorkerAdvance {
  id: string;
  worker_id: string;
  amount: number;
  advance_date: string;
  remarks: string;
  created_at: string;
  shop_id: string | null;
  payment_account_id: string | null;
}

export interface Salesman {
  id: string;
  name: string;
  whatsapp: string;
  photo: string;
  monthly_salary: number;
  commission: number;
  status: string;
  share_token: string;
  created_at: string;
  shop_id: string | null;
}

export interface SalesmanLedgerEntry {
  id: string;
  salesman_id: string;
  amount: number;
  payment_date: string;
  remarks: string;
  type: 'advance' | 'payment';
  created_at: string;
  shop_id: string | null;
  payment_account_id: string | null;
}

export interface SalesmanAdvance {
  id: string;
  salesman_id: string;
  amount: number;
  advance_date: string;
  remarks: string;
  created_at: string;
  shop_id: string | null;
  payment_account_id: string | null;
}

export interface Order {
  id: string;
  receipt_number: string;
  customer_name: string;
  whatsapp_number: string;
  order_type: string;
  order_date: string;
  delivery_date: string | null;
  total_amount: number;
  advance: number;
  additional_payment: number;
  balance: number;
  measurement: string;
  notes: string;
  receipt_image: string;
  salesman_id: string | null;
  priority: string;
  remarks: string;
  status: OrderStatus;
  sale_type: SaleType;
  shop_id: string | null;
  payment_account_id: string | null;
  created_at: string;
  updated_at: string;
  // Delivery payment confirmation & loss tracking
  customer_paid_now: number;
  remaining_balance: number;
  payment_status: OrderPaymentStatus;
  loss_amount: number;
  loss_reason: string;
  write_off: boolean;
  delivered_date: string | null;
  payment_method: string;
}

export interface OrderWorker {
  id: string;
  order_id: string;
  worker_id: string;
  category: WorkerCategory;
  submitted: boolean;
  submission_date: string | null;
  submission_remarks: string;
  quantity: number;
  design_number: string;
  rate: number;
  created_at: string;
  worker?: Worker;
}

export interface TimelineEntry {
  id: string;
  order_id: string;
  action: string;
  detail: string;
  person: string;
  created_at: string;
}

export interface CashbookEntry {
  id: string;
  entry_date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  notes: string;
  attachment: string;
  shop_id: string | null;
  payment_account_id: string | null;
  created_at: string;
}

export type PaymentAccountType = 'cash' | 'bank' | 'pos';
export type PaymentAccountStatus = 'available' | 'disabled';

export interface Shop {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: 'active' | 'disabled';
  created_at: string;
}

export interface PaymentAccount {
  id: string;
  shop_id: string;
  type: PaymentAccountType;
  name: string;
  bank_name: string;
  account_number: string;
  pos_machine_id: string;
  status: PaymentAccountStatus;
  created_at: string;
  shop?: Shop;
}

export interface MoneyTransaction {
  id: string;
  shop_id: string;
  payment_account_id: string;
  direction: 'in' | 'out';
  amount: number;
  source_type: 'order' | 'sale' | 'salary' | 'expense' | 'advance' | 'manual';
  source_id: string | null;
  category: string;
  notes: string;
  entry_date: string;
  created_at: string;
  shop?: Shop;
  payment_account?: PaymentAccount;
}
