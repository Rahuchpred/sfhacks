"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/db";
import { cn } from "@/lib/utils";
import { errorMessage } from "./form-utils";

// Matches the uploads bucket: JPEG, PNG or WebP, 5 MB at most.
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export type ImageDropProps = {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  tone?: "event" | "food";
  disabled?: boolean;
};

export function ImageDrop({
  label,
  hint,
  value,
  onChange,
  onUploadingChange,
  tone = "event",
  disabled,
}: ImageDropProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadId = useRef(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That image is over 5 MB. Pick a smaller one.");
      return;
    }

    const id = ++uploadId.current;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const url = await uploadImage(file);
      if (id === uploadId.current) onChange(url);
    } catch (uploadError) {
      if (id === uploadId.current) {
        setPreview(null);
        setError(errorMessage(uploadError, "Upload failed. Try again."));
      }
    } finally {
      if (id === uploadId.current) {
        setUploading(false);
        onUploadingChange?.(false);
      }
    }
  }

  function remove() {
    uploadId.current++;
    setPreview(null);
    setError(null);
    if (uploading) {
      setUploading(false);
      onUploadingChange?.(false);
    }
    if (inputRef.current) inputRef.current.value = "";
    onChange(null);
  }

  // The local preview only counts while this upload is in flight or still the current value.
  const shown = value ? (preview ?? value) : uploading ? preview : null;

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED.join(",")}
        className="peer sr-only"
        disabled={disabled || uploading}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      {shown ? (
        <div className="relative overflow-hidden rounded-xl border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown}
            alt={`${label} preview`}
            width={640}
            height={360}
            className={cn("max-h-72 w-full object-contain", uploading && "opacity-50")}
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Uploading…
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 h-8"
            onClick={remove}
            disabled={disabled}
          >
            <X aria-hidden />
            Remove
          </Button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFile(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-input px-4 py-6 text-center transition-colors",
            "peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
            tone === "food" ? "hover:border-accent hover:bg-accent/10" : "hover:border-primary/60 hover:bg-primary/5",
            dragging && (tone === "food" ? "border-accent bg-accent/15" : "border-primary bg-primary/10"),
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-full",
              tone === "food" ? "bg-accent/20 text-accent-foreground" : "bg-primary/10 text-primary",
            )}
          >
            <ImagePlus className="size-5" aria-hidden />
          </span>
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-pretty text-muted-foreground">
            {hint ?? "Drop an image here or click to choose. JPEG, PNG or WebP, up to 5 MB."}
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
