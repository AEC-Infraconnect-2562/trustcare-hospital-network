export const PERSON_IMAGE_CACHE_VERSION = "20260703";

export const PERSON_IMAGE_URLS = {
  patientMale: "/seed-avatars/patient_somsak_a2e00e97.jpg",
  patientFemale: "/seed-avatars/patient_malee_74d2ef04.jpg",
  doctorMale: "/seed-avatars/doctor_thanawat_f91f7278.jpg",
  doctorFemale: "/seed-avatars/doctor_napa_abd67502.jpg",
  nurseFemale: "/seed-avatars/nurse_pimjai_ace1fd06.jpg",
  nurseMale: "/seed-avatars/nurse_anucha_e814499a.jpg",
  pharmacistMale: "/seed-avatars/engineer_piya_eb6aeff4.jpg",
  radiologist: "/seed-avatars/doctor_kriangkrai_b6bcdefb.jpg",
  medTech: "/seed-avatars/doctor_prasit_2ed84c26.jpg",
} as const;

export type PersonGender = "male" | "female";

type PhotoCandidateSource = Record<string, unknown> | null | undefined;

const PHOTO_KEYS = [
  "avatarUrl",
  "photoUrl",
  "profilePhotoUrl",
  "patientPhotoUrl",
  "portraitUrl",
  "imageUrl",
  "thumbnailUrl",
  "photo",
  "image",
] as const;

export function normalizePersonImageUrl(
  value: unknown,
  _cacheVersion = PERSON_IMAGE_CACHE_VERSION,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw || raw === "null" || raw === "undefined") return undefined;
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw;

  let normalized = raw.startsWith("manus-storage/") ? `/${raw}` : raw;
  // Rewrite /manus-storage/ paths to /api/storage-proxy/ to bypass the
  // platform's 307 redirect handler in production. Our Express route streams
  // file bytes same-origin, avoiding cross-origin issues with CloudFront.
  if (normalized.startsWith("/manus-storage/")) {
    normalized = normalized.replace("/manus-storage/", "/api/storage-proxy/");
  }
  return normalized;
}

export function uniquePersonImageSources(sources: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const source of sources) {
    const normalized = normalizePersonImageUrl(source);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function defaultPatientImage(gender?: PersonGender | null): string {
  return gender === "female" ? PERSON_IMAGE_URLS.patientFemale : PERSON_IMAGE_URLS.patientMale;
}

export function inferPatientGender(
  credentialData?: unknown,
  fallback?: PersonGender | null,
): PersonGender {
  if (fallback === "female" || fallback === "male") return fallback;

  const subject = getCredentialSubject(credentialData);
  const patient = toRecord(subject?.patient) ?? toRecord(subject);
  const gender = String(patient?.gender ?? patient?.sex ?? "").toLowerCase();
  if (["female", "f", "woman"].includes(gender)) return "female";
  if (["male", "m", "man"].includes(gender)) return "male";

  const name = String(patient?.nameEn ?? patient?.fullNameEn ?? patient?.name ?? "");
  if (/^(ms|mrs|miss)\.?\s/i.test(name)) return "female";

  return "male";
}

export function collectPersonPhotoUrls(credentialData?: unknown): string[] {
  const subject = getCredentialSubject(credentialData);
  const renderData = toRecord(toRecord(subject?.humanDocument)?.renderData);
  const patient = toRecord(subject?.patient);
  const renderPatient = toRecord(renderData?.patient);
  const fhirPatient = toRecord(toRecord(subject?.fhir)?.patient);
  const practitioner = toRecord(subject?.practitioner);
  const prescriber = toRecord(subject?.prescriber);

  return collectPhotoValues([subject, patient, renderPatient, fhirPatient, practitioner, prescriber])
    .filter((value): value is string => typeof value === "string");
}

export function patientPhotoSources(input: {
  primaryUrl?: string | null;
  credentialData?: unknown;
  gender?: PersonGender | null;
}): string[] {
  const gender = inferPatientGender(input.credentialData, input.gender);
  return uniquePersonImageSources([
    input.primaryUrl,
    ...collectPersonPhotoUrls(input.credentialData),
    defaultPatientImage(gender),
  ]);
}

export function practitionerPhotoSources(input: {
  primaryUrl?: string | null;
  practitioner?: unknown;
  role?: string | null;
  gender?: PersonGender | null;
}): string[] {
  return uniquePersonImageSources([
    input.primaryUrl,
    ...collectPhotoValues([toRecord(input.practitioner)]),
    defaultPractitionerImage(input.role, input.gender, input.practitioner),
  ]);
}

export function defaultPractitionerImage(
  role?: string | null,
  gender?: PersonGender | null,
  practitioner?: unknown,
): string {
  const roleText = `${role ?? ""} ${String(toRecord(practitioner)?.role ?? "")}`.toLowerCase();
  if (roleText.includes("nurse")) return gender === "male" ? PERSON_IMAGE_URLS.nurseMale : PERSON_IMAGE_URLS.nurseFemale;
  if (roleText.includes("pharmacist")) return PERSON_IMAGE_URLS.pharmacistMale;
  if (roleText.includes("radiologist")) return PERSON_IMAGE_URLS.radiologist;
  if (roleText.includes("med_tech") || roleText.includes("med tech") || roleText.includes("laboratory")) {
    return PERSON_IMAGE_URLS.medTech;
  }
  return gender === "female" ? PERSON_IMAGE_URLS.doctorFemale : PERSON_IMAGE_URLS.doctorMale;
}

function collectPhotoValues(sources: PhotoCandidateSource[]): unknown[] {
  const values: unknown[] = [];

  for (const source of sources) {
    if (!source) continue;
    for (const key of PHOTO_KEYS) {
      const value = source[key];
      if (typeof value === "string") {
        values.push(value);
      } else if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        values.push(nested.url, nested.data);
      }
    }
  }

  return values;
}

function getCredentialSubject(data: unknown): Record<string, unknown> {
  const root = toRecord(data);
  return toRecord(root?.credentialSubject) ?? root ?? {};
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}
