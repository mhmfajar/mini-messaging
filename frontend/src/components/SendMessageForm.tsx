"use client";

import { SyntheticEvent, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { User } from "@/types";

interface SendMessageFormProps {
  selectedContact: User | null;
  onSend: (message: string) => Promise<void>;
}

export function SendMessageForm({
  selectedContact,
  onSend,
}: SendMessageFormProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedContact || isSending) return;

    setIsSending(true);
    try {
      await onSend(message.trim());
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  if (!selectedContact) {
    return (
      <div className="p-6 bg-gray-50 border-t border-gray-200 text-center text-gray-400 text-sm italic">
        Select a contact to start messaging
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-white border-t border-gray-200 flex gap-3"
    >
      <input
        type="text"
        className="flex-1 px-4 py-3 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none text-gray-900 resize-none h-12 flex items-center"
        placeholder={`Message ${selectedContact.name}...`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      <button
        type="submit"
        disabled={!message.trim() || isSending}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 text-white p-3 rounded-2xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center min-w-12"
      >
        {isSending ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <Send size={20} />
        )}
      </button>
    </form>
  );
}
