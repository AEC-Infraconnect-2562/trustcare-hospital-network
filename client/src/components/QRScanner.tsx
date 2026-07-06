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
  /** Auto-start camera when component mounts (like RU_VC pattern) */
  autoStart?: boolean;
}

type ScannerState = "idle" | "starting" | "scanning" | "paused" | "error";

export default function QRScanner({
  onScanSuccess,
  onScanError,
  width = 300,
  height = 300,
  fps = 10,
  aspectRatio = 1.0,
  autoStart = false,
}: QRScannerProps) {
  const [state, setState] = useState<ScannerState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [lastScanned, setLastScanned] = useState<string>("");
  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const containerIdRef = useRef(`qr-reader-${Date.now()}`);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, []);

  // Auto-start when autoStart prop is true
  useEffect(() => {
    if (autoStart && !startedRef.current && state === "idle") {
      startedRef.current = true;
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (mountedRef.current) startScanner();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoStart]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const scannerState = scannerRef.current.getState();
        // State 2 = SCANNING, State 3 = PAUSED
        if (scannerState === 2 || scannerState === 3) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore cleanup errors
        try {
          scannerRef.current.clear();
        } catch {
          // double ignore
        }
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

      const containerId = containerIdRef.current;
      
      // Ensure container exists in DOM
      const containerEl = document.getElementById(containerId);
      if (!containerEl) {
        throw new Error("Scanner container not found in DOM");
      }

      const scanner = new Html5Qrcode(containerId, {
        verbose: false,
        formatsToSupport: [0], // QR_CODE only for faster scanning
      });
      scannerRef.current = scanner;

      // Calculate qrbox size based on container
      const qrboxSize = Math.min(width - 40, height - 40, 250);

      await scanner.start(
        { facingMode: "environment" },
        {
          fps,
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio,
          disableFlip: false,
        },
        (decodedText: string) => {
          if (!mountedRef.current) return;
          setLastScanned(decodedText);
          onScanSuccess(decodedText);
          // Pause after successful scan
          try {
            scanner.pause(true);
          } catch {
            // ignore if already stopped
          }
          if (mountedRef.current) setState("paused");
        },
        () => {
          // QR not found in frame — ignore
        }
      );

      if (mountedRef.current) setState("scanning");
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const message =
        errMsg.includes("NotAllowedError") || errMsg.includes("Permission")
          ? "กรุณาอนุญาตการเข้าถึงกล้อง (Camera permission denied)"
          : errMsg.includes("NotFoundError") || errMsg.includes("Requested device not found")
            ? "ไม่พบกล้องในอุปกรณ์นี้ (No camera found)"
            : errMsg.includes("NotReadableError") || errMsg.includes("Could not start video source")
              ? "กล้องถูกใช้งานอยู่โดยแอปอื่น (Camera in use by another app)"
              : errMsg.includes("insecure origin") || errMsg.includes("Only secure origins")
                ? "ต้องใช้ HTTPS เพื่อเข้าถึงกล้อง — กรุณาเปิดผ่าน URL ที่เป็น https://"
                : errMsg.includes("container not found") || errMsg.includes("not found in DOM")
                  ? "กำลังเตรียม UI... กรุณากดเปิดกล้องอีกครั้ง"
                  : `เกิดข้อผิดพลาด: ${errMsg}`;

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
    startedRef.current = false;
  }, [stopScanner]);

  const isActive = state === "scanning" || state === "paused" || state === "starting";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Scanner viewport - MUST have explicit dimensions for html5-qrcode */}
      <div
        className="relative w-full overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/30"
        style={{
          maxWidth: `${width}px`,
          height: `${height}px`,
          backgroundColor: isActive ? "#000" : "rgba(0,0,0,0.03)",
        }}
      >
        {/* Idle state - show camera icon and start button */}
        {state === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 z-10">
            <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
              <Camera className="h-10 w-10 text-muted-foreground/60" />
            </div>
            <Button onClick={startScanner} className="gap-2">
              <Camera className="h-4 w-4" />
              เปิดกล้องสแกน
            </Button>
          </div>
        )}

        {/* Error state */}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 z-10">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <CameraOff className="h-8 w-8 text-destructive/60" />
            </div>
            <p className="text-sm text-destructive text-center max-w-[260px]">{errorMessage}</p>
            <Button onClick={startScanner} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              ลองใหม่
            </Button>
          </div>
        )}

        {/* Starting state - loading spinner */}
        {state === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
            <RefreshCw className="h-8 w-8 text-white animate-spin" />
            <p className="text-sm text-white/80">กำลังเปิดกล้อง...</p>
          </div>
        )}

        {/* 
          html5-qrcode container - ALWAYS rendered in DOM with explicit dimensions.
          This is critical: html5-qrcode needs the element to exist and have dimensions
          BEFORE scanner.start() is called.
        */}
        <div
          id={containerIdRef.current}
          style={{
            width: "100%",
            height: "100%",
            display: isActive ? "block" : "none",
          }}
        />

        {/* Scan overlay frame when actively scanning */}
        {state === "scanning" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
            <div
              className="border-2 border-green-400/70 rounded-lg"
              style={{
                width: `${Math.min(width - 60, 220)}px`,
                height: `${Math.min(height - 60, 220)}px`,
                boxShadow: "0 0 0 4000px rgba(0,0,0,0.3)",
              }}
            />
          </div>
        )}

        {/* Paused overlay after successful scan */}
        {state === "paused" && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3 z-20">
            <div className="bg-background/95 rounded-lg px-4 py-3 text-center max-w-[280px] shadow-lg">
              <p className="text-sm font-medium text-green-600">✓ สแกนสำเร็จ</p>
              <p className="text-xs text-muted-foreground mt-1 break-all line-clamp-2">
                {lastScanned.length > 80 ? `${lastScanned.slice(0, 80)}...` : lastScanned}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {isActive && (
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
