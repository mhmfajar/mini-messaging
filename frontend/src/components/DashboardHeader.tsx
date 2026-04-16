"use client";

import { useUser } from "@/context/UserContext";
import { LogOut, User as UserIcon, Wifi, WifiOff, Pencil, Check, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface DashboardHeaderProps {
  isConnected: boolean;
}

export function DashboardHeader({ isConnected }: DashboardHeaderProps) {
  const { user, logout, renameUser } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      setTempName(user?.name || "");
    }
  }, [isEditing, user]);

  if (!user) return null;

  const handleSave = async () => {
    if (tempName.trim() === user.name) {
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    try {
      await renameUser(tempName.trim());
      setIsEditing(false);
    } catch (error) {
      alert("Failed to update name. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 p-2 rounded-full text-blue-600">
          <UserIcon size={24} />
        </div>
        <div>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                className="text-xl font-bold text-gray-900 border-b-2 border-blue-500 bg-transparent outline-none py-0.5"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
                disabled={isSaving}
              />
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Check size={20} />
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
              <h1 className="text-xl font-bold text-gray-900">{user.name || "Set Name"}</h1>
              <Pencil size={16} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
          <p className="text-sm text-gray-500 font-mono">{user.phone}</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
              <Wifi size={16} />
              <span>Real-time Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-red-500 text-sm font-medium animate-pulse">
              <WifiOff size={16} />
              <span>Connecting...</span>
            </div>
          )}
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 p-2 px-4 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          title="Logout"
        >
          <LogOut size={20} />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </header>
  );
}
