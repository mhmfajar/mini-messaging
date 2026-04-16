"use client";

import { useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useChatSync } from "@/hooks/useChatSync";
import { apiService } from "@/lib/api";
import { Message } from "@/types";
import { RegisterForm } from "@/components/RegisterForm";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ContactSelector } from "@/components/ContactSelector";
import { MessageList } from "@/components/MessageList";
import { SendMessageForm } from "@/components/SendMessageForm";
import {
  IncomingCallOverlay,
  ActiveCallBar,
  CallButton,
} from "@/components/CallUI";

export default function Home() {
  const { user, isLoading: isUserLoading, logout } = useUser();
  const {
    socket,
    isConnected,
    subscribeToStatus,
    subscribeToNewMessages,
    subscribeToNewUsers,
    subscribeToReadMessages,
  } = useSocket();

  const {
    contacts,
    isContactsLoading,
    selectedContact,
    setSelectedContact,
    messages,
    setMessages,
    isMessagesLoading,
    handleSendMessage,
  } = useChatSync({
    user,
    logout,
    subscribeToStatus,
    subscribeToNewMessages,
    subscribeToNewUsers,
    subscribeToReadMessages,
  });

  // WebRTC voice calling
  const {
    callState,
    remoteUserName,
    isMuted,
    remoteAudio,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  } = useWebRTC({
    socket,
    userId: user?.id || "",
    onCallLog: async (targetId, messageText) => {
      if (!user) return;
      try {
        const tempId = crypto.randomUUID();
        // Optimistic UI update
        const optimisticMessage: Message = {
          id: tempId,
          senderId: user.id,
          receiverId: targetId,
          message: messageText,
          status: "queued",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          readAt: undefined,
          sender: user,
        };

        setMessages((prev) => [...prev, optimisticMessage]);

        const savedMessage = await apiService.sendMessage({
          senderId: user.id,
          receiverId: targetId,
          message: messageText,
          idempotencyKey: crypto.randomUUID(),
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
        console.error("Failed to save call log", error);
      }
    },
  });

  // Register user room for targeted signaling
  useEffect(() => {
    if (socket && user) {
      socket.emit("register", { userId: user.id });
    }
  }, [socket, user]);

  // ── Render ──────────────────────────────────────────────────────

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <RegisterForm />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 max-w-6xl mx-auto shadow-2xl border-x border-gray-200">
      <DashboardHeader isConnected={isConnected} />

      {/* Active call bar */}
      {(callState === "calling" || callState === "connected") &&
        selectedContact && (
          <ActiveCallBar
            contactName={selectedContact.name}
            callState={callState}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onEndCall={endCall}
          />
        )}

      {/* Incoming call overlay */}
      {callState === "incoming" && (
        <IncomingCallOverlay
          callerName={remoteUserName}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {/* Hidden audio element for remote voice */}
      <audio ref={remoteAudio} autoPlay />

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-80 bg-white border-r border-gray-200 flex-col hidden md:flex">
          <div className="flex-1 overflow-y-auto p-3">
            <ContactSelector
              contacts={contacts}
              selectedContactId={selectedContact?.id || null}
              onSelect={setSelectedContact}
              isLoading={isContactsLoading}
            />
          </div>
        </aside>

        {/* Chat Area */}
        <section className="flex-1 flex flex-col bg-white">
          {selectedContact ? (
            <>
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                    {selectedContact.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">
                      {selectedContact.name}
                    </h2>
                    <p className="text-xs text-gray-500 font-mono">
                      {selectedContact.phone}
                    </p>
                  </div>
                </div>
                <CallButton
                  onClick={() => startCall(selectedContact.id, user.name)}
                  disabled={callState !== "idle"}
                />
              </div>

              <MessageList
                messages={messages}
                currentUser={user}
                isLoading={isMessagesLoading}
              />

              <SendMessageForm
                selectedContact={selectedContact}
                onSend={handleSendMessage}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50">
              <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-6">
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Select a Conversation
              </h2>
              <p className="text-gray-500 max-w-sm">
                Pick a contact from the sidebar to start chatting in real-time.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
