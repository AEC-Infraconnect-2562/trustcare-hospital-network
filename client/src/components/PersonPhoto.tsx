import { useEffect, useMemo, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { uniquePersonImageSources } from "@shared/personImages";

type PersonPhotoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & {
  sources: unknown[];
  fallback?: ReactNode;
};

export function PersonPhoto({
  sources,
  fallback = null,
  alt = "",
  loading = "eager",
  decoding = "async",
  ...imgProps
}: PersonPhotoProps) {
  const resolvedSources = useMemo(() => uniquePersonImageSources(sources), [sources]);
  const sourceKey = resolvedSources.join("|");
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [sourceKey]);

  const source = resolvedSources[sourceIndex];
  if (!source) return <>{fallback}</>;

  return (
    <img
      {...imgProps}
      key={source}
      src={source}
      alt={alt}
      loading={loading}
      decoding={decoding}
      onError={() => setSourceIndex((current) => current + 1)}
    />
  );
}
