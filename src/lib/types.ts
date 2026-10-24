export type CategorySlug =
  | "game-items"
  | "game-currency"
  | "game-services"
  | "keys"
  | "software"
  | "subscriptions"
  | "accounts"
  | "design"
  | "other";

export interface Category {
  slug: CategorySlug;
  name: string;
  nameUz: string;
  description: string;
  icon: string; // lucide icon name
  hue: number; // для локальных заглушек изображений
}

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
}

export type ListingStatus = "active" | "paused" | "blocked";

export type DeliveryMethod = "chat" | "key" | "manual" | "file";

export interface Listing {
  id: string;
  title: string;
  description: string;
  categorySlug: CategorySlug;
  priceUzs: number; // целые сумы
  sellerId: string;
  status: ListingStatus;
  deliveryMethod: DeliveryMethod;
  deliveryDays: number; // срок выполнения, дней (0 = мгновенно)
  refundTerms: string;
  fulfillmentTerms: string;
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
  | "cancelled"
  | "refunded";

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
  buyerId: string;
  sellerId: string;
  priceUzs: number; // фиксируется при создании, не меняется
  feeUzs: number; // демо-комиссия
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
}

export type TicketStatus = "open" | "in_review" | "resolved" | "rejected";
export type TicketKind = "support" | "dispute" | "complaint";

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
  replies: { id: string; at: string; authorId: string | "staff"; text: string }[];
}

export interface AppNotification {
  id: string;
  userId: string;
  text: string;
  at: string;
  read: boolean;
  href?: string;
}

export interface Session {
  userId: string;
}
