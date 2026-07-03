export const PERSON_IMAGE_CACHE_VERSION = "20260703";

export const PERSON_IMAGE_URLS = {
  patientMale: "/manus-storage/patient_male_realistic_opt_e9b1630b.jpg",
  patientFemale: "/manus-storage/patient_female_realistic_opt_d0edb245.jpg",
  doctorMale: "/manus-storage/doctor_male_realistic_opt_b09f1058.jpg",
  doctorFemale: "/manus-storage/doctor_female_realistic_opt_56d94f1d.jpg",
  nurseFemale: "/manus-storage/nurse_female_realistic_opt_d0e35459.jpg",
  pharmacistMale: "/manus-storage/pharmacist_male_realistic_opt_2b3b0f56.jpg",
  radiologist: "/manus-storage/radiologist_realistic_bd97425d.jpg",
  medTech: "/manus-storage/med_tech_realistic_78575c20.jpg",
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

  const normalized = raw.startsWith("manus-storage/") ? `/${raw}` : raw;
  // Do NOT append cache-busting query params to /manus-storage/ URLs.
  // In production, the platform's presign handler returns 307 redirects
  // and extra query params can interfere with CloudFront signed URLs.
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
  if (roleText.includes("nurse")) return PERSON_IMAGE_URLS.nurseFemale;
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
