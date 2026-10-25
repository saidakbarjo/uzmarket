/** Игра (категория верхнего уровня). Список игр управляется администратором. */
export interface Game {
  slug: string;
  name: string;
  nameUz: string;
  nameEn: string;
  description: string;
  abbr: string; // 2–3 буквы для локальной обложки
  hue: number; // оттенок обложки 0..359
  enabled: boolean;
  sortOrder: number;
}

/** Тип товара внутри игры («категория» для покупателя). */
export type ProductType = "item" | "currency" | "service" | "key" | "other";

export type Role = "user" | "admin";

export interface Profile {
  id: string;
  username: string;
  email: string;
  role: Role;
  isSeller: boolean;
  isDemo: boolean;
  blocked: boolean;
  createdAt: string;
  rating: number; // 0..5
  reviewsCount: number;
  salesCount: number;
  verified: boolean;
  about: string;
  /** "hue:NNN" — локальная заглушка либо data:image/jpeg (уменьшенная загруженная картинка). */
  avatar?: string;
}

export type PayoutMethod = "card_demo" | "bank_demo" | "wallet_future";

export interface SellerProfile {
  userId: string;
  shopName: string;
  about: string;
  payoutMethod: PayoutMethod;
  createdAt: string;
  acceptedRulesAt: string;
}

export type ListingStatus = "active" | "paused" | "blocked" | "pending" | "rejected";

export type DeliveryMethod = "chat" | "key" | "manual" | "file";

export interface Listing {
  id: string;
  title: string;
  description: string;
  gameSlug: string;
  productType: ProductType;
  priceUzs: number; // целые сумы за 1 единицу
  /** Количество в наличии; null — не применимо (услуга, безлимит). */
  stock: number | null;
  /** Продавец может временно пометить «нет в наличии». */
  available: boolean;
  sellerId: string;
  status: ListingStatus;
  moderationNote?: string;
  deliveryMethod: DeliveryMethod;
  deliveryDays: number; // срок выполнения, дней (0 = мгновенно)
  refundTerms: string;
  fulfillmentTerms: string;
  /** Уменьшенные изображения (data URL). Внешних картинок нет. */
  images: string[];
  imageHue?: number;
  createdAt: string;
  isDemo: boolean;
  views: number;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "in_progress"
  | "delivered"
  | "completed"
  | "disputed"
  | "refund_review"
  | "cancelled"
  | "refunded";

export type FeePayer = "seller" | "buyer" | "split";

/** Применённая комиссия. Фиксируется в заказе при создании и не меняется. */
export interface Commission {
  percent: number;
  source: "seller" | "game" | "default";
  payer: FeePayer;
  feeUzs: number; // всего комиссия платформы
  buyerFeeUzs: number; // сколько из неё платит покупатель (сверх цены)
  sellerFeeUzs: number; // сколько удерживается у продавца
  totalUzs: number; // итого к оплате покупателем
  sellerNetUzs: number; // доход продавца после комиссии
  minFeeApplied: boolean;
}

export interface OrderEvent {
  id: string;
  at: string;
  status: OrderStatus;
  actorId: string | "system";
  note: string;
}

export interface OrderMessage {
  id: string;
  at: string;
  authorId: string | "system";
  text: string;
}

export interface Order {
  id: string;
  number: string;
  listingId: string;
  listingTitle: string;
  gameSlug: string;
  buyerId: string;
  sellerId: string;
  unitPriceUzs: number; // фиксируется при создании
  quantity: number;
  priceUzs: number; // стоимость товара = unitPriceUzs × quantity
  commission: Commission;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  events: OrderEvent[];
  messages: OrderMessage[];
  fulfillmentNote?: string;
  paymentRef?: string;
  isDemo: boolean;
}

export interface Review {
  id: string;
  listingId: string;
  orderId?: string;
  authorId: string;
  authorName: string;
  sellerId: string;
  rating: number; // 1..5
  text: string;
  createdAt: string;
  isDemo: boolean;
  sellerReply?: { text: string; at: string };
}

export type TicketStatus = "open" | "in_review" | "need_info" | "resolved" | "rejected";
export type TicketKind = "support" | "dispute" | "complaint";
export type DisputeDecision = "refund_buyer" | "complete_seller";

export interface Ticket {
  id: string;
  number: string;
  kind: TicketKind;
  authorId: string;
  orderId?: string;
  listingId?: string;
  subject: string;
  reason: string;
  description: string;
  evidence: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  replies: { id: string; at: string; authorId: string | "staff"; text: string; evidence?: string; kind?: "message" | "info_request" | "decision" }[];
  resolution?: { decision: DisputeDecision; comment: string; at: string; byId: string };
}

export interface AppNotification {
  id: string;
  userId: string;
  text: string;
  at: string;
  read: boolean;
  href?: string;
}

export type LedgerKind =
  | "order_paid" // деньги покупателя получены → у продавца «ожидает завершения»
  | "order_released" // сделка завершена → «доступно», комиссия платформы признана
  | "order_reversed" // возврат/отмена после оплаты → ожидаемая сумма снята
  | "payout_requested"
  | "payout_paid"
  | "payout_rejected";

/** Запись финансового журнала. Баланс = сумма дельт. Все суммы — целые сумы, тестовые (DEMO). */
export interface LedgerEntry {
  id: string;
  at: string;
  userId: string; // продавец
  orderId?: string;
  payoutId?: string;
  kind: LedgerKind;
  pending: number;
  available: number;
  inPayout: number;
  paid: number;
  platformFee: number; // комиссия платформы, признанная этой записью
  note: string;
}

export type PayoutStatus = "created" | "in_review" | "approved" | "paid" | "rejected";

export interface PayoutRequest {
  id: string;
  number: string;
  sellerId: string;
  amountUzs: number;
  method: PayoutMethod;
  details: string;
  status: PayoutStatus;
  adminComment: string;
  createdAt: string;
  updatedAt: string;
  history: { at: string; status: PayoutStatus; byId: string; note: string }[];
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string | "system";
  action: string;
  entity: string;
  entityId: string;
  detail: string;
}

export interface SiteSettings {
  moderationEnabled: boolean;
  siteName: string;
}

export interface Session {
  userId: string;
}
