import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => {
  const schemas: any[] = [];
  return {
    registerSchema: vi.fn(async (data: any) => {
      const id = schemas.length + 1;
      schemas.push({ id, ...data, isActive: true, createdAt: new Date() });
      return { id };
    }),
    getActiveSchema: vi.fn(async (credentialType: string) => {
      return schemas.find(s => s.credentialType === credentialType && s.isActive) || null;
    }),
    getSchemaByVersion: vi.fn(async (credentialType: string, version: string) => {
      return schemas.find(s => s.credentialType === credentialType && s.version === version) || null;
    }),
    listSchemaVersions: vi.fn(async (credentialType?: string) => {
      if (credentialType) return schemas.filter(s => s.credentialType === credentialType);
      return schemas;
    }),
    validateCredentialAgainstSchema: vi.fn(async (credentialType: string, schemaVersion: string, credentialData: any) => {
      const schema = schemas.find(s => s.credentialType === credentialType && s.version === schemaVersion);
      if (!schema) return { valid: false, errors: [`Schema not found: ${credentialType}@${schemaVersion}`] };
      const errors: string[] = [];
      const jsonSchema = schema.jsonSchema;
      if (jsonSchema?.required) {
        for (const field of jsonSchema.required) {
          if (!credentialData?.[field]) errors.push(`Missing required field: ${field}`);
        }
      }
      return { valid: errors.length === 0, errors };
    }),
  };
});

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: any = {
    id: 1,
    openId: "admin-001",
    email: "admin@trustcare.th",
    name: "Admin User",
    role: "admin",
    systemRole: "system_admin",
  };
  return {
    user,
    res: { clearCookie: vi.fn() } as any,
    req: { headers: {} } as any,
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "user-001",
    email: "user@trustcare.th",
    name: "Regular User",
  };
  return {
    user,
    res: { clearCookie: vi.fn() } as any,
    req: { headers: {} } as any,
  };
}

const caller = appRouter.createCaller;

describe("Schema Registry Router", () => {
  describe("schemaRegistry.register", () => {
    it("should register a new schema version", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      const result = await trpc.schemaRegistry.register({
        credentialType: "patient_summary",
        version: "1.0.0",
        jsonSchema: {
          type: "object",
          required: ["patientName", "dateOfBirth", "allergies"],
          properties: {
            patientName: { type: "string" },
            dateOfBirth: { type: "string" },
            allergies: { type: "array" },
          },
        },
        changelog: "Initial schema version for patient summary",
      });
      expect(result).toBeDefined();
      expect(result).toHaveProperty("id");
    });

    it("should reject non-semver version strings", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      await expect(
        trpc.schemaRegistry.register({
          credentialType: "patient_summary",
          version: "v1",
          jsonSchema: {},
        })
      ).rejects.toThrow();
    });

    it("should reject empty credentialType", async () => {
      const ctx = createAdminContext();
      const trpc = caller(ctx);
      await expect(
        trpc.schemaRegistry.register({
          credentialType: "",
          version: "1.0.0",
          jsonSchema: {},
        })
      ).rejects.toThrow();
    });
  });

  describe("schemaRegistry.getActive", () => {
    it("should return active schema for a credential type", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      const result = await trpc.schemaRegistry.getActive({
        credentialType: "patient_summary",
      });
      expect(result).toBeDefined();
      expect(result?.credentialType).toBe("patient_summary");
      expect(result?.isActive).toBe(true);
    });

    it("should return null for non-existent type", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      const result = await trpc.schemaRegistry.getActive({
        credentialType: "non_existent_type",
      });
      expect(result).toBeNull();
    });
  });

  describe("schemaRegistry.list", () => {
    it("should list all schema versions", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      const result = await trpc.schemaRegistry.list();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should filter by credentialType", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      const result = await trpc.schemaRegistry.list({
        credentialType: "patient_summary",
      });
      expect(Array.isArray(result)).toBe(true);
      for (const schema of result) {
        expect(schema.credentialType).toBe("patient_summary");
      }
    });
  });

  describe("schemaRegistry.validate", () => {
    it("should validate credential data against schema", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      const result = await trpc.schemaRegistry.validate({
        credentialType: "patient_summary",
        schemaVersion: "1.0.0",
        credentialData: {
          patientName: "สมชาย ใจดี",
          dateOfBirth: "1990-01-01",
          allergies: ["Penicillin"],
        },
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return errors for missing required fields", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      const result = await trpc.schemaRegistry.validate({
        credentialType: "patient_summary",
        schemaVersion: "1.0.0",
        credentialData: {
          patientName: "สมชาย ใจดี",
          // missing dateOfBirth and allergies
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes("dateOfBirth"))).toBe(true);
    });

    it("should return error for non-existent schema", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      const result = await trpc.schemaRegistry.validate({
        credentialType: "non_existent",
        schemaVersion: "9.9.9",
        credentialData: {},
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Schema not found");
    });
  });

  describe("schemaRegistry.getByVersion", () => {
    it("should return schema for specific version", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      const result = await trpc.schemaRegistry.getByVersion({
        credentialType: "patient_summary",
        version: "1.0.0",
      });
      expect(result).toBeDefined();
      expect(result?.version).toBe("1.0.0");
    });

    it("should return null for non-existent version", async () => {
      const ctx = createUserContext();
      const trpc = caller(ctx);
      const result = await trpc.schemaRegistry.getByVersion({
        credentialType: "patient_summary",
        version: "99.0.0",
      });
      expect(result).toBeNull();
    });
  });
});
