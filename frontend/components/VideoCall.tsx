"use client";

import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type Props = { roomId: string };

const SIGNALING_URL = "http://localhost:5000"; 

export default function VideoCall({ roomId }: Props) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState("init");

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    remoteStreamRef.current = new MediaStream();
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }

    pc.ontrack = (event) => {
      // add tracks to remote stream
      event.streams[0].getTracks().forEach((t) => {
        remoteStreamRef.current?.addTrack(t);
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("webrtc:ice", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    return pc;
  };

  const startMedia = async () => {
    setStatus("getting-media");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true; // avoid echo
      await localVideoRef.current.play().catch(() => {});
    }

    setStatus("media-ready");
    return stream;
  };

  const makeOffer = async () => {
    const pc = pcRef.current!;
    setStatus("creating-offer");

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current?.emit("webrtc:offer", { roomId, offer });
    setStatus("offer-sent");
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // 1) media
        const stream = await startMedia();
        if (!mounted) return;

        // 2) socket
        const socket = io(SIGNALING_URL, { transports: ["websocket"] });
        socketRef.current = socket;

        // 3) peer connection
        const pc = createPeerConnection();
        pcRef.current = pc;

        // add local tracks
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        socket.on("connect", () => {
          setStatus("connected");
          socket.emit("room:join", { roomId });
        });

        // when another user joined, this client can become caller and create offer
        socket.on("room:user-joined", async () => {
          // If you want only one side to offer, this is fine.
          // If both may offer at the same time, you’ll need “perfect negotiation”.
          await makeOffer();
        });

        socket.on("webrtc:offer", async ({ offer }) => {
          setStatus("got-offer");
          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("webrtc:answer", { roomId, answer });
          setStatus("answer-sent");
        });

        socket.on("webrtc:answer", async ({ answer }) => {
          setStatus("got-answer");
          await pc.setRemoteDescription(answer);
          setStatus("in-call");
        });

        socket.on("webrtc:ice", async ({ candidate }) => {
          try {
            await pc.addIceCandidate(candidate);
          } catch {
            // ignore
          }
        });

        socket.on("room:user-left", () => {
          setStatus("peer-left");
          // Optional: clear remote stream
          if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach((t) => t.stop());
            remoteStreamRef.current = new MediaStream();
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
          }
        });
      } catch (e) {
        console.error(e);
        setStatus("error");
      }
    })();

    return () => {
      mounted = false;

      socketRef.current?.disconnect();
      socketRef.current = null;

      pcRef.current?.close();
      pcRef.current = null;

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [roomId]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>Video Call</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Status: {status}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }}>
          <div style={{ padding: 8, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>You</div>
          <video ref={localVideoRef} autoPlay playsInline style={{ width: "100%", height: 260, background: "#000" }} />
        </div>

        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }}>
          <div style={{ padding: 8, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>Guest</div>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: 260, background: "#000" }} />
        </div>
      </div>
    </div>
  );
}