"use client";

import { useState, useEffect } from "react";
import { CallState } from "@/hooks/useWebRTC";
import { Phone, PhoneOff, Mic, MicOff, PhoneIncoming } from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface IncomingCallProps {
  callerName: string;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallOverlay({
  callerName,
  onAccept,
  onReject,
}: IncomingCallProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-in fade-in zoom-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <PhoneIncoming size={36} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Incoming Call</h2>
        <p className="text-gray-500 mb-6">{callerName} is calling you...</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onReject}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg"
          >
            <PhoneOff size={24} />
          </button>
          <button
            onClick={onAccept}
            className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors shadow-lg"
          >
            <Phone size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActiveCallBarProps {
  contactName: string;
  callState: CallState;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}

export function ActiveCallBar({
  contactName,
  callState,
  isMuted,
  onToggleMute,
  onEndCall,
}: ActiveCallBarProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === "connected") {
      interval = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      setTimeout(() => setDuration(0), 0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  return (
    <div className="bg-green-600 text-white px-4 py-2 flex items-center justify-between animate-in slide-in-from-top z-50 shadow-md">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span className="text-sm font-medium flex items-center gap-3">
          {callState === "calling" ? `Calling ${contactName}...` : ""}
          {callState === "ringing" ? `Ringing ${contactName}...` : ""}
          {callState === "connected" ? `In call with ${contactName}` : ""}
          {callState === "connected" && (
            <span className="font-mono text-xs bg-black/20 px-2 py-0.5 rounded-full tracking-wider">
              {formatDuration(duration)}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {callState === "connected" && (
          <button
            onClick={onToggleMute}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isMuted ? "bg-red-500" : "bg-white/20 hover:bg-white/30"
            }`}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
        <button
          onClick={onEndCall}
          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  );
}

interface CallButtonProps {
  onClick: () => void;
  disabled: boolean;
}

export function CallButton({ onClick, disabled }: CallButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
      title="Voice Call"
    >
      <Phone size={18} />
    </button>
  );
}
