import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "../../../shared/services/SocketContext";
import { useAuth } from "../../../shared/hooks/useAuth";

function buildRTCConfig() {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ];

  const envTurn = import.meta.env.VITE_TURN_URLS;
  if (envTurn) {
    try {
      const turnServers = JSON.parse(envTurn);
      if (Array.isArray(turnServers)) {
        turnServers.forEach((s) => servers.push(s));
      }
    } catch {
      const parts = envTurn.split(",").map((s) => s.trim()).filter(Boolean);
      parts.forEach((url) => servers.push({ urls: url }));
    }
  }

  return { iceServers: servers, iceCandidatePoolSize: 10 };
}

const RTC_CONFIG = buildRTCConfig();

export function useWebRTC({ serverId, channel, enabled }) {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [screenShareStreams, setScreenShareStreams] = useState({});
  const [participants, setParticipants] = useState([]);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const [connectionQuality, setConnectionQuality] = useState({});
  const [error, setError] = useState(null);

  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef({});
  const screenPeersRef = useRef({});
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const speakingIntervalRef = useRef(null);
  const pendingCandidatesRef = useRef({});
  const pendingScreenCandidatesRef = useRef({});

  const userId = user?.id;

  const cleanupPeerConnection = useCallback((peerId) => {
    const pc = peersRef.current[peerId];
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
      delete peersRef.current[peerId];
    }
    const spc = screenPeersRef.current[peerId];
    if (spc) {
      spc.ontrack = null;
      spc.onicecandidate = null;
      spc.onconnectionstatechange = null;
      spc.close();
      delete screenPeersRef.current[peerId];
    }
    delete pendingCandidatesRef.current[peerId];
    delete pendingScreenCandidatesRef.current[peerId];
  }, []);

  const createPeerConnection = useCallback((peerId, stream, isScreen = false) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peersMap = isScreen ? screenPeersRef : peersRef;
    const pendingMap = isScreen ? pendingScreenCandidatesRef : pendingCandidatesRef;

    if (stream) {
      stream.getTracks().forEach((track) => {
        if (stream === localStreamRef.current || stream === screenStreamRef.current) {
          pc.addTrack(track, stream);
        }
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const eventName = isScreen ? "screen-ice-candidate" : "ice-candidate";
        socket?.emit(eventName, { to: peerId, candidate: e.candidate, serverId, channel });
      }
    };

    pc.ontrack = (e) => {
      const streamKey = isScreen ? `screen-${peerId}` : peerId;
      const setter = isScreen ? setScreenShareStreams : setRemoteStreams;
      setter((prev) => ({
        ...prev,
        [streamKey]: e.streams[0] || new MediaStream([e.track]),
      }));
    };

    pc.onconnectionstatechange = () => {
      const quality = pc.connectionState;
      setConnectionQuality((prev) => ({
        ...prev,
        [peerId]: quality,
      }));
      if (quality === "failed" || quality === "disconnected") {
        cleanupPeerConnection(peerId);
      }
    };

    peersMap.current[peerId] = pc;

    if (pendingMap.current[peerId]) {
      pendingMap.current[peerId].forEach((candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      });
      delete pendingMap.current[peerId];
    }

    return pc;
  }, [socket, serverId, channel, cleanupPeerConnection]);

  const startLocalStream = useCallback(async (withVideo = false) => {
    try {
      const constraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: withVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setError(null);

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      return stream;
    } catch (err) {
      setError("Microphone permission denied. Please allow microphone access.");
      return null;
    }
  }, []);

  const startSpeakingDetection = useCallback(() => {
    if (speakingIntervalRef.current) return;
    speakingIntervalRef.current = setInterval(() => {
      if (!analyserRef.current) return;
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const isSpeaking = avg > 15;
      socket?.emit("speaking", { serverId, channel, speaking: isSpeaking });
    }, 200);
  }, [socket, serverId, channel]);

  const stopSpeakingDetection = useCallback(() => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }
    socket?.emit("speaking", { serverId, channel, speaking: false });
  }, [socket, serverId, channel]);

  const toggleCamera = useCallback(async () => {
    if (cameraEnabled) {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
        const audioTracks = localStreamRef.current.getAudioTracks();
        const newStream = new MediaStream(audioTracks);
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      }
      setCameraEnabled(false);
      socket?.emit("video-toggle", { serverId, channel, enabled: false });
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        });
        const currentStream = localStreamRef.current;
        if (currentStream) {
          videoStream.getVideoTracks().forEach((t) => currentStream.addTrack(t));
          setLocalStream(new MediaStream(currentStream.getTracks()));
        }
        setCameraEnabled(true);
        socket?.emit("video-toggle", { serverId, channel, enabled: true });
      } catch {
        setError("Camera permission denied");
      }
    }
  }, [cameraEnabled, socket, serverId, channel]);

  const createScreenOffer = useCallback(async (peerId) => {
    const stream = screenStreamRef.current;
    if (!stream) return;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket?.emit("screen-ice-candidate", { to: peerId, candidate: e.candidate, serverId, channel });
      }
    };
    pc.ontrack = (e) => {
      setScreenShareStreams((prev) => ({ ...prev, [peerId]: e.streams[0] || new MediaStream([e.track]) }));
    };
    screenPeersRef.current[peerId] = pc;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit("screen-offer", { to: peerId, offer, serverId, channel });
    } catch (err) {
      console.error("Error creating screen offer:", err);
    }
  }, [socket, serverId, channel]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: true,
      });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setScreenSharing(true);
      socket?.emit("screen-share-start", { serverId, channel });

      Object.keys(peersRef.current).forEach((peerId) => {
        createScreenOffer(peerId);
      });

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopScreenShare();
      });

      return stream;
    } catch {
      setScreenSharing(false);
      return null;
    }
  }, [socket, serverId, channel, createScreenOffer]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }
    setScreenSharing(false);
    socket?.emit("screen-share-stop", { serverId, channel });

    Object.values(screenPeersRef.current).forEach((pc) => {
      pc.close();
    });
    screenPeersRef.current = {};
    setScreenShareStreams({});
  }, [socket, serverId, channel]);

  const joinVoice = useCallback(async () => {
    const stream = await startLocalStream();
    if (!stream) return;
    socket?.emit("voice-join", { serverId, channel });
    startSpeakingDetection();
  }, [socket, serverId, channel, startLocalStream, startSpeakingDetection]);

  const leaveVoice = useCallback(() => {
    stopSpeakingDetection();
    socket?.emit("voice-leave", { serverId, channel });

    Object.keys(peersRef.current).forEach((peerId) => {
      cleanupPeerConnection(peerId);
    });

    if (screenSharing) stopScreenShare();

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStreams({});
    setScreenShareStreams({});
    setParticipants([]);
    setCameraEnabled(false);
    setSpeakingUsers(new Set());
    setConnectionQuality({});
    setError(null);
    analyserRef.current = null;
  }, [socket, serverId, channel, stopSpeakingDetection, screenSharing, stopScreenShare, cleanupPeerConnection]);

  const initiateCall = useCallback(async (peerId, isScreen = false) => {
    const stream = isScreen ? screenStreamRef.current : localStreamRef.current;
    if (!stream) return;

    const pc = createPeerConnection(peerId, stream, isScreen);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const eventName = isScreen ? "screen-offer" : "video-offer";
      socket?.emit(eventName, { to: peerId, offer, serverId, channel });
    } catch (err) {
      console.error("Error creating offer:", err);
    }
  }, [socket, serverId, channel, createPeerConnection]);

  useEffect(() => {
    if (!socket || !enabled || !serverId || !channel) return;

    const handleVoiceUserJoined = async ({ userId: joinedUserId, userName }) => {
      setParticipants((prev) => [...prev.filter((p) => p.userId !== joinedUserId), { userId: joinedUserId, userName }]);
    };

    const handleVoiceUserLeft = ({ userId: leftUserId }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== leftUserId));
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[leftUserId];
        delete next[`screen-${leftUserId}`];
        return next;
      });
      setScreenShareStreams((prev) => {
        const next = { ...prev };
        delete next[leftUserId];
        delete next[`screen-${leftUserId}`];
        return next;
      });
      cleanupPeerConnection(leftUserId);
    };

    const handleVoiceRoomState = ({ participants: roomParticipants }) => {
      setParticipants(roomParticipants || []);
      if (localStreamRef.current) {
        (roomParticipants || [])
          .filter((p) => p.userId !== userId)
          .forEach((p) => {
            setTimeout(() => initiateCall(p.userId), 500);
            if (screenStreamRef.current) {
              setTimeout(() => createScreenOffer(p.userId), 800);
            }
          });
      }
    };

    const handleVideoOffer = async ({ from, offer }) => {
      const stream = localStreamRef.current;
      if (!stream) return;
      if (peersRef.current[from]) return;
      const pc = createPeerConnection(from, stream, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit("video-answer", { to: from, answer, serverId, channel });
      } catch (err) {
        console.error("Error handling video offer:", err);
      }
    };

    const handleVideoAnswer = async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (pc && pc.currentRemoteDescription === null) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("Error setting remote description:", err);
        }
      }
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch { /* ignore */ }
      } else {
        if (!pendingCandidatesRef.current[from]) pendingCandidatesRef.current[from] = [];
        pendingCandidatesRef.current[from].push(candidate);
      }
    };

    const handleScreenOffer = async ({ from, offer }) => {
      if (screenPeersRef.current[from]) return;
      const pc = createPeerConnection(from, null, true);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit("screen-answer", { to: from, answer, serverId, channel });
      } catch (err) {
        console.error("Error handling screen offer:", err);
      }
    };

    const handleScreenAnswer = async ({ from, answer }) => {
      const pc = screenPeersRef.current[from];
      if (pc && pc.currentRemoteDescription === null) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("Error setting screen remote description:", err);
        }
      }
    };

    const handleScreenIceCandidate = async ({ from, candidate }) => {
      const pc = screenPeersRef.current[from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch { /* ignore */ }
      } else {
        if (!pendingScreenCandidatesRef.current[from]) pendingScreenCandidatesRef.current[from] = [];
        pendingScreenCandidatesRef.current[from].push(candidate);
      }
    };

    const handleSpeaking = ({ userId: speakingUserId, speaking }) => {
      setSpeakingUsers((prev) => {
        const next = new Set(prev);
        if (speaking) next.add(speakingUserId);
        else next.delete(speakingUserId);
        return next;
      });
    };

    const handleVideoToggle = ({ userId: toggledUserId, enabled }) => {
      if (!enabled) {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[toggledUserId];
          return next;
        });
      }
    };

    const handleScreenShareStarted = () => {
    };

    const handleScreenShareStopped = ({ userId: sharerUserId }) => {
      setScreenShareStreams((prev) => {
        const next = { ...prev };
        delete next[sharerUserId];
        delete next[`screen-${sharerUserId}`];
        return next;
      });
      const spc = screenPeersRef.current[sharerUserId];
      if (spc) {
        spc.close();
        delete screenPeersRef.current[sharerUserId];
      }
    };

    socket.on("voice-user-joined", handleVoiceUserJoined);
    socket.on("voice-user-left", handleVoiceUserLeft);
    socket.on("voice-room-state", handleVoiceRoomState);
    socket.on("video-offer", handleVideoOffer);
    socket.on("video-answer", handleVideoAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("screen-offer", handleScreenOffer);
    socket.on("screen-answer", handleScreenAnswer);
    socket.on("screen-ice-candidate", handleScreenIceCandidate);
    socket.on("speaking", handleSpeaking);
    socket.on("video-toggle", handleVideoToggle);
    socket.on("screen-share-started", handleScreenShareStarted);
    socket.on("screen-share-stopped", handleScreenShareStopped);

    return () => {
      socket.off("voice-user-joined", handleVoiceUserJoined);
      socket.off("voice-user-left", handleVoiceUserLeft);
      socket.off("voice-room-state", handleVoiceRoomState);
      socket.off("video-offer", handleVideoOffer);
      socket.off("video-answer", handleVideoAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("screen-offer", handleScreenOffer);
      socket.off("screen-answer", handleScreenAnswer);
      socket.off("screen-ice-candidate", handleScreenIceCandidate);
      socket.off("speaking", handleSpeaking);
      socket.off("video-toggle", handleVideoToggle);
      socket.off("screen-share-started", handleScreenShareStarted);
      socket.off("screen-share-stopped", handleScreenShareStopped);
    };
  }, [socket, enabled, serverId, channel, userId, createPeerConnection, initiateCall, cleanupPeerConnection]);

  return {
    localStream,
    screenStream,
    remoteStreams,
    screenShareStreams,
    participants,
    cameraEnabled,
    screenSharing,
    speakingUsers,
    connectionQuality,
    error,
    joinVoice,
    leaveVoice,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    startLocalStream,
  };
}

export default useWebRTC;
