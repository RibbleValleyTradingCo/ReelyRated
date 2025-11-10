# Component Refactoring Guide

**Date:** 2025-11-10
**Status:** 🟢 Components Extracted (7/7 sections complete)
**Next Step:** Integrate components into AddCatch.tsx

---

## Overview

AddCatch.tsx is a 1,647-line monolithic component that handles the entire catch logging form. This document outlines the refactoring strategy to break it into smaller, maintainable components.

---

## Current Progress

### ✅ All Components Extracted

1. **CatchBasicsSection** (`src/components/catch-form/CatchBasicsSection.tsx`)
   - Main photo upload with preview
   - Title input
   - Species selector with custom species support
   - Weight input with unit selector
   - Length input with unit selector
   - **Lines saved:** ~200 lines

2. **LocationSessionSection** (`src/components/catch-form/LocationSessionSection.tsx`)
   - Venue selector (UK fisheries combobox)
   - GPS location with map preview
   - Custom location label
   - Peg/swim input
   - Date caught and time of day
   - Water type selector
   - Session selector with inline creation form
   - **Lines saved:** ~350 lines

3. **TacticsSection** (`src/components/catch-form/TacticsSection.tsx`)
   - Bait selector with custom bait support
   - Method selector with custom method support
   - Equipment used input
   - **Lines saved:** ~265 lines

4. **StorySection** (`src/components/catch-form/StorySection.tsx`)
   - Description textarea
   - **Lines saved:** ~20 lines

5. **ConditionsSection** (`src/components/catch-form/ConditionsSection.tsx`)
   - Collapsible section
   - Weather selector
   - Air temperature input
   - Water clarity selector
   - Wind direction input
   - **Lines saved:** ~65 lines

6. **MediaUploadSection** (`src/components/catch-form/MediaUploadSection.tsx`)
   - Gallery photos (up to 6)
   - Video URL input
   - **Lines saved:** ~50 lines

7. **TagsPrivacySection** (`src/components/catch-form/TagsPrivacySection.tsx`)
   - Tags input
   - Visibility selector
   - Hide exact spot toggle
   - Allow ratings toggle
   - **Lines saved:** ~55 lines

**Total lines extracted:** ~1,005 lines (61% of original 1,647-line file)

---

## ~~Remaining Sections~~ All Extracted! ✅

### ~~🔄 To Be Extracted~~ Archive of Original Plan

#### 1. CatchBasicsSection (~200 lines)
**Location:** Lines 633-826
**Contains:**
- Species selector (combobox with search)
- Custom species input
- Weight input (with unit selector: lb_oz, lb, kg)
- Length input (with unit selector: cm, inches)

**Props Needed:**
```typescript
interface CatchBasicsSectionProps {
  species: string;
  customSpecies: string;
  weight: string;
  weightUnit: string;
  length: string;
  lengthUnit: string;
  speciesPopoverOpen: boolean;
  speciesSearch: string;
  onSpeciesChange: (species: string) => void;
  onCustomSpeciesChange: (species: string) => void;
  onWeightChange: (weight: string) => void;
  onWeightUnitChange: (unit: string) => void;
  onLengthChange: (length: string) => void;
  onLengthUnitChange: (unit: string) => void;
  onSpeciesPopoverOpenChange: (open: boolean) => void;
  onSpeciesSearchChange: (search: string) => void;
}
```

**Complexity:** HIGH (complex combobox logic)

---

#### 2. LocationSessionSection (~350 lines)
**Location:** Lines 827-1177
**Contains:**
- Venue selector (combobox with UK fisheries data)
- Custom location label input
- Peg/swim input
- Water type selector
- Session selector/creator
- GPS location toggle
- Caught at date picker

**Props Needed:**
```typescript
interface LocationSessionSectionProps {
  location: string;
  customLocationLabel: string;
  pegOrSwim: string;
  waterType: string;
  selectedSession: string;
  caughtAt: string;
  gpsEnabled: boolean;
  venuePopoverOpen: boolean;
  waterTypePopoverOpen: boolean;
  sessionOptions: SessionOption[];
  onLocationChange: (location: string) => void;
  onCustomLocationLabelChange: (label: string) => void;
  onPegOrSwimChange: (pegOrSwim: string) => void;
  onWaterTypeChange: (waterType: string) => void;
  onSessionChange: (sessionId: string) => void;
  onCaughtAtChange: (date: string) => void;
  onGpsEnabledChange: (enabled: boolean) => void;
  onVenuePopoverOpenChange: (open: boolean) => void;
  onWaterTypePopoverOpenChange: (open: boolean) => void;
}
```

**Complexity:** VERY HIGH (session creation, complex selectors)

---

#### 3. TacticsSection (~265 lines)
**Location:** Lines 1178-1442
**Contains:**
- Method selector (combobox)
- Custom method input
- Bait selector (combobox)
- Equipment used textarea
- Time of day selector

**Props Needed:**
```typescript
interface TacticsSectionProps {
  method: string;
  customMethod: string;
  baitUsed: string;
  equipmentUsed: string;
  timeOfDay: string;
  methodPopoverOpen: boolean;
  baitPopoverOpen: boolean;
  methodOptions: { slug: string; label: string; group: string }[];
  baitOptions: { slug: string; label: string; category: string }[];
  onMethodChange: (method: string) => void;
  onCustomMethodChange: (method: string) => void;
  onBaitUsedChange: (bait: string) => void;
  onEquipmentUsedChange: (equipment: string) => void;
  onTimeOfDayChange: (timeOfDay: string) => void;
  onMethodPopoverOpenChange: (open: boolean) => void;
  onBaitPopoverOpenChange: (open: boolean) => void;
}
```

