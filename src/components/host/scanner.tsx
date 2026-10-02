"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Camera, CameraOff, LoaderCircle, QrCode } from "lucide-react";
import type { IDetectedBarcode, IScannerError, IScannerProps } from "@yudiel/react-qr-scanner";
import { Button } from "@/components/ui/button";

function CameraLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-background/70">
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
    // The one dark surface on the page. The theme has no dark token, so it is the foreground color.
    <section
      aria-label="Ticket scanner"
      className="flex flex-col items-center gap-4 rounded-2xl bg-foreground p-4 text-background"
    >
      {/* One frame for the placeholder and the camera, so nothing below it moves.
          The width is also capped by the screen height, so it stays square on a short screen. */}
      <div className="relative aspect-square w-full max-w-[min(20rem,50svh)] overflow-hidden rounded-[1.75rem] border border-background/20 bg-background/10">
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
          <div className="absolute inset-0 flex items-center justify-center">
            {error ? (
              <CameraOff aria-hidden className="size-12 text-background/70" />
            ) : (
              <Camera aria-hidden className="size-12 text-background/70" />
            )}
          </div>
        )}
      </div>

      {/* Reserved height, so the hint and a longer camera error take the same room. */}
      <div className="flex min-h-12 w-full items-center justify-center">
        {error ? (
          <p role="alert" className="max-w-xs text-center text-sm text-pretty break-words text-background">
            {error}
          </p>
        ) : (
          <p className="flex max-w-xs items-center gap-2 text-sm text-pretty text-background/70">
            <QrCode aria-hidden className="size-5 shrink-0" />
            Point the camera at a student&apos;s ticket
          </p>
        )}
      </div>

      {/* Start and stop share one row for the same reason. */}
      {scanning ? (
        <Button
          type="button"
          variant="outline"
          onClick={stop}
          className="h-12 w-full touch-manipulation border-background/20 bg-background/10 text-base text-background hover:bg-background/20 hover:text-background focus-visible:ring-background/60"
        >
          <CameraOff aria-hidden className="size-5" />
          Stop scanning
        </Button>
      ) : (
        <Button
          type="button"
          onClick={start}
          className="h-12 w-full touch-manipulation bg-background text-base text-foreground hover:bg-background/90 focus-visible:ring-background/60"
        >
          <Camera aria-hidden className="size-5" />
          {error ? "Try again" : "Start scanning"}
        </Button>
      )}
    </section>
  );
}
