import axios from "axios";
import { User, Message } from "@/types";

const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    return (
      process.env.NEXT_PUBLIC_API_URL ||
      `http://${window.location.hostname}:3001/api`
    );
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const apiService = {
  // Users
  register: (name: string, phone: string) =>
    api.post<User>("/users/register", { name, phone }).then((res) => res.data),

  getUsers: () =>
    api.get<{ data: User[] }>("/users").then((res) => res.data.data),

  updateUser: (id: string, name: string) =>
    api.patch<User>(`/users/${id}`, { name }).then((res) => res.data),

  // Messages
  getMessages: (receiverId?: string, senderId?: string) =>
    api
      .get<{
        data: Message[];
      }>("/messages", { params: { receiverId, senderId } })
      .then((res) => res.data.data),

  sendMessage: (payload: {
    senderId: string;
    receiverId: string;
    message: string;
    idempotencyKey?: string;
  }) => api.post<Message>("/messages", payload).then((res) => res.data),

  markMessagesAsRead: (senderId: string, receiverId: string) =>
    api
      .patch(`/messages/read-all/${senderId}`, { receiverId })
      .then((res) => res.data),
};
