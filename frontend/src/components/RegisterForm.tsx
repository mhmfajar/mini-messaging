"use client";

import { useState, SubmitEvent } from "react";
import { apiService } from "@/lib/api";
import { useUser } from "@/context/UserContext";
import { MessageSquare, Phone, Loader2 } from "lucide-react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import React from "react";

const CustomInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => (
  <input
    {...props}
    ref={ref}
    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-gray-900"
  />
));

CustomInput.displayName = "CustomInput";

export function RegisterForm() {
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useUser();

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!phone) return;

    if (!isValidPhoneNumber(phone)) {
      setError("Please enter a valid international phone number.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const user = await apiService.register(phone, phone);
      login(user);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(
        error.response?.data?.message ||
          "Failed to connect to the server. Is the API service running?",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200 mb-4">
            <MessageSquare size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Mini Messaging</h2>
          <p className="text-gray-500 text-sm">
            Welcome back! Please identify yourself.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Phone size={16} className="text-gray-400" />
              Phone Number
            </label>
            <PhoneInput
              international
              defaultCountry="ID"
              placeholder="e.g. +62 812-3456-789"
              value={phone}
              onChange={(value) => setPhone(value || "")}
              className="phone-input-container"
              inputComponent={CustomInput}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 italic">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Connecting...</span>
              </>
            ) : (
              <span>Start Messaging</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
