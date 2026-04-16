import { useState, useEffect, useCallback } from "react";
import { User, Message, StatusUpdate } from "@/types";
import { ReadUpdate } from "@/hooks/useSocket";
import { apiService } from "@/lib/api";

interface UseChatSyncProps {
  user: User | null;
  logout: () => void;
  subscribeToStatus: (
    cb: (update: StatusUpdate) => void,
  ) => (() => void) | undefined;
  subscribeToNewMessages: (
    cb: (msg: Message) => void,
  ) => (() => void) | undefined;
  subscribeToNewUsers: (cb: (user: User) => void) => (() => void) | undefined;
  subscribeToReadMessages: (
    cb: (update: ReadUpdate) => void,
  ) => (() => void) | undefined;
}

export function useChatSync({
  user,
  logout,
  subscribeToStatus,
  subscribeToNewMessages,
  subscribeToNewUsers,
  subscribeToReadMessages,
}: UseChatSyncProps) {
  const [contacts, setContacts] = useState<User[]>([]);
  const [isContactsLoading, setIsContactsLoading] = useState(false);

  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);

  // ── Fetch contacts ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchContacts = async () => {
      setIsContactsLoading(true);
      try {
        const data = await apiService.getUsers();
        const stillExists = data.some((u) => u.id === user.id);
        if (!stillExists) {
          logout();
          return;
        }
        setContacts(data.filter((c) => c.id !== user.id));
      } finally {
        setIsContactsLoading(false);
      }
    };

    fetchContacts();
  }, [user, logout]);

  // ── Fetch conversation when contact changes ─────────────────────
  useEffect(() => {
    if (!user || !selectedContact) return;

    const fetchConversation = async () => {
      setIsMessagesLoading(true);
      try {
        const [sent, received] = await Promise.all([
          apiService.getMessages(selectedContact.id, user.id),
          apiService.getMessages(user.id, selectedContact.id),
        ]);
        const allMessages = [...sent, ...received].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        setMessages(allMessages);
      } finally {
        setIsMessagesLoading(false);
      }
    };

    fetchConversation();
  }, [user, selectedContact]);

  // ── Real-time: status updates (processing → sent / failed) ──────
  useEffect(() => {
    const unsubscribe = subscribeToStatus((update: StatusUpdate) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === update.messageId
            ? { ...msg, status: update.status, updatedAt: update.updatedAt }
            : msg,
        ),
      );
    });
    return unsubscribe;
  }, [subscribeToStatus]);

  // ── Real-time: new user registrations ───────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeToNewUsers((newUser: User) => {
      if (user && newUser.id !== user.id) {
        setContacts((prev) => {
          if (prev.some((c) => c.id === newUser.id)) return prev;
          return [...prev, newUser].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        });
      }
    });
    return unsubscribe;
  }, [subscribeToNewUsers, user]);

  // ── Real-time: read receipts (grey tick → blue tick) ────────────
  useEffect(() => {
    const unsubscribe = subscribeToReadMessages((update: ReadUpdate) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === update.messageId ? { ...msg, readAt: update.readAt } : msg,
        ),
      );
    });
    return unsubscribe;
  }, [subscribeToReadMessages]);

  // ── Mark messages as read when opening a conversation ───────────
  useEffect(() => {
    if (user && selectedContact) {
      apiService.markMessagesAsRead(selectedContact.id, user.id);
    }
  }, [selectedContact, user]);

  // ── Real-time: incoming messages ────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeToNewMessages((newMessage: Message) => {
      const isFromSelectedContact =
        selectedContact && newMessage.senderId === selectedContact.id;
      const isForCurrentUser = user && newMessage.receiverId === user.id;

      if (isFromSelectedContact && isForCurrentUser) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });

        // Automatically mark as read since the chat is open
        apiService.markMessagesAsRead(selectedContact.id, user.id);
      }
    });
    return unsubscribe;
  }, [subscribeToNewMessages, selectedContact, user]);

  // ── Send handler ────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!user || !selectedContact) return;

      const tempId = crypto.randomUUID();
      const optimisticMessage: Message = {
        id: tempId,
        senderId: user.id,
        receiverId: selectedContact.id,
        message: text,
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sender: user,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const savedMessage = await apiService.sendMessage({
          senderId: user.id,
          receiverId: selectedContact.id,
          message: text,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...savedMessage,
                  status:
                    m.status !== "queued" ? m.status : savedMessage.status,
                }
              : m,
          ),
        );
      } catch (error) {
        console.error("Failed to send message:", error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, status: "failed" as const } : m,
          ),
        );
      }
    },
    [user, selectedContact],
  );

  return {
    contacts,
    isContactsLoading,
    selectedContact,
    setSelectedContact,
    messages,
    setMessages,
    isMessagesLoading,
    handleSendMessage,
  };
}