**Complexity:** HIGH (multiple comboboxes)

---

#### 4. StorySection (~20 lines)
**Location:** Lines 1443-1462
**Contains:**
- Title input
- Description textarea

**Props Needed:**
```typescript
interface StorySectionProps {
  title: string;
  description: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
}
```

**Complexity:** LOW (simple inputs)

---

#### 5. ConditionsSection (~64 lines)
**Location:** Lines 1463-1527
**Contains:**
- Collapsible section
- Weather selector
- Air temperature input
- Water clarity selector
- Wind direction selector

**Props Needed:**
```typescript
interface ConditionsSectionProps {
  showConditions: boolean;
  weather: string;
  airTemp: string;
  waterClarity: string;
  windDirection: string;
  onShowConditionsChange: (show: boolean) => void;
  onWeatherChange: (weather: string) => void;
  onAirTempChange: (temp: string) => void;
  onWaterClarityChange: (clarity: string) => void;
  onWindDirectionChange: (direction: string) => void;
}
```

**Complexity:** MEDIUM (collapsible logic)

---

## Refactoring Pattern

### Step 1: Create Component File
```bash
src/components/catch-form/[SectionName].tsx
```

### Step 2: Define Props Interface
```typescript
interface [SectionName]Props {
  // All form values this section needs
  // All change handlers
  // Any additional state (popovers, etc.)
}
```

### Step 3: Extract JSX
- Copy JSX from AddCatch.tsx
- Replace `formData.field` with props
- Replace `setFormData` calls with `onFieldChange` props
- Import all necessary UI components

### Step 4: Update AddCatch.tsx
```typescript
import { SectionName } from "@/components/catch-form/SectionName";

// In JSX:
<SectionName
  field={formData.field}
  onFieldChange={(value) => setFormData({ ...formData, field: value })}
  // ... other props
/>
```

### Step 5: Test
- Verify form functionality
- Check validation
- Test submission

---

## Benefits of Refactoring

### Code Quality
- ✅ **Reduced complexity:** Each component has single responsibility
- ✅ **Better readability:** ~200-300 lines per component vs 1,647
- ✅ **Easier testing:** Unit test individual sections
- ✅ **Type safety:** Props explicitly define data flow

### Maintainability
- ✅ **Isolated changes:** Update one section without affecting others
- ✅ **Reusability:** Sections can be used in other forms
- ✅ **Debugging:** Easier to locate issues

### Performance
- ✅ **Potential memoization:** Can memoize unchanged sections
- ✅ **Lazy loading:** Load sections on demand

---

## Shared Utilities

Some helper functions should be moved to separate files:

### `src/lib/catch-form-utils.ts`
```typescript
export const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trimStart();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

export const toTitleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

export const formatGroupLabel = (value: string | null | undefined) => {
  if (!value) return "Other";
  return toTitleCase(value.replace(/[-_]/g, " "));
};
```

---

## Testing Strategy

After extraction, add tests for each component:

### MediaUploadSection.test.tsx
```typescript
describe("MediaUploadSection", () => {
  it("should handle main image upload");
  it("should handle gallery image upload");
  it("should limit gallery to 6 images");
  it("should remove gallery images");
  it("should handle video URL change");
});
```

### TagsPrivacySection.test.tsx
```typescript
describe("TagsPrivacySection", () => {
  it("should capitalize first word of tags");
  it("should change visibility");
  it("should toggle hide exact spot");
});
```

---

## Estimated Effort

| Section | Complexity | Time | Status |
|---------|-----------|------|--------|
| CatchBasicsSection | High | 2h | ✅ Complete |
| LocationSessionSection | Very High | 3h | ✅ Complete |
| TacticsSection | High | 2h | ✅ Complete |
| StorySection | Low | 0.5h | ✅ Complete |
| ConditionsSection | Medium | 1h | ✅ Complete |
| MediaUploadSection | Medium | 1h | ✅ Complete |
| TagsPrivacySection | Low | 0.5h | ✅ Complete |
| **Total** | | **10h** | **100% Complete** |

---

## Next Steps

1. ✅ ~~Extract all section components~~ **Complete!**
2. **Integrate components into AddCatch.tsx** (Next task)
   - Import all extracted components
   - Replace inline JSX with component calls
   - Wire up all props and handlers
   - Test form functionality
3. Create shared utilities file (`src/lib/catch-form-utils.ts`)
   - Extract `capitalizeFirstWord`, `toTitleCase`, etc.
   - Reduce code duplication across components
4. Add unit tests for each component
5. Performance test the refactored form
6. Update AddCatch.tsx to use extracted components

---

## Migration Notes

- Keep original AddCatch.tsx until all sections are extracted and tested
- Can do incremental migration (replace one section at a time)
- Maintain backward compatibility during transition
- Use feature flag if deploying incrementally

---

## Success Criteria

- ✅ AddCatch.tsx reduced to <400 lines (orchestration logic only)
- ✅ Each section component <300 lines
- ✅ All sections have defined TypeScript interfaces
- ✅ Unit tests for each component
- ✅ Form functionality unchanged
- ✅ No performance regression
