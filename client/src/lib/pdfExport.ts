import { jsPDF } from "jspdf";

interface CredentialPdfData {
  type: string;
  typeLabel: string;
  credentialId: string;
  status: string;
  issuedAt: string;
  expiresAt?: string | null;
  hospital: string;
  patient: string;
  credentialData?: Record<string, any> | null;
  documentCategory?: string;
  documentSubcategory?: string;
}

/**
 * Generate a PDF for a credential/clinical summary
 * Uses built-in Helvetica font (supports ASCII only; Thai text is transliterated)
 */
export function exportCredentialPdf(data: CredentialPdfData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Trustcare Hospital Network", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Clinical Credential Summary / Patient Health Document", pageWidth / 2, y, { align: "center" });
  y += 12;

  // Divider
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Document Info
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Document: ${data.typeLabel}`, 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const infoLines = [
    `Credential ID: ${data.credentialId}`,
    `Status: ${data.status}`,
    `Issued: ${data.issuedAt}`,
    `Expires: ${data.expiresAt || "No expiration"}`,
    `Hospital: ${data.hospital}`,
    `Patient: ${data.patient}`,
  ];

  if (data.documentCategory) {
    infoLines.push(`Category: ${data.documentCategory}`);
  }
  if (data.documentSubcategory) {
    infoLines.push(`Subcategory: ${data.documentSubcategory}`);
  }

  for (const line of infoLines) {
    doc.text(line, 20, y);
    y += 6;
  }

  y += 6;

  // Credential Data Section
  if (data.credentialData && Object.keys(data.credentialData).length > 0) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(20, y, pageWidth - 20, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Credential Subject Data", 20, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    for (const [key, value] of Object.entries(data.credentialData)) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const displayValue = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "-");
      const label = formatKey(key);

      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 20, y);
      doc.setFont("helvetica", "normal");

      // Handle multi-line values
      const lines = doc.splitTextToSize(displayValue, pageWidth - 70);
      doc.text(lines, 70, y);
      y += Math.max(lines.length * 4.5, 6);
    }
  }

  // Footer
  y += 10;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(20, y, pageWidth - 20, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated: ${new Date().toISOString()}`, 20, y);
  doc.text("Trustcare Hospital Network - Verifiable Credential Document", pageWidth - 20, y, { align: "right" });

  // Save
  const filename = `${data.type}_${data.credentialId.slice(0, 8)}.pdf`;
  doc.save(filename);
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/**
 * Export wallet card as PDF (simplified version for patient wallet)
 */
export function exportWalletCardPdf(card: {
  title: string;
  type: string;
  issuedAt: string;
  expiresAt?: string | null;
  issuerName: string;
  credentialId: string;
  credentialData?: Record<string, any> | null;
}): void {
  exportCredentialPdf({
    type: card.type,
    typeLabel: card.title,
    credentialId: card.credentialId,
    status: "active",
    issuedAt: new Date(card.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    expiresAt: card.expiresAt ? new Date(card.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null,
    hospital: card.issuerName,
    patient: "Current Holder",
    credentialData: card.credentialData,
  });
}
