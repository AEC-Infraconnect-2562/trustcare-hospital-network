import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Contrast,
  FlipHorizontal,
  Move,
  RefreshCw,
  Info,
  Download,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface DicomViewerProps {
  src: string;
  fileName: string;
}

interface DicomMetadata {
  patientName?: string;
  modality?: string;
  studyDate?: string;
  seriesDescription?: string;
  rows?: number;
  columns?: number;
  bitsAllocated?: number;
  photometricInterpretation?: string;
  institutionName?: string;
}

type ViewerState = "loading" | "ready" | "error";

export function DicomViewer({ src, fileName }: DicomViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cornerstoneRef = useRef<any>(null);
  const imageRef = useRef<any>(null);

  const [viewerState, setViewerState] = useState<ViewerState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [metadata, setMetadata] = useState<DicomMetadata>({});
  const [showMetadata, setShowMetadata] = useState(false);

  // Viewport controls
  const [windowWidth, setWindowWidth] = useState(400);
  const [windowCenter, setWindowCenter] = useState(40);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [invert, setInvert] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  // Pan state
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const translationRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const updateViewport = useCallback(() => {
    const cs = cornerstoneRef.current;
    const element = containerRef.current;
    if (!cs || !element) return;

    try {
      const viewport = cs.getViewport(element);
      if (!viewport) return;

      viewport.voi = { windowWidth, windowCenter };
      viewport.scale = zoom;
      viewport.rotation = rotation;
      viewport.invert = invert;
      viewport.translation = translationRef.current;

      cs.setViewport(element, viewport);
    } catch {
      // Element may not be enabled yet
    }
  }, [windowWidth, windowCenter, zoom, rotation, invert]);

  // Update viewport when controls change
  useEffect(() => {
    if (viewerState === "ready") {
      updateViewport();
    }
  }, [updateViewport, viewerState]);

  // Load and display DICOM image
  useEffect(() => {
    let cancelled = false;
    let element: HTMLDivElement | null = null;

    async function loadDicom() {
      try {
        setViewerState("loading");

        // Dynamic imports for browser-only libraries
        const [cornerstoneModule, dicomParserModule] = await Promise.all([
          import("cornerstone-core"),
          import("dicom-parser"),
        ]);

        const cornerstone = cornerstoneModule.default || cornerstoneModule;
        const dicomParser = dicomParserModule.default || dicomParserModule;

        if (cancelled) return;

        cornerstoneRef.current = cornerstone;
        element = containerRef.current;
        if (!element) return;

        // Fetch DICOM file as ArrayBuffer
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const byteArray = new Uint8Array(arrayBuffer);

        if (cancelled) return;

        // Parse DICOM metadata
        const dataSet = dicomParser.parseDicom(byteArray);

        // Extract metadata
        const meta: DicomMetadata = {
          patientName: dataSet.string("x00100010")?.trim(),
          modality: dataSet.string("x00080060")?.trim(),
          studyDate: dataSet.string("x00080020")?.trim(),
          seriesDescription: dataSet.string("x0008103e")?.trim(),
          rows: dataSet.uint16("x00280010"),
          columns: dataSet.uint16("x00280011"),
          bitsAllocated: dataSet.uint16("x00280100"),
          photometricInterpretation: dataSet.string("x00280004")?.trim(),
          institutionName: dataSet.string("x00080080")?.trim(),
        };
        setMetadata(meta);

        // Extract pixel data info
        const rows = meta.rows || 512;
        const columns = meta.columns || 512;
        const bitsAllocated = meta.bitsAllocated || 16;
        const samplesPerPixel = dataSet.uint16("x00280002") || 1;
        const pixelRepresentation = dataSet.uint16("x00280103") || 0;
        const photometricInterpretation = meta.photometricInterpretation || "MONOCHROME2";
        const isColor = photometricInterpretation === "RGB" || samplesPerPixel > 1;

        // Get pixel data element
        const pixelDataElement = dataSet.elements["x7fe00010"];
        if (!pixelDataElement) {
          throw new Error("ไม่พบข้อมูลพิกเซลในไฟล์ DICOM");
        }

        // Extract pixel data
        let pixelData: Int16Array | Uint16Array | Uint8Array;
        const pixelDataOffset = pixelDataElement.dataOffset;
        const pixelDataLength = pixelDataElement.length;

        if (bitsAllocated === 16) {
          if (pixelRepresentation === 1) {
            pixelData = new Int16Array(
              byteArray.buffer,
              pixelDataOffset,
              pixelDataLength / 2
            );
          } else {
            pixelData = new Uint16Array(
              byteArray.buffer,
              pixelDataOffset,
              pixelDataLength / 2
            );
          }
        } else {
          pixelData = new Uint8Array(
            byteArray.buffer,
            pixelDataOffset,
            pixelDataLength
          );
        }

        // Calculate min/max pixel values
        let minPixelValue = Number.MAX_SAFE_INTEGER;
        let maxPixelValue = Number.MIN_SAFE_INTEGER;
        for (let i = 0; i < pixelData.length; i++) {
          if (pixelData[i] < minPixelValue) minPixelValue = pixelData[i];
          if (pixelData[i] > maxPixelValue) maxPixelValue = pixelData[i];
        }

        // Get rescale slope/intercept
        const slope = dataSet.floatString("x00281053") || 1;
        const intercept = dataSet.floatString("x00281052") || 0;

        // Get window width/center from DICOM tags or calculate defaults
        const dicomWW = dataSet.floatString("x00281051");
        const dicomWC = dataSet.floatString("x00281050");
        const defaultWW = dicomWW || (maxPixelValue - minPixelValue);
        const defaultWC = dicomWC || ((maxPixelValue + minPixelValue) / 2);

        setWindowWidth(Math.round(defaultWW));
        setWindowCenter(Math.round(defaultWC));

        // Register custom image loader
        const imageId = `dicomfile:${src}`;

        cornerstone.registerImageLoader("dicomfile", () => {
          const image: any = {
            imageId,
            minPixelValue,
            maxPixelValue,
            slope,
            intercept,
            windowCenter: defaultWC,
            windowWidth: defaultWW,
            getPixelData: () => pixelData,
            rows,
            columns,
            height: rows,
            width: columns,
            color: isColor,
            columnPixelSpacing: dataSet.floatString("x00280030") || 1,
            rowPixelSpacing: dataSet.floatString("x00280030") || 1,
            invert: photometricInterpretation === "MONOCHROME1",
            sizeInBytes: pixelData.byteLength,
            rgba: false,
          };

          if (isColor) {
            // For color images, provide getImageData
            image.getPixelData = () => pixelData;
          }

          return {
            promise: Promise.resolve(image),
          };
        });

        if (cancelled) return;

        // Enable cornerstone on the element
        cornerstone.enable(element);

        // Load and display the image
        const image = await cornerstone.loadImage(imageId);
        imageRef.current = image;

        if (cancelled) return;

        cornerstone.displayImage(element, image);

        setViewerState("ready");
      } catch (err: any) {
        if (!cancelled) {
          console.error("DICOM load error:", err);
          setErrorMessage(err.message || "ไม่สามารถโหลดไฟล์ DICOM ได้");
          setViewerState("error");
        }
      }
    }

    loadDicom();

    return () => {
      cancelled = true;
      if (element && cornerstoneRef.current) {
        try {
          cornerstoneRef.current.disable(element);
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [src]);

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      e.preventDefault();
      panStartRef.current = { x: e.clientX, y: e.clientY };
    },
    [isPanning]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || !panStartRef.current) return;
      e.preventDefault();

      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;

      translationRef.current = {
        x: translationRef.current.x + dx,
        y: translationRef.current.y + dy,
      };

      panStartRef.current = { x: e.clientX, y: e.clientY };
      updateViewport();
    },
    [isPanning, updateViewport]
  );

  const handleMouseUp = useCallback(() => {
    panStartRef.current = null;
  }, []);

  // Reset all controls
  const handleReset = useCallback(() => {
    const image = imageRef.current;
    if (image) {
      setWindowWidth(Math.round(image.windowWidth));
      setWindowCenter(Math.round(image.windowCenter));
    }
    setZoom(1);
    setRotation(0);
    setInvert(false);
    setIsPanning(false);
    translationRef.current = { x: 0, y: 0 };
  }, []);

  // Format study date from YYYYMMDD to DD/MM/YYYY
  const formatStudyDate = (dateStr?: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr || "-";
    return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
  };

  if (viewerState === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-4 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 text-amber-500 opacity-70" />
        <p className="text-sm font-medium text-foreground">ไม่สามารถแสดงไฟล์ DICOM ได้</p>
        <p className="text-xs max-w-sm text-center">{errorMessage}</p>
        <Button size="sm" variant="outline" asChild>
          <a href={src} target="_blank" rel="noopener noreferrer" download>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            ดาวน์โหลด {fileName}
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b bg-muted/30">
        {/* Window/Level */}
        <div className="flex items-center gap-1.5 mr-2">
          <Contrast className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex flex-col gap-0.5 w-28">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">W</span>
              <span className="text-[10px] font-mono">{windowWidth}</span>
            </div>
            <Slider
              min={1}
              max={4096}
              step={1}
              value={[windowWidth]}
              onValueChange={([v]) => setWindowWidth(v)}
              className="h-3"
            />
          </div>
          <div className="flex flex-col gap-0.5 w-28">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">L</span>
              <span className="text-[10px] font-mono">{windowCenter}</span>
            </div>
            <Slider
              min={-1024}
              max={3071}
              step={1}
              value={[windowCenter]}
              onValueChange={([v]) => setWindowCenter(v)}
              className="h-3"
            />
          </div>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            title="ซูมออก"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] font-mono w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            title="ซูมเข้า"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Pan */}
        <Button
          size="sm"
          variant={isPanning ? "default" : "outline"}
          className="h-7 w-7 p-0"
          onClick={() => setIsPanning(!isPanning)}
          title="เลื่อนภาพ (Pan)"
        >
          <Move className="h-3.5 w-3.5" />
        </Button>

        {/* Rotate */}
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          title="หมุน 90°"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>

        {/* Flip */}
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          onClick={() => setInvert(!invert)}
          title="กลับสี (Invert)"
        >
          <FlipHorizontal className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-5 bg-border" />

        {/* Reset */}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2"
          onClick={handleReset}
          title="รีเซ็ต"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          รีเซ็ต
        </Button>

        {/* Metadata toggle */}
        <Button
          size="sm"
          variant={showMetadata ? "default" : "outline"}
          className="h-7 w-7 p-0 ml-auto"
          onClick={() => setShowMetadata(!showMetadata)}
          title="ข้อมูล DICOM"
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* DICOM Canvas */}
        <div
          ref={containerRef}
          className={`flex-1 bg-black min-h-[400px] ${isPanning ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Loading overlay */}
        {viewerState === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-white/80">กำลังโหลดไฟล์ DICOM...</p>
            <p className="text-xs text-white/50 mt-1">{fileName}</p>
          </div>
        )}

        {/* Metadata Panel */}
        {showMetadata && viewerState === "ready" && (
          <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm border rounded-lg p-3 shadow-lg w-56 z-20">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Info className="h-3 w-3" />
              DICOM Metadata
            </h4>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patient</span>
                <span className="font-medium truncate ml-2 max-w-[120px]">
                  {metadata.patientName || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modality</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {metadata.modality || "-"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Study Date</span>
                <span className="font-mono">{formatStudyDate(metadata.studyDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Series</span>
                <span className="truncate ml-2 max-w-[120px]">
                  {metadata.seriesDescription || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size</span>
                <span className="font-mono">
                  {metadata.columns || "-"} × {metadata.rows || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bits</span>
                <span className="font-mono">{metadata.bitsAllocated || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Photometric</span>
                <span className="font-mono text-[10px]">
                  {metadata.photometricInterpretation || "-"}
                </span>
              </div>
              {metadata.institutionName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Institution</span>
                  <span className="truncate ml-2 max-w-[120px]">
                    {metadata.institutionName}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
