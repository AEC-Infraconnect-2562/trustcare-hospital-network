import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { normalizeAvatarUrl, resolveRoleAvatarUrl } from "@/lib/avatar";

type AvatarPhotoProps = {
  src?: unknown;
  name?: string | null;
  role?: string | null;
  gender?: string | null;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  fallbackToDefault?: boolean;
};

export function AvatarPhoto({
  src,
  name,
  role,
  gender,
  className,
  imgClassName,
  fallbackClassName,
  fallbackToDefault = true,
}: AvatarPhotoProps) {
  const candidates = useMemo(() => {
    const primary = normalizeAvatarUrl(src);
    const fallback = resolveRoleAvatarUrl({ role, gender, name, fallbackToDefault });
    return Array.from(new Set([primary, fallback].filter(Boolean) as string[]));
  }, [src, role, gender, name, fallbackToDefault]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidates.join("|")]);

  const effectiveSrc = candidates[candidateIndex];

  return (
    <Avatar className={className}>
      {effectiveSrc ? (
        <img
          src={effectiveSrc}
          alt={name || "User"}
          className={cn("h-full w-full object-cover", imgClassName)}
          loading="lazy"
          onError={() => setCandidateIndex((current) => current + 1)}
        />
      ) : (
        <AvatarFallback className={fallbackClassName}>
          {name?.charAt(0)?.toUpperCase() || "U"}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
