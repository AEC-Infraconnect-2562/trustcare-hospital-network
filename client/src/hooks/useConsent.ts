import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

export type ConsentPurpose = "treatment" | "referral" | "research" | "insurance" | "public_health" | "emergency";

export function useConsent(patientId?: number) {
  const { data: records, isLoading, refetch } = trpc.consent.records.useQuery(
    { patientId },
    { enabled: patientId !== undefined }
  );

  const grantMutation = trpc.consent.grant.useMutation({ onSuccess: () => refetch() });
  const revokeMutation = trpc.consent.revoke.useMutation({ onSuccess: () => refetch() });

  const activeConsents = useMemo(() => {
    if (!records) return [];
    return records.filter((r: any) => r.status === "granted");
  }, [records]);

  function hasConsent(purpose: ConsentPurpose, hospitalId?: number): boolean {
    return activeConsents.some((r: any) => {
      const purposeMatch = r.purpose === purpose;
      const hospitalMatch = hospitalId ? r.grantedToHospitalId === hospitalId : true;
      return purposeMatch && hospitalMatch;
    });
  }

  function hasAnyConsent(): boolean {
    return activeConsents.length > 0;
  }

  function getConsentsForPurpose(purpose: ConsentPurpose) {
    return activeConsents.filter((r: any) => r.purpose === purpose);
  }

  return {
    records,
    activeConsents,
    isLoading,
    hasConsent,
    hasAnyConsent,
    getConsentsForPurpose,
    grant: grantMutation.mutateAsync,
    revoke: revokeMutation.mutateAsync,
    isGranting: grantMutation.isPending,
    isRevoking: revokeMutation.isPending,
    refetch,
  };
}
