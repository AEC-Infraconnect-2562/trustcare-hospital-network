import { useConsent, type ConsentPurpose } from "@/hooks/useConsent";
import { ConsentBanner } from "./ConsentBanner";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";

interface ConsentGateProps {
  /** Patient ID to check consent for */
  patientId: number;
  /** Required consent purpose */
  purpose: ConsentPurpose;
  /** Hospital ID that needs consent */
  hospitalId?: number;
  /** Policy ID for the consent banner */
  policyId?: number;
  /** Children to render when consent is granted */
  children: ReactNode;
  /** Fallback to render when consent is not granted (defaults to ConsentBanner) */
  fallback?: ReactNode;
  /** Whether to show the consent banner as fallback */
  showBanner?: boolean;
  /** Banner variant */
  bannerVariant?: "default" | "compact" | "emergency";
  /** Custom title for the consent banner */
  bannerTitle?: string;
  /** Custom description for the consent banner */
  bannerDescription?: string;
  /** Callback when consent is granted via the banner */
  onGranted?: () => void;
}

/**
 * ConsentGate — conditional rendering wrapper.
 * Only renders children if the patient has granted consent for the specified purpose.
 * Shows a ConsentBanner as fallback to request consent inline.
 */
export function ConsentGate({
  patientId,
  purpose,
  hospitalId,
  policyId,
  children,
  fallback,
  showBanner = true,
  bannerVariant = "default",
  bannerTitle,
  bannerDescription,
  onGranted,
}: ConsentGateProps) {
  const { hasConsent, isLoading } = useConsent(patientId);

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (hasConsent(purpose, hospitalId)) {
    return <>{children}</>;
  }

  // Consent not granted — show fallback or banner
  if (fallback) {
    return <>{fallback}</>;
  }

  if (showBanner && policyId) {
    return (
      <ConsentBanner
        policyId={policyId}
        purpose={purpose}
        grantedToHospitalId={hospitalId}
        variant={bannerVariant}
        title={bannerTitle}
        description={bannerDescription}
        onGranted={onGranted}
      />
    );
  }

  // No banner, no fallback — render nothing
  return null;
}
