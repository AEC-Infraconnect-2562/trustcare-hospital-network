export const AVATAR_URLS = {
  male: "/manus-storage/patient_male_realistic_opt_e9b1630b.jpg",
  female: "/manus-storage/patient_female_realistic_opt_d0edb245.jpg",
  doctor: "/manus-storage/doctor_male_realistic_opt_b09f1058.jpg",
  doctorFemale: "/manus-storage/doctor_female_realistic_opt_56d94f1d.jpg",
  nurse: "/manus-storage/nurse_female_realistic_opt_d0e35459.jpg",
  pharmacist: "/manus-storage/pharmacist_male_realistic_opt_2b3b0f56.jpg",
  radiologist: "/manus-storage/radiologist_realistic_bd97425d.jpg",
  medTech: "/manus-storage/med_tech_realistic_78575c20.jpg",
} as const;

type AvatarGender = "male" | "female" | string | null | undefined;

const IMAGE_KEY_PATTERN = /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i;
const CARTOON_AVATAR_PATTERN = /(dicebear|boringavatars|api\.multiavatar)/i;

export function normalizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || CARTOON_AVATAR_PATTERN.test(trimmed)) return null;

  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("/manus-storage/")) return trimmed;
  if (trimmed.startsWith("manus-storage/")) return `/${trimmed}`;
  if (trimmed.startsWith("/patient-photos/")) return `/manus-storage/${trimmed.replace(/^\/+/, "")}`;

  if (trimmed.includes("/manus-storage/")) {
    return `/manus-storage/${trimmed.split("/manus-storage/").pop()?.replace(/^\/+/, "") ?? ""}`;
  }

  if (trimmed.startsWith("/")) return trimmed;
  if (IMAGE_KEY_PATTERN.test(trimmed)) return `/manus-storage/${trimmed.replace(/^\/+/, "")}`;

  return null;
}

export function isFemaleAvatar(gender?: AvatarGender, name?: string | null): boolean {
  const normalizedGender = String(gender ?? "").toLowerCase();
  if (["female", "f", "woman"].includes(normalizedGender)) return true;
  const normalizedName = String(name ?? "").trim().toLowerCase();
  return normalizedName.startsWith("ms.") || normalizedName.startsWith("mrs.");
}

export function defaultPatientAvatarUrl(input: { gender?: AvatarGender; name?: string | null } = {}): string {
  return isFemaleAvatar(input.gender, input.name) ? AVATAR_URLS.female : AVATAR_URLS.male;
}

export function defaultRoleAvatarUrl(input: {
  role?: string | null;
  gender?: AvatarGender;
  name?: string | null;
} = {}): string {
  const role = String(input.role ?? "").toLowerCase();
  if (role.includes("nurse")) return AVATAR_URLS.nurse;
  if (role.includes("pharmacist")) return AVATAR_URLS.pharmacist;
  if (role.includes("radiologist")) return AVATAR_URLS.radiologist;
  if (role.includes("med_tech") || role.includes("medical_technologist")) return AVATAR_URLS.medTech;
  if (role.includes("doctor")) {
    return isFemaleAvatar(input.gender, input.name) ? AVATAR_URLS.doctorFemale : AVATAR_URLS.doctor;
  }
  return defaultPatientAvatarUrl(input);
}

export function resolvePatientAvatarUrl(input: {
  avatarUrl?: unknown;
  gender?: AvatarGender;
  name?: string | null;
  fallbackToDefault?: boolean;
}): string | null {
  return normalizeAvatarUrl(input.avatarUrl) ??
    (input.fallbackToDefault === false ? null : defaultPatientAvatarUrl(input));
}

export function resolveRoleAvatarUrl(input: {
  avatarUrl?: unknown;
  role?: string | null;
  gender?: AvatarGender;
  name?: string | null;
  fallbackToDefault?: boolean;
}): string | null {
  return normalizeAvatarUrl(input.avatarUrl) ??
    (input.fallbackToDefault === false ? null : defaultRoleAvatarUrl(input));
}
