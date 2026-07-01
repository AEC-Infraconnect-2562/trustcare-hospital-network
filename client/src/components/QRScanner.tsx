import { Button } from "@/components/ui/button";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  width?: number;
  height?: number;
  fps?: number;
  aspectRatio?: number;
}

type ScannerState = "idle" | "starting" | "scanning" | "paused" | "error";

export default function QRScanner({
  onScanSuccess,
  onScanError,
  width = 320,
  height = 320,
  fps = 10,
  aspectRatio = 1.0,
}: QRScannerProps) {
  const [state, setState] = useState<ScannerState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [lastScanned, setLastScanned] = useState<string>("");
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const scannerState = scannerRef.current.getState();
        if (scannerState === 2 || scannerState === 3) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore cleanup errors
      }
      scannerRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    setState("starting");
    setErrorMessage("");
    setLastScanned("");

    try {
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import("html5-qrcode");

      // Stop any existing scanner
      await stopScanner();

      const containerId = "qr-scanner-container";
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps,
          qrbox: { width: Math.min(width, 280), height: Math.min(height, 280) },
          aspectRatio,
          disableFlip: false,
        },
        (decodedText) => {
          if (!mountedRef.current) return;
          setLastScanned(decodedText);
          onScanSuccess(decodedText);
          // Pause after successful scan
          scanner.pause(true);
          if (mountedRef.current) setState("paused");
        },
        () => {
          // QR not found in frame — ignore
        }
      );

      if (mountedRef.current) setState("scanning");
    } catch (err: any) {
      const message =
        err?.message?.includes("NotAllowedError") || err?.message?.includes("Permission")
          ? "กรุณาอนุญาตการเข้าถึงกล้อง (Camera permission denied)"
          : err?.message?.includes("NotFoundError")
            ? "ไม่พบกล้องในอุปกรณ์นี้ (No camera found)"
            : err?.message?.includes("NotReadableError")
              ? "กล้องถูกใช้งานอยู่โดยแอปอื่น (Camera in use)"
              : `เกิดข้อผิดพลาด: ${err?.message || "Unknown error"}`;

      if (mountedRef.current) {
        setState("error");
        setErrorMessage(message);
        onScanError?.(message);
      }
    }
  }, [fps, width, height, aspectRatio, onScanSuccess, onScanError, stopScanner]);

  const resumeScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.resume();
        setState("scanning");
        setLastScanned("");
      } catch {
        await startScanner();
      }
    } else {
      await startScanner();
    }
  }, [startScanner]);

  const handleStop = useCallback(async () => {
    await stopScanner();
    setState("idle");
    setLastScanned("");
  }, [stopScanner]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Scanner viewport */}
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/30 bg-black/5"
        style={{ minHeight: state === "idle" || state === "error" ? "280px" : undefined }}
      >
        {(state === "idle" || state === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
              <Camera className="h-10 w-10 text-muted-foreground/60" />
            </div>
            {state === "error" && (
              <p className="text-sm text-destructive text-center max-w-[260px]">{errorMessage}</p>
            )}
            <Button onClick={startScanner} className="gap-2">
              <Camera className="h-4 w-4" />
              {state === "error" ? "ลองใหม่" : "เปิดกล้องสแกน"}
            </Button>
          </div>
        )}

        {state === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">กำลังเปิดกล้อง...</p>
          </div>
        )}

        {/* html5-qrcode mounts video here */}
        <div
          id="qr-scanner-container"
          ref={containerRef}
          className={state === "scanning" || state === "paused" ? "block" : "hidden"}
        />

        {/* Scan overlay frame */}
        {state === "scanning" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[200px] w-[200px] border-2 border-primary/60 rounded-lg animate-pulse" />
          </div>
        )}

        {/* Paused overlay */}
        {state === "paused" && (
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3">
            <div className="bg-background/90 rounded-lg px-4 py-3 text-center max-w-[280px]">
              <p className="text-sm font-medium text-foreground">สแกนสำเร็จ</p>
              <p className="text-xs text-muted-foreground mt-1 break-all line-clamp-2">
                {lastScanned.length > 80 ? `${lastScanned.slice(0, 80)}...` : lastScanned}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {(state === "scanning" || state === "paused") && (
        <div className="flex gap-2">
          {state === "paused" && (
            <Button variant="outline" onClick={resumeScanner} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              สแกนใหม่
            </Button>
          )}
          <Button variant="ghost" onClick={handleStop} className="gap-2 text-muted-foreground">
            <CameraOff className="h-4 w-4" />
            ปิดกล้อง
          </Button>
        </div>
      )}
    </div>
  );
}
