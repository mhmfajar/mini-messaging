"use client";

import { memo, useEffect, useRef } from "react";
import { Message, User } from "@/types";
import { MessageStatusBadge } from "./MessageStatusBadge";
import { clsx } from "clsx";
import { format } from "date-fns";

interface MessageListProps {
  messages: Message[];
  currentUser: User;
  isLoading: boolean;
}

const MessageBubble = memo(function MessageBubble({
  msg,
  isMe,
}: {
  msg: Message;
  isMe: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col max-w-[85%] md:max-w-[70%]",
        isMe ? "ml-auto items-end" : "mr-auto items-start",
      )}
    >
      <div
        className={clsx(
          "px-4 py-2.5 rounded-2xl shadow-sm relative",
          isMe
            ? "bg-[#d9fdd3] text-gray-800 rounded-tr-none"
            : "bg-white text-gray-800 rounded-tl-none",
        )}
      >
        <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap wrap-break-word">
          {msg.message}
        </p>

        <div
          className={clsx(
            "flex items-center gap-2 mt-1",
            isMe ? "justify-end" : "justify-start",
          )}
        >
          <span className="text-[10px] text-gray-500 font-medium">
            {format(new Date(msg.createdAt), "HH:mm")}
          </span>
          {isMe && (
            <MessageStatusBadge
              status={msg.status}
              readAt={msg.readAt}
              className="scale-75 origin-right"
            />
          )}
        </div>
      </div>

      <div
        className={clsx(
          "text-[10px] mt-1 px-1",
          isMe ? "text-right" : "text-left",
        )}
      >
        <span className="text-gray-400 font-medium">
          {isMe ? "You" : msg.sender?.name || "Contact"}
        </span>
      </div>
    </div>
  );
});

export function MessageList({
  messages,
  currentUser,
  isLoading,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-sm">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-12 text-center">
        <div className="max-w-xs">
          <p className="text-gray-400 text-lg mb-2">No messages yet</p>
          <p className="text-gray-400 text-sm">
            Send a message to start the conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[#f0f2f5] scroll-smooth"
    >
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          msg={msg}
          isMe={msg.senderId === currentUser.id}
        />
      ))}
    </div>
  );
}
