"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Camera, CameraOff, LoaderCircle } from "lucide-react";
import type { IDetectedBarcode, IScannerError, IScannerProps } from "@yudiel/react-qr-scanner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CameraLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
      Starting camera…
    </div>
  );
}

// Loaded in the browser only, and only once the host asks to scan: mounting it requests the camera.
const QrScanner = dynamic(() => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner), {
  ssr: false,
  loading: CameraLoading,
});

// Stable references, so the library does not restart the camera on every render.
const FORMATS: IScannerProps["formats"] = ["qr_code"];
// Back camera. Loose sizes: the library defaults demand at least 640px, which some webcams reject.
const CONSTRAINTS: MediaTrackConstraints = {
  facingMode: "environment",
  width: { ideal: 1280 },
  height: { ideal: 1280 },
};
const COMPONENTS: IScannerProps["components"] = {
  finder: true,
  torch: true,
  onOff: false,
  zoom: false,
};
const CLASS_NAMES: IScannerProps["classNames"] = { video: "object-cover" };

const UNSUPPORTED = "This browser cannot use the camera here. Type the code below.";

function errorMessage(kind: IScannerError["kind"]): string {
  switch (kind) {
    case "permission-denied":
      return "Camera access is blocked. Allow the camera for this site in your browser settings, then press Start scanning. You can also type the code below.";
    case "no-camera":
    case "overconstrained":
      return "No camera found on this device. Type the code below.";
    case "insecure-context":
    case "unsupported":
      return UNSUPPORTED;
    default:
      return "The camera could not start. Type the code below.";
  }
}

export function Scanner({
  onCode,
  paused,
}: {
  onCode: (code: string) => void;
  paused?: boolean;
}) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    // Checked here, on the press, so nothing touches navigator during render.
    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.getUserMedia !== "function" ||
      (typeof window !== "undefined" && window.isSecureContext === false)
    ) {
      setError(UNSUPPORTED);
      setScanning(false);
      return;
    }
    setError(null);
    setScanning(true);
  }

  function stop() {
    setScanning(false);
  }

  function handleScan(codes: IDetectedBarcode[]) {
    const value = codes.find((code) => code.rawValue)?.rawValue;
    if (value) onCode(value);
  }

  function handleError(scanError: IScannerError) {
    setScanning(false);
    setError(errorMessage(scanError.kind));
  }

  return (
    <section aria-label="Ticket scanner" className="flex flex-col gap-3">
      {/* One box for the placeholder and the camera, so nothing below it moves. */}
      <div
        className={cn(
          "relative mx-auto aspect-square max-h-[60vh] w-full overflow-hidden rounded-2xl bg-muted",
          error && "ring-1 ring-destructive/40",
        )}
      >
        {scanning ? (
          <div className="absolute inset-0">
            <QrScanner
              onScan={handleScan}
              onError={handleError}
              constraints={CONSTRAINTS}
              formats={FORMATS}
              paused={paused}
              components={COMPONENTS}
              classNames={CLASS_NAMES}
              sound={false}
              // Keep reporting a code while it stays in frame. The check-in page decides what is a repeat.
              allowMultiple
              scanDelay={400}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-background">
              {error ? (
                <CameraOff aria-hidden className="size-7 text-destructive" />
              ) : (
                <Camera aria-hidden className="size-7 text-primary" />
              )}
            </div>
            {error ? (
              <p role="alert" className="max-w-xs text-sm text-pretty break-words text-foreground">
                {error}
              </p>
            ) : (
              <p className="max-w-xs text-sm text-pretty text-muted-foreground">
                Point the camera at a student&apos;s ticket
              </p>
            )}
          </div>
        )}
      </div>

      {/* Start and stop share one row for the same reason. */}
      {scanning ? (
        <Button
          type="button"
          variant="outline"
          onClick={stop}
          className="h-12 w-full touch-manipulation text-base"
        >
          <CameraOff aria-hidden className="size-5" />
          Stop scanning
        </Button>
      ) : (
        <Button type="button" onClick={start} className="h-12 w-full touch-manipulation text-base">
          <Camera aria-hidden className="size-5" />
          {error ? "Try again" : "Start scanning"}
        </Button>
      )}
    </section>
  );
}
