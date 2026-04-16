"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "@/types";
import { apiService } from "@/lib/api";

interface UserContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  renameUser: (name: string) => Promise<void>;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      const savedUser = localStorage.getItem("messaging_user");
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem("messaging_user");
        }
      }
      setIsLoading(false);
    }, 0);
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem("messaging_user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("messaging_user");
  };

  const renameUser = async (name: string) => {
    if (!user) return;
    try {
      const updatedUser = await apiService.updateUser(user.id, name);
      setUser(updatedUser);
      localStorage.setItem("messaging_user", JSON.stringify(updatedUser));
    } catch (error) {
      console.error("Failed to rename user:", error);
      throw error;
    }
  };

  return (
    <UserContext.Provider value={{ user, login, logout, renameUser, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
