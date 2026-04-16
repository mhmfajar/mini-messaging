import { useState, useCallback, useRef, useEffect } from "react";
import { Socket } from "socket.io-client";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export type CallState =
  | "idle"
  | "calling"
  | "ringing"
  | "incoming"
  | "connected";

interface UseWebRTCOptions {
  socket: Socket | null;
  userId: string;
  onCallLog?: (targetId: string, message: string) => void;
}

export function useWebRTC({ socket, userId, onCallLog }: UseWebRTCOptions) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [remoteUserName, setRemoteUserName] = useState<string>("");
  const [isMuted, setIsMuted] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const isCaller = useRef<boolean>(false);
  const callStartTime = useRef<number | null>(null);

  // Clean up peer connection
  const cleanup = useCallback(() => {
    // Generate call log if we are the caller
    if (isCaller.current && remoteUserId) {
      let logMessage = "";
      if (callStartTime.current) {
        const seconds = Math.floor((Date.now() - callStartTime.current) / 1000);
        const m = Math.floor(seconds / 60)
          .toString()
          .padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");
        logMessage = `Voice call - ${m}:${s}`;
      } else {
        logMessage = `Missed voice call`;
      }
      onCallLog?.(remoteUserId, logMessage);
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => t.stop());
      localStream.current = null;
    }
    setCallState("idle");
    setRemoteUserId(null);
    setRemoteUserName("");
    setIsMuted(false);
    isCaller.current = false;
    callStartTime.current = null;
  }, [remoteUserId, onCallLog]);

  // Create peer connection with event handlers
  const createPeerConnection = useCallback(
    (targetId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("webrtc:ice-candidate", {
            targetId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        if (remoteAudio.current) {
          remoteAudio.current.srcObject = event.streams[0];
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed"
        ) {
          cleanup();
        }
      };

      peerConnection.current = pc;
      return pc;
    },
    [socket, cleanup],
  );

  // Start a call (caller side)
  const startCall = useCallback(
    async (targetId: string, callerName: string) => {
      if (!socket || callState !== "idle") return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        localStream.current = stream;

        setCallState("calling");
        setRemoteUserId(targetId);
        isCaller.current = true;

        socket.emit("call:initiate", {
          callerId: userId,
          callerName,
          receiverId: targetId,
        });

        const pc = createPeerConnection(targetId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      } catch (err) {
        console.error("Failed to access microphone:", err);
        cleanup();
      }
    },
    [socket, userId, callState, createPeerConnection, cleanup],
  );

  // Accept incoming call (receiver side)
  const acceptCall = useCallback(async () => {
    if (!socket || !remoteUserId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;

      socket.emit("call:accept", {
        callerId: remoteUserId,
        receiverId: userId,
      });

      const pc = createPeerConnection(remoteUserId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Create and send offer (receiver creates offer after accepting)
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("webrtc:offer", {
        targetId: remoteUserId,
        offer,
      });

      callStartTime.current = Date.now();
      setCallState("connected");
    } catch (err) {
      console.error("Failed to accept call:", err);
      cleanup();
    }
  }, [socket, userId, remoteUserId, createPeerConnection, cleanup]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (!socket || !remoteUserId) return;

    socket.emit("call:reject", {
      callerId: remoteUserId,
      receiverId: userId,
    });
    cleanup();
  }, [socket, userId, remoteUserId, cleanup]);

  // End active call
  const endCall = useCallback(() => {
    if (!socket || !remoteUserId) return;

    socket.emit("call:end", { targetId: remoteUserId });
    cleanup();
  }, [socket, remoteUserId, cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, []);

  // Listen for signaling events
  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data: { callerId: string; callerName: string }) => {
      if (callState !== "idle") return;
      setCallState("incoming");
      setRemoteUserId(data.callerId);
      setRemoteUserName(data.callerName);

      // Acknowledge to the caller that our app is active and ringing
      socket.emit("call:ringing", {
        callerId: data.callerId,
        receiverId: userId,
      });
    };

    const handleRinging = () => {
      setCallState((current) => (current === "calling" ? "ringing" : current));
    };

    const handleAccepted = () => {
      callStartTime.current = Date.now();
      setCallState("connected");
    };

    const handleRejected = () => {
      cleanup();
    };

    const handleEnded = () => {
      cleanup();
    };

    const handleOffer = async (data: { offer: RTCSessionDescriptionInit }) => {
      const pc = peerConnection.current;
      if (!pc) return;

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc:answer", {
        targetId: remoteUserId,
        answer,
      });
      setCallState("connected");
    };

    const handleAnswer = async (data: {
      answer: RTCSessionDescriptionInit;
    }) => {
      const pc = peerConnection.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    };

    const handleIceCandidate = async (data: {
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peerConnection.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error("Failed to add ICE candidate:", err);
      }
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:ringing", handleRinging);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleEnded);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:ringing", handleRinging);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleEnded);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
    };
  }, [socket, callState, remoteUserId, userId, cleanup]);

  return {
    callState,
    remoteUserName,
    isMuted,
    remoteAudio,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  };
}
