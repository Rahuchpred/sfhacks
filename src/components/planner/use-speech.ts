"use client";

// Microphone to text, all in the browser. Samples are captured at 16 kHz and
// sent to the Whisper worker: every second or so for the live transcript, and
// once more when the speaker stops.
import { useCallback, useEffect, useRef, useState } from "react";
import type { WhisperReply, WhisperRequest } from "./whisper.worker";

const RATE = 16_000;
// Louder than this counts as speech.
const SPEECH_LEVEL = 0.015;
// Stop after this much quiet once the speaker has said something.
const QUIET_AFTER_SPEECH_MS = 2200;
// Stop when nothing was said at all.
const QUIET_FROM_START_MS = 8000;
const MAX_MS = 90_000;
const LIVE_EVERY_MS = 1200;

const TAP = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("tap", Tap);
`;

export type SpeechStatus = "idle" | "listening" | "transcribing";

type Listener = (reply: WhisperReply) => void;

// One worker for the page's lifetime, so the model loads once.
let worker: Worker | null = null;
let modelReady = false;
const listeners = new Set<Listener>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<WhisperReply>) => {
      if (event.data.type === "ready") modelReady = true;
      for (const listener of listeners) listener(event.data);
    });
  }
  return worker;
}

function send(request: WhisperRequest, transfer: Transferable[] = []) {
  getWorker().postMessage(request, transfer);
}

function join(chunks: Float32Array[], from = 0): Float32Array {
  let length = 0;
  for (const chunk of chunks) length += chunk.length;
  const all = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return from > 0 ? all.slice(from) : all;
}

// Browsers that ignore the requested rate still have to hand Whisper 16 kHz.
function resample(samples: Float32Array, rate: number): Float32Array {
  if (rate === RATE) return samples;
  const length = Math.floor((samples.length * RATE) / rate);
  const out = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const position = (index * rate) / RATE;
    const left = Math.floor(position);
    const right = Math.min(left + 1, samples.length - 1);
    out[index] = samples[left] + (samples[right] - samples[left]) * (position - left);
  }
  return out;
}

type Session = {
  stream: MediaStream;
  context: AudioContext;
  chunks: Float32Array[];
  startedAt: number;
  lastLoudAt: number | null;
  liveTimer: ReturnType<typeof setInterval>;
  liveSentAt: number; // sample count at the last live request
  liveBusy: boolean;
  finalId: number | null;
};

type Options = {
  // The transcript so far, while the speaker is still talking.
  onLive: (text: string) => void;
  // The finished transcript. Empty when nothing was heard.
  onDone: (text: string) => void;
};

export function useSpeech({ onLive, onDone }: Options) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  // Null when the model is ready or not asked for yet, 0 to 1 while it downloads.
  const [download, setDownload] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Loudness right now, 0 to 1. Read by the waveform on each frame.
  const level = useRef(0);
  const session = useRef<Session | null>(null);
  const starting = useRef(false);
  const nextId = useRef(0);
  const handlers = useRef({ onLive, onDone });
  useEffect(() => {
    handlers.current = { onLive, onDone };
  });

  const release = useCallback((current: Session) => {
    clearInterval(current.liveTimer);
    for (const track of current.stream.getTracks()) track.stop();
    current.context.close().catch(() => {});
    level.current = 0;
  }, []);

  const stop = useCallback(() => {
    const current = session.current;
    if (!current || current.finalId !== null) return;
    const rate = current.context.sampleRate;
    release(current);
    const audio = resample(join(current.chunks), rate);
    // Under half a second is a mis-click, not speech.
    if (current.lastLoudAt === null || audio.length < RATE / 2) {
      session.current = null;
      setStatus("idle");
      handlers.current.onDone("");
      return;
    }
    current.finalId = ++nextId.current;
    setStatus("transcribing");
    send({ type: "transcribe", id: current.finalId, audio }, [audio.buffer]);
  }, [release]);

  useEffect(() => {
    const listener: Listener = (reply) => {
      const current = session.current;
      if (reply.type === "progress") setDownload(reply.progress);
      if (reply.type === "ready") setDownload(null);
      if (reply.type === "result" && current) {
        if (reply.id === current.finalId) {
          session.current = null;
          setStatus("idle");
          handlers.current.onDone(reply.text);
        } else if (current.finalId === null) {
          current.liveBusy = false;
          if (reply.text) handlers.current.onLive(reply.text);
        }
      }
      if (reply.type === "error") {
        setDownload(null);
        if (current) {
          if (current.finalId === null) release(current);
          session.current = null;
          setStatus("idle");
        }
        setError("Speech did not load. Type your idea instead.");
      }
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (session.current) release(session.current);
      session.current = null;
    };
  }, [release]);

  const start = useCallback(async () => {
    // A second tap while the microphone is still opening must not open another one.
    if (session.current || starting.current) return;
    starting.current = true;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      starting.current = false;
      setError("No microphone access. Type your idea instead.");
      return;
    }
    try {
      const context = new AudioContext({ sampleRate: RATE });
      const url = URL.createObjectURL(new Blob([TAP], { type: "text/javascript" }));
      await context.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const tap = new AudioWorkletNode(context, "tap");
      context.createMediaStreamSource(stream).connect(tap);

      // The model starts loading while the speaker already talks.
      if (!modelReady) {
        setDownload((current) => current ?? 0);
        send({ type: "load" });
      }

      const current: Session = {
        stream,
        context,
        chunks: [],
        startedAt: performance.now(),
        lastLoudAt: null,
        liveSentAt: 0,
        liveBusy: false,
        finalId: null,
        liveTimer: setInterval(() => {
          if (!modelReady || current.liveBusy || current.lastLoudAt === null) return;
          const total = current.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          if (total - current.liveSentAt < context.sampleRate / 2) return;
          current.liveSentAt = total;
          current.liveBusy = true;
          const audio = resample(join(current.chunks), context.sampleRate);
          send({ type: "transcribe", id: ++nextId.current, audio }, [audio.buffer]);
        }, LIVE_EVERY_MS),
      };
      session.current = current;

      tap.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (current.finalId !== null) return;
        const chunk = event.data;
        current.chunks.push(chunk);
        let sum = 0;
        for (let index = 0; index < chunk.length; index++) sum += chunk[index] * chunk[index];
        const loudness = Math.sqrt(sum / chunk.length);
        level.current = Math.min(1, loudness * 8);
        const now = performance.now();
        if (loudness > SPEECH_LEVEL) current.lastLoudAt = now;
        const quietFor = now - (current.lastLoudAt ?? current.startedAt);
        const limit = current.lastLoudAt === null ? QUIET_FROM_START_MS : QUIET_AFTER_SPEECH_MS;
        // The speaker stopped talking: finish on our own, no button needed.
        if (quietFor > limit || now - current.startedAt > MAX_MS) stop();
      };
      setStatus("listening");
    } catch {
      for (const track of stream.getTracks()) track.stop();
      setError("This browser cannot record. Type your idea instead.");
    } finally {
      starting.current = false;
    }
  }, [stop]);

  return { status, download, error, level, start, stop };
}
