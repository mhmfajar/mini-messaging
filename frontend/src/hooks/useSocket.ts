import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { User, Message, StatusUpdate } from "@/types";

type UnsubscribeFn = (() => void) | undefined;

export interface ReadUpdate {
  messageId: string;
  readAt: string;
}

const getSocketUrl = () => {
  if (typeof window !== "undefined") {
    return (
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      `http://${window.location.hostname}:3001`
    );
  }
  return process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
};

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      const newSocket = io(getSocketUrl());

      newSocket.on("connect", () => {
        console.log("Socket connected");
        setIsConnected(true);
      });

      newSocket.on("disconnect", () => {
        console.log("Socket disconnected");
        setIsConnected(false);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }, 0);
  }, []);

  const subscribeToStatus = useCallback(
    (callback: (update: StatusUpdate) => void): UnsubscribeFn => {
      if (!socket) return;
      socket.on("message:status", callback);
      return () => {
        socket.off("message:status", callback);
      };
    },
    [socket],
  );

  const subscribeToNewMessages = useCallback(
    (callback: (message: Message) => void): UnsubscribeFn => {
      if (!socket) return;
      socket.on("new_message", callback);
      return () => {
        socket.off("new_message", callback);
      };
    },
    [socket],
  );

  const subscribeToNewUsers = useCallback(
    (callback: (user: User) => void): UnsubscribeFn => {
      if (!socket) return;
      socket.on("new_user", callback);
      return () => {
        socket.off("new_user", callback);
      };
    },
    [socket],
  );

  const subscribeToReadMessages = useCallback(
    (callback: (update: ReadUpdate) => void): UnsubscribeFn => {
      if (!socket) return;
      socket.on("message:read", callback);
      return () => {
        socket.off("message:read", callback);
      };
    },
    [socket],
  );

  return {
    socket,
    isConnected,
    subscribeToStatus,
    subscribeToNewMessages,
    subscribeToNewUsers,
    subscribeToReadMessages,
  };
}
