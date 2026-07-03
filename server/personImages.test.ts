import { describe, expect, it } from "vitest";
import {
  defaultPractitionerImage,
  patientPhotoSources,
  PERSON_IMAGE_URLS,
  normalizePersonImageUrl,
  uniquePersonImageSources,
} from "../shared/personImages";

describe("person image helpers", () => {
  it("normalizes Manus storage URLs without cache-busting params", () => {
    expect(normalizePersonImageUrl("manus-storage/example.jpg")).toBe(
      "/manus-storage/example.jpg",
    );
    expect(normalizePersonImageUrl("/manus-storage/example.jpg?size=400")).toBe(
      "/manus-storage/example.jpg?size=400",
    );
  });

  it("returns non-storage URLs unchanged", () => {
    expect(normalizePersonImageUrl("https://example.com/photo.jpg")).toBe(
      "https://example.com/photo.jpg",
    );
    expect(normalizePersonImageUrl("/static/avatar.png")).toBe(
      "/static/avatar.png",
    );
  });

  it("handles data and blob URLs", () => {
    expect(normalizePersonImageUrl("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc",
    );
    expect(normalizePersonImageUrl("blob:http://localhost/123")).toBe(
      "blob:http://localhost/123",
    );
  });

  it("returns undefined for invalid inputs", () => {
    expect(normalizePersonImageUrl(null)).toBeUndefined();
    expect(normalizePersonImageUrl("")).toBeUndefined();
    expect(normalizePersonImageUrl("null")).toBeUndefined();
    expect(normalizePersonImageUrl("undefined")).toBeUndefined();
    expect(normalizePersonImageUrl(123)).toBeUndefined();
  });

  it("deduplicates normalized sources and keeps data URLs intact", () => {
    const sources = uniquePersonImageSources([
      "/manus-storage/example.jpg",
      "/manus-storage/example.jpg",
      "data:image/png;base64,abc",
      "",
      null,
    ]);

    expect(sources).toEqual([
      "/manus-storage/example.jpg",
      "data:image/png;base64,abc",
    ]);
  });

  it("builds patient sources from auth, credential payload, and gender fallback", () => {
    const sources = patientPhotoSources({
      primaryUrl: "/missing/upload.jpg",
      credentialData: {
        credentialSubject: {
          patient: {
            gender: "female",
            photoUrl: "/manus-storage/patient_female_realistic_opt_d0edb245.jpg",
          },
        },
      },
    });

    expect(sources).toEqual([
      "/missing/upload.jpg",
      PERSON_IMAGE_URLS.patientFemale,
    ]);
  });

  it("chooses practitioner defaults by role", () => {
    expect(defaultPractitionerImage("nurse")).toBe(PERSON_IMAGE_URLS.nurseFemale);
    expect(defaultPractitionerImage("pharmacist")).toBe(PERSON_IMAGE_URLS.pharmacistMale);
    expect(defaultPractitionerImage("doctor", "female")).toBe(PERSON_IMAGE_URLS.doctorFemale);
  });
});
