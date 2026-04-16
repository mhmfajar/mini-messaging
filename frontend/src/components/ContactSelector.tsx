"use client";

import { User } from "@/types";
import { UserCircle2 } from "lucide-react";
import { clsx } from "clsx";

interface ContactSelectorProps {
  contacts: User[];
  selectedContactId: string | null;
  onSelect: (contact: User) => void;
  isLoading: boolean;
}

export function ContactSelector({
  contacts,
  selectedContactId,
  onSelect,
  isLoading,
}: ContactSelectorProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-3 bg-gray-100 rounded w-1/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Contacts
      </h3>
      {contacts.length === 0 ? (
        <p className="px-3 text-sm text-gray-400 italic">
          No other users found
        </p>
      ) : (
        contacts.map((contact) => (
          <button
            key={contact.id}
            onClick={() => onSelect(contact)}
            className={clsx(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group",
              selectedContactId === contact.id
                ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                : "hover:bg-gray-100 text-gray-700",
            )}
          >
            <div
              className={clsx(
                "p-1.5 rounded-full",
                selectedContactId === contact.id
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-400 group-hover:bg-white",
              )}
            >
              <UserCircle2 size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">
                {contact.name}
              </p>
              <p
                className={clsx(
                  "text-xs font-mono truncate",
                  selectedContactId === contact.id
                    ? "text-blue-100"
                    : "text-gray-400",
                )}
              >
                {contact.phone}
              </p>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
