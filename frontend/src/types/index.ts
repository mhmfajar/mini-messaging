export type MessageStatus = "queued" | "processing" | "sent" | "failed";

export interface User {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  status: MessageStatus;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  sender?: User;
  receiver?: User;
}

export interface StatusUpdate {
  messageId: string;
  status: MessageStatus;
  updatedAt: string;
}
