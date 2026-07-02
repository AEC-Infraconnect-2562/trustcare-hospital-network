import { useEffect, useMemo, useState } from "react";
import type { ImgHTMLAttributes } from "react";
import { normalizeAvatarUrl } from "@/lib/avatar";

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: unknown;
  fallbackSrc?: unknown;
};

export function SafeImage({ src, fallbackSrc, alt = "", loading = "lazy", ...props }: SafeImageProps) {
  const candidates = useMemo(() => {
    const urls = [normalizeAvatarUrl(src), normalizeAvatarUrl(fallbackSrc)].filter(Boolean) as string[];
    return Array.from(new Set(urls));
  }, [src, fallbackSrc]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidates.join("|")]);

  const effectiveSrc = candidates[candidateIndex];
  if (!effectiveSrc) return null;

  return (
    <img
      {...props}
      src={effectiveSrc}
      alt={alt}
      loading={loading}
      onError={(event) => {
        props.onError?.(event);
        setCandidateIndex((current) => current + 1);
      }}
    />
  );
}
