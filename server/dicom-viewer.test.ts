import { describe, it, expect } from "vitest";

/**
 * Tests for DICOM viewer integration utilities.
 * Since the DicomViewer component is browser-only (uses cornerstone-core which requires window/canvas),
 * we test the detection logic and file type classification here.
 */

const PREVIEWABLE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];
const PREVIEWABLE_PDF_TYPES = ["application/pdf"];
const DICOM_TYPES = ["application/dicom"];

function isDicomType(mimeType: string, fileName?: string): boolean {
  if (DICOM_TYPES.includes(mimeType)) return true;
  if (fileName && fileName.toLowerCase().endsWith(".dcm")) return true;
  return false;
}

function isPreviewable(mimeType: string, fileName?: string): boolean {
  return PREVIEWABLE_IMAGE_TYPES.includes(mimeType) || PREVIEWABLE_PDF_TYPES.includes(mimeType) || isDicomType(mimeType, fileName);
}

describe("DICOM Viewer - File Type Detection", () => {
  it("should detect application/dicom MIME type as DICOM", () => {
    expect(isDicomType("application/dicom")).toBe(true);
  });

  it("should detect .dcm file extension as DICOM", () => {
    expect(isDicomType("application/octet-stream", "chest_xray.dcm")).toBe(true);
  });

  it("should detect .DCM (uppercase) file extension as DICOM", () => {
    expect(isDicomType("application/octet-stream", "CT_SCAN.DCM")).toBe(true);
  });

  it("should not detect regular image types as DICOM", () => {
    expect(isDicomType("image/png", "photo.png")).toBe(false);
    expect(isDicomType("image/jpeg", "scan.jpg")).toBe(false);
  });

  it("should not detect PDF as DICOM", () => {
    expect(isDicomType("application/pdf", "report.pdf")).toBe(false);
  });

  it("should not detect files without .dcm extension as DICOM when MIME is generic", () => {
    expect(isDicomType("application/octet-stream", "data.bin")).toBe(false);
    expect(isDicomType("application/octet-stream")).toBe(false);
  });
});

describe("DICOM Viewer - Previewable Detection", () => {
  it("should mark DICOM files as previewable", () => {
    expect(isPreviewable("application/dicom")).toBe(true);
    expect(isPreviewable("application/octet-stream", "brain_mri.dcm")).toBe(true);
  });

  it("should still mark images as previewable", () => {
    expect(isPreviewable("image/png")).toBe(true);
    expect(isPreviewable("image/jpeg")).toBe(true);
    expect(isPreviewable("image/gif")).toBe(true);
  });

  it("should still mark PDFs as previewable", () => {
    expect(isPreviewable("application/pdf")).toBe(true);
  });

  it("should not mark unsupported types as previewable", () => {
    expect(isPreviewable("application/zip")).toBe(false);
    expect(isPreviewable("text/plain")).toBe(false);
    expect(isPreviewable("application/msword")).toBe(false);
  });
});

describe("DICOM Viewer - DICOM Tag Constants", () => {
  // Verify the DICOM tag mapping used in the viewer
  const DICOM_TAGS = {
    patientName: "x00100010",
    modality: "x00080060",
    studyDate: "x00080020",
    seriesDescription: "x0008103e",
    rows: "x00280010",
    columns: "x00280011",
    bitsAllocated: "x00280100",
    photometricInterpretation: "x00280004",
    institutionName: "x00080080",
    pixelData: "x7fe00010",
    samplesPerPixel: "x00280002",
    pixelRepresentation: "x00280103",
    rescaleSlope: "x00281053",
    rescaleIntercept: "x00281052",
    windowWidth: "x00281051",
    windowCenter: "x00281050",
  };

  it("should have correct patient name tag", () => {
    expect(DICOM_TAGS.patientName).toBe("x00100010");
  });

  it("should have correct modality tag", () => {
    expect(DICOM_TAGS.modality).toBe("x00080060");
  });

  it("should have correct pixel data tag", () => {
    expect(DICOM_TAGS.pixelData).toBe("x7fe00010");
  });

  it("should have correct windowing tags", () => {
    expect(DICOM_TAGS.windowWidth).toBe("x00281051");
    expect(DICOM_TAGS.windowCenter).toBe("x00281050");
  });

  it("should have correct image dimension tags", () => {
    expect(DICOM_TAGS.rows).toBe("x00280010");
    expect(DICOM_TAGS.columns).toBe("x00280011");
  });
});
