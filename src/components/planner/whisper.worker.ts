// Speech to text on the device: Whisper runs in this web worker through
// transformers.js. Audio never leaves the browser. Only the model files are
// downloaded, once, and the browser caches them.
import { pipeline } from "@huggingface/transformers";

const MODEL = "onnx-community/whisper-tiny.en";

export type WhisperRequest =
  | { type: "load" }
  // 16 kHz mono samples.
  | { type: "transcribe"; id: number; audio: Float32Array };

export type WhisperReply =
  // Download progress over all model files, 0 to 1.
  | { type: "progress"; progress: number }
  | { type: "ready"; device: "webgpu" | "wasm" }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id: number | null; message: string };

type Transcriber = (
  audio: Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text: string } | { text: string }[]>;

const scope = self as unknown as {
  postMessage: (reply: WhisperReply) => void;
  addEventListener: (type: "message", handler: (event: MessageEvent<WhisperRequest>) => void) => void;
};

type FileProgress = { status: string; file?: string; loaded?: number; total?: number };

function reportProgress() {
  const files = new Map<string, { loaded: number; total: number }>();
  let shown = 0;
  return (event: FileProgress) => {
    // Only the two model files count. The small config files finish at once
    // and would make the bar jump to the end and back.
    if (event.status !== "progress" || !event.file?.endsWith(".onnx") || !event.total) return;
    files.set(event.file, { loaded: event.loaded ?? 0, total: event.total });
    let loaded = 0;
    let total = 0;
    for (const file of files.values()) {
      loaded += file.loaded;
      total += file.total;
    }
    // Never move backwards when the second file joins the count.
    shown = Math.max(shown, loaded / total);
    scope.postMessage({ type: "progress", progress: shown });
  };
}

async function hasWebGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    return gpu ? (await gpu.requestAdapter()) !== null : false;
  } catch {
    return false;
  }
}

// The typed overloads of pipeline() are too large for the compiler here.
const create = pipeline as unknown as (
  task: string,
  model: string,
  options: Record<string, unknown>,
) => Promise<Transcriber>;

async function load(): Promise<Transcriber> {
  const progress_callback = reportProgress();
  if (await hasWebGpu()) {
    try {
      // The encoder is the heavy half, so it gets the GPU. The small quantized
      // decoder stays on WASM, which keeps the download small.
      const transcriber = await create("automatic-speech-recognition", MODEL, {
        device: { encoder_model: "webgpu", decoder_model_merged: "wasm" },
        dtype: { encoder_model: "fp32", decoder_model_merged: "q8" },
        progress_callback,
      });
      scope.postMessage({ type: "ready", device: "webgpu" });
      return transcriber;
    } catch {
      // Fall through to WASM.
    }
  }
  const transcriber = await create("automatic-speech-recognition", MODEL, {
    device: "wasm",
    dtype: "q8",
    progress_callback,
  });
  scope.postMessage({ type: "ready", device: "wasm" });
  return transcriber;
}

let loading: Promise<Transcriber> | null = null;
function transcriber(): Promise<Transcriber> {
  loading ??= load().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

// Whisper writes silence as "[BLANK_AUDIO]" or "(silence)".
function clean(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// One job at a time, in order.
let queue: Promise<void> = Promise.resolve();

scope.addEventListener("message", (event) => {
  const request = event.data;
  queue = queue.then(async () => {
    const id = request.type === "transcribe" ? request.id : null;
    try {
      const run = await transcriber();
      if (request.type !== "transcribe") return;
      const output = await run(
        request.audio,
        // Longer than one 30 second window: read it in overlapping chunks.
        request.audio.length > 30 * 16_000 ? { chunk_length_s: 30, stride_length_s: 5 } : {},
      );
      const text = Array.isArray(output) ? output.map((part) => part.text).join(" ") : output.text;
      scope.postMessage({ type: "result", id: request.id, text: clean(text) });
    } catch (error) {
      scope.postMessage({
        type: "error",
        id,
        message: error instanceof Error ? error.message : "Speech model failed.",
      });
    }
  });
});
