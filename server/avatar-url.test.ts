import { describe, expect, it } from "vitest";
import {
  AVATAR_URLS,
  normalizeAvatarUrl,
  resolvePatientAvatarUrl,
  resolveRoleAvatarUrl,
} from "@/lib/avatar";

describe("avatar URL normalization", () => {
  it("keeps canonical Manus storage URLs", () => {
    expect(normalizeAvatarUrl("/manus-storage/patient_male_realistic_opt_e9b1630b.jpg"))
      .toBe("/manus-storage/patient_male_realistic_opt_e9b1630b.jpg");
  });

  it("converts bare storage keys into Manus storage URLs", () => {
    expect(normalizeAvatarUrl("patient_male_realistic_opt_e9b1630b.jpg"))
      .toBe("/manus-storage/patient_male_realistic_opt_e9b1630b.jpg");
    expect(normalizeAvatarUrl("patient-photos/414/avatar_abc12345.jpg"))
      .toBe("/manus-storage/patient-photos/414/avatar_abc12345.jpg");
    expect(normalizeAvatarUrl("/patient-photos/414/avatar_abc12345.jpg"))
      .toBe("/manus-storage/patient-photos/414/avatar_abc12345.jpg");
    expect(normalizeAvatarUrl("manus-storage/patient_male_realistic_opt_e9b1630b.jpg"))
      .toBe("/manus-storage/patient_male_realistic_opt_e9b1630b.jpg");
  });

  it("rejects cartoon avatar generators so realistic assets are used", () => {
    expect(normalizeAvatarUrl("https://api.dicebear.com/9.x/initials/svg?seed=Somchai")).toBeNull();
  });

  it("falls back to realistic patient photos by gender", () => {
    expect(resolvePatientAvatarUrl({ gender: "female" })).toBe(AVATAR_URLS.female);
    expect(resolvePatientAvatarUrl({ gender: "male" })).toBe(AVATAR_URLS.male);
  });

  it("falls back to role-appropriate realistic staff photos", () => {
    expect(resolveRoleAvatarUrl({ role: "doctor" })).toBe(AVATAR_URLS.doctor);
    expect(resolveRoleAvatarUrl({ role: "nurse" })).toBe(AVATAR_URLS.nurse);
  });
});
