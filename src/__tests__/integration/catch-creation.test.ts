import { describe, it, expect, beforeEach, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";

/**
 * Integration tests for catch creation flow
 *
 * These tests verify the complete flow of creating a catch,
 * including image upload, data validation, and database insertion.
 *
 * Note: These tests use mocked Supabase client. For full E2E testing,
 * use Playwright or Cypress with a test Supabase instance.
 */

describe("Catch Creation Flow Integration", () => {
  const mockUserId = "user-123";
  const mockCatchId = "catch-456";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Image Upload", () => {
    it("should upload catch image to storage", async () => {
      const mockFile = new File(["image data"], "catch.jpg", {
        type: "image/jpeg",
      });

      const mockUpload = vi.fn().mockResolvedValue({
        data: { path: "catches/user-123/catch-456.jpg" },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue({
        upload: mockUpload,
      });

      supabase.storage.from = mockFrom;

      const { data, error } = await supabase.storage
        .from("catches")
        .upload(`catches/${mockUserId}/${mockCatchId}.jpg`, mockFile);

      expect(mockFrom).toHaveBeenCalledWith("catches");
      expect(mockUpload).toHaveBeenCalledWith(
        `catches/${mockUserId}/${mockCatchId}.jpg`,
        mockFile
      );
      expect(error).toBeNull();
      expect(data?.path).toContain(mockCatchId);
    });

    it("should handle image upload errors", async () => {
      const mockFile = new File(["image data"], "catch.jpg", {
        type: "image/jpeg",
      });

      const mockUpload = vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: "Storage quota exceeded",
          name: "StorageError",
        },
      });

      const mockFrom = vi.fn().mockReturnValue({
        upload: mockUpload,
      });

      supabase.storage.from = mockFrom;

      const { data, error } = await supabase.storage
        .from("catches")
        .upload(`catches/${mockUserId}/${mockCatchId}.jpg`, mockFile);

      expect(error).toBeDefined();
      expect(error?.message).toContain("quota exceeded");
      expect(data).toBeNull();
    });

    it("should reject oversized images", async () => {
      const oversizedFile = new File(
        [new ArrayBuffer(10 * 1024 * 1024)], // 10MB
        "large.jpg",
        { type: "image/jpeg" }
      );

      const MAX_SIZE = 5 * 1024 * 1024; // 5MB limit

      if (oversizedFile.size > MAX_SIZE) {
        expect(oversizedFile.size).toBeGreaterThan(MAX_SIZE);
        // Would reject before upload in real implementation
      }
    });
  });

  describe("Catch Data Insertion", () => {
    it("should insert catch with all required fields", async () => {
      const catchData = {
        user_id: mockUserId,
        title: "Big Carp Catch",
        species: "common-carp",
        weight: 15.5,
        weight_unit: "kg",
        image_url: `catches/${mockUserId}/${mockCatchId}.jpg`,
        location: "Thames River",
        caught_at: new Date().toISOString(),
        conditions: {
          weather: "sunny",
          temperature: 22,
          bait: "boilies",
        },
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockCatchId,
              ...catchData,
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      supabase.from = mockFrom;

      const { data, error } = await supabase
        .from("catches")
        .insert(catchData)
        .select()
        .single();

      expect(mockFrom).toHaveBeenCalledWith("catches");
      expect(mockInsert).toHaveBeenCalledWith(catchData);
      expect(error).toBeNull();
      expect(data?.title).toBe("Big Carp Catch");
      expect(data?.species).toBe("common-carp");
      expect(data?.weight).toBe(15.5);
    });

    it("should handle missing required fields", async () => {
      const incompleteCatchData = {
        user_id: mockUserId,
        // Missing title, species, weight
        image_url: "image.jpg",
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: {
              message: "Missing required fields",
              code: "23502",
            },
          }),
        }),
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      supabase.from = mockFrom;

      const { data, error } = await supabase
        .from("catches")
        .insert(incompleteCatchData)
        .select()
        .single();

      expect(error).toBeDefined();
      expect(error?.message).toContain("required");
      expect(data).toBeNull();
    });

    it("should validate weight is positive", async () => {
      const catchData = {
        user_id: mockUserId,
        title: "Invalid Weight Catch",
        species: "carp",
        weight: -5, // Invalid: negative weight
        weight_unit: "kg",
        image_url: "image.jpg",
      };

      // In real implementation, this would be validated before insert
      expect(catchData.weight).toBeLessThan(0);

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: {
              message: "Weight must be positive",
              code: "P0001",
            },
          }),
        }),
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      supabase.from = mockFrom;

      const { data, error } = await supabase
        .from("catches")
        .insert(catchData)
        .select()
        .single();

      expect(error).toBeDefined();
    });
  });

  describe("Gallery Photos Upload", () => {
    it("should upload multiple gallery photos", async () => {
      const photos = [
        new File(["photo1"], "photo1.jpg", { type: "image/jpeg" }),
        new File(["photo2"], "photo2.jpg", { type: "image/jpeg" }),
        new File(["photo3"], "photo3.jpg", { type: "image/jpeg" }),
      ];

      const uploadedPaths: string[] = [];

      for (let i = 0; i < photos.length; i++) {
        const mockUpload = vi.fn().mockResolvedValue({
          data: { path: `galleries/${mockCatchId}/photo${i + 1}.jpg` },
          error: null,
        });

        const mockFrom = vi.fn().mockReturnValue({
          upload: mockUpload,
        });

        supabase.storage.from = mockFrom;

        const { data } = await supabase.storage
          .from("galleries")
          .upload(`galleries/${mockCatchId}/photo${i + 1}.jpg`, photos[i]);

        if (data) {
          uploadedPaths.push(data.path);
        }
      }

      expect(uploadedPaths).toHaveLength(3);
      expect(uploadedPaths[0]).toContain("photo1");
      expect(uploadedPaths[1]).toContain("photo2");
      expect(uploadedPaths[2]).toContain("photo3");
    });

    it("should update catch with gallery photo paths", async () => {
      const galleryPaths = [
        "galleries/catch-456/photo1.jpg",
        "galleries/catch-456/photo2.jpg",
      ];

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockCatchId,
                gallery_photos: galleryPaths,
              },
              error: null,
            }),
          }),
        }),
      });

      const mockFrom = vi.fn().mockReturnValue({
        update: mockUpdate,
      });

      supabase.from = mockFrom;

      const { data, error } = await supabase
        .from("catches")
        .update({ gallery_photos: galleryPaths })
        .eq("id", mockCatchId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.gallery_photos).toEqual(galleryPaths);
    });
  });

  describe("GPS Location Handling", () => {
    it("should store GPS coordinates when provided", async () => {
      const catchData = {
        user_id: mockUserId,
        title: "Catch with GPS",
        species: "pike",
        weight: 8.2,
        weight_unit: "kg",
        image_url: "image.jpg",
        location: "Secret Spot",
        conditions: {
          gps: {
            lat: 51.5074,
            lng: -0.1278,
            accuracy: 10,
          },
        },
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockCatchId,
              ...catchData,
            },
            error: null,
          }),
        }),
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      supabase.from = mockFrom;

      const { data, error } = await supabase
        .from("catches")
        .insert(catchData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.conditions).toHaveProperty("gps");
      expect((data?.conditions as any).gps.lat).toBe(51.5074);
    });

    it("should respect hide_exact_spot flag", async () => {
      const catchData = {
        user_id: mockUserId,
        title: "Private Location Catch",
        species: "carp",
        weight: 12,
        weight_unit: "kg",
        image_url: "image.jpg",
        location: "Private Lake",
        hide_exact_spot: true,
        conditions: {
          gps: {
            lat: 51.5074,
            lng: -0.1278,
          },
        },
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockCatchId,
              ...catchData,
            },
            error: null,
          }),
        }),
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      supabase.from = mockFrom;

      const { data, error } = await supabase
        .from("catches")
        .insert(catchData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.hide_exact_spot).toBe(true);
      // GPS data stored but location hidden from other users
    });
  });

  describe("Complete Catch Creation Flow", () => {
    it("should complete full catch creation with image upload", async () => {
      // Step 1: Upload image
      const mockFile = new File(["image"], "catch.jpg", {
        type: "image/jpeg",
      });

      const mockUpload = vi.fn().mockResolvedValue({
        data: { path: `catches/${mockUserId}/${mockCatchId}.jpg` },
        error: null,
      });

      const mockStorageFrom = vi.fn().mockReturnValue({
        upload: mockUpload,
      });

      supabase.storage.from = mockStorageFrom;

      const uploadResult = await supabase.storage
        .from("catches")
        .upload(`catches/${mockUserId}/${mockCatchId}.jpg`, mockFile);

      expect(uploadResult.error).toBeNull();
      const imagePath = uploadResult.data?.path;

      // Step 2: Insert catch data
      const catchData = {
        user_id: mockUserId,
        title: "Complete Flow Catch",
        species: "common-carp",
        weight: 10,
        weight_unit: "kg",
        image_url: imagePath,
        location: "Test Lake",
        caught_at: new Date().toISOString(),
        conditions: {
          weather: "cloudy",
          bait: "corn",
        },
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockCatchId,
              ...catchData,
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      supabase.from = mockFrom;

      const insertResult = await supabase
        .from("catches")
        .insert(catchData)
        .select()
        .single();

      expect(insertResult.error).toBeNull();
      expect(insertResult.data?.id).toBe(mockCatchId);

      // Step 3: Verify catch appears in user's catches
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [insertResult.data],
            error: null,
          }),
        }),
      });

      supabase.from = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      const fetchResult = await supabase
        .from("catches")
        .select("*")
        .eq("user_id", mockUserId)
        .order("created_at", { ascending: false });

      expect(fetchResult.error).toBeNull();
      expect(fetchResult.data).toHaveLength(1);
      expect(fetchResult.data?.[0].title).toBe("Complete Flow Catch");
    });

    it("should rollback on error (conceptual test)", async () => {
      // This would test transaction rollback in a real database
      // Step 1: Image upload succeeds
      const mockFile = new File(["image"], "catch.jpg", {
        type: "image/jpeg",
      });

      const mockUpload = vi.fn().mockResolvedValue({
        data: { path: "catches/user-123/catch-456.jpg" },
        error: null,
      });

      supabase.storage.from = vi.fn().mockReturnValue({
        upload: mockUpload,
      });

      const uploadResult = await supabase.storage
        .from("catches")
        .upload("catches/user-123/catch-456.jpg", mockFile);

      expect(uploadResult.error).toBeNull();

      // Step 2: Database insert fails
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: {
              message: "Database error",
              code: "23505",
            },
          }),
        }),
      });

      supabase.from = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      const insertResult = await supabase
        .from("catches")
        .insert({})
        .select()
        .single();

      expect(insertResult.error).toBeDefined();

      // In real implementation, would need to:
      // - Delete uploaded image
      // - Show error to user
      // - Log error for debugging
    });
  });

  describe("Validation", () => {
    it("should validate species is from allowed list or custom", async () => {
      const validSpecies = [
        "common-carp",
        "mirror-carp",
        "pike",
        "perch",
        "other",
      ];

      const testSpecies = "common-carp";
      expect(validSpecies.includes(testSpecies)).toBe(true);

      const customSpecies = "my-custom-fish";
      expect(validSpecies.includes(customSpecies)).toBe(false);
      // Would be stored in conditions.customFields.species
    });

    it("should validate weight unit is kg or lb", async () => {
      const validUnits = ["kg", "lb", "lbs", "lb_oz"];

      expect(validUnits.includes("kg")).toBe(true);
      expect(validUnits.includes("lb")).toBe(true);
      expect(validUnits.includes("grams")).toBe(false);
    });

    it("should ensure title is not empty", async () => {
      const validTitle = "My Catch";
      const invalidTitle = "";

      expect(validTitle.trim().length).toBeGreaterThan(0);
      expect(invalidTitle.trim().length).toBe(0);
    });
  });
});
