"use client";

import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

type TicketQrProps = {
  code: string; // the 8-character ticket code, the only thing the QR encodes
  size?: number; // rendered width and height in px
  className?: string;
};

// The ticket a student shows at the door: a QR code with the code in text below it,
// so the host can type it by hand if the camera fails.
export function TicketQr({ code, size = 200, className }: TicketQrProps) {
  return (
    <figure className={cn("flex flex-col items-center gap-3", className)}>
      <div className="rounded-xl border bg-white p-3">
        <QRCodeSVG
          value={code}
          size={size}
          level="M"
          role="img"
          aria-label={`QR code for ticket ${code}`}
          className="h-auto max-w-full"
        />
      </div>
      <figcaption translate="no" className="font-mono text-lg font-semibold tracking-[0.3em]">
        {code}
      </figcaption>
    </figure>
  );
}
