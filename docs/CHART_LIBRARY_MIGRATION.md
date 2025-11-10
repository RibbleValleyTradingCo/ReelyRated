# Chart Library Migration Plan
**Goal:** Remove Nivo charts (@nivo/bar, @nivo/line) and consolidate on Recharts

## Current State

### Dependencies
```json
{
  "@nivo/bar": "^0.99.0",      // ~60 KB gzipped
  "@nivo/core": "^0.99.0",     // ~50 KB gzipped
  "@nivo/line": "^0.99.0",     // ~50 KB gzipped
  "recharts": "^2.15.4"        // ~180 KB gzipped
}
```

**Total:** ~340 KB gzipped
**After migration:** ~180 KB gzipped (~160 KB savings, 47% reduction)

### Usage
**Nivo (to be removed):**
- `src/pages/Insights.tsx`:
  - 1x ResponsiveLine (line 1026) - Catch trends over time
  - 4x ResponsiveBar (lines 1084, 1143, 1199, 1256) - Species, venues, methods, baits

**Recharts (keeping):**
- `src/components/ui/chart.tsx` - shadcn/ui chart wrapper
- Used throughout app via shadcn/ui components

---

## Migration Strategy

### Phase 1: Prepare (1 hour)
1. ✅ Document current chart usage
2. ✅ Create migration plan
3. [ ] Create Recharts wrapper utilities
4. [ ] Set up side-by-side comparison environment

### Phase 2: Migrate Charts (6 hours)
Migrate each chart in `Insights.tsx`:

#### Chart 1: Catch Trends (Line Chart)
**Current (Nivo):**
```tsx
<ResponsiveLine
  data={lineData}
  margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
  xScale={{ type: 'time', format: '%Y-%m-%d' }}
  // ... custom Nivo config
/>
```

**Target (Recharts):**
```tsx
<ChartContainer config={chartConfig}>
  <LineChart data={lineData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Line type="monotone" dataKey="count" stroke="var(--color-count)" />
  </LineChart>
</ChartContainer>
```

#### Chart 2-5: Bar Charts (Species, Venues, Methods, Baits)
**Current (Nivo):**
```tsx
<ResponsiveBar
  data={barData}
  keys={['count']}
  indexBy="name"
  // ... custom Nivo config
/>
```

**Target (Recharts):**
```tsx
<ChartContainer config={chartConfig}>
  <BarChart data={barData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="count" fill="var(--color-count)" />
  </BarChart>
</ChartContainer>
```

### Phase 3: Testing (2 hours)
1. [ ] Verify all charts render correctly
2. [ ] Test responsive behavior
3. [ ] Test dark mode
4. [ ] Test data edge cases (empty, single point, etc.)
5. [ ] Visual regression testing

### Phase 4: Cleanup (1 hour)
1. [ ] Remove Nivo imports from Insights.tsx
2. [ ] Uninstall Nivo packages
3. [ ] Update package.json
4. [ ] Run bundle analyzer to verify savings
5. [ ] Update documentation

---

## Implementation Guide

### Step 1: Create Chart Utilities

Create `src/lib/charts/recharts-utils.ts`:

```typescript
import type { ChartConfig } from "@/components/ui/chart";

/**
 * Convert Nivo bar chart data to Recharts format
 * Nivo: [{ id: 'species', data: [{ x: 'Pike', y: 10 }] }]
 * Recharts: [{ name: 'Pike', value: 10 }]
 */
export const nivoBarToRecharts = (
  nivoData: Array<{ id: string; data: Array<{ x: string; y: number }> }>
) => {
  return nivoData[0]?.data.map(item => ({
    name: item.x,
    value: item.y,
  })) || [];
};

/**
 * Convert Nivo line chart data to Recharts format
 * Nivo: [{ id: 'catches', data: [{ x: '2024-01-01', y: 5 }] }]
 * Recharts: [{ date: '2024-01-01', catches: 5 }]
 */
export const nivoLineToRecharts = (
  nivoData: Array<{ id: string; data: Array<{ x: string; y: number }> }>,
  dataKey: string = 'value'
) => {
  return nivoData[0]?.data.map(item => ({
    date: item.x,
    [dataKey]: item.y,
  })) || [];
};

/**
 * Create chart config for shadcn/ui charts
 */
export const createChartConfig = (
  dataKey: string,
  label: string,
  color: string
): ChartConfig => ({
  [dataKey]: {
    label,
    color,
  },
});
```

### Step 2: Migrate One Chart (Example)

**Before (Nivo):**
```tsx
// Imports
import { ResponsiveBar } from "@nivo/bar";

// In component
const speciesData = [
  {
    id: "species",
    data: speciesCounts.map(s => ({ x: s.name, y: s.count }))
  }
];

// Render
<div style={{ height: 400 }}>
  <ResponsiveBar
    data={speciesData}
    keys={['y']}
    indexBy="x"
    margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
    padding={0.3}
    valueScale={{ type: 'linear' }}
    colors={{ scheme: 'nivo' }}
    axisBottom={{
      tickSize: 5,
      tickPadding: 5,
      tickRotation: -45,
    }}
  />
</div>
```

**After (Recharts):**
```tsx
// Imports
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { createChartConfig } from "@/lib/charts/recharts-utils";

// In component
const speciesChartData = speciesCounts.map(s => ({
  name: s.name,
  count: s.count
}));

const speciesChartConfig = createChartConfig(
  "count",
  "Catches",
  "hsl(var(--chart-1))"
);

// Render
<ChartContainer config={speciesChartConfig} className="h-[400px]">
  <BarChart data={speciesChartData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis
      dataKey="name"
      angle={-45}
      textAnchor="end"
      height={100}
    />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="count" fill="var(--color-count)" />
  </BarChart>
</ChartContainer>
```

### Step 3: Test Migration

```bash
# Before migration - note bundle size
npm run build
# Check dist/ folder size

# After migration
npm run build
# Compare bundle size - should see ~160KB reduction

# Visual testing
npm run dev
# Navigate to /insights
# Verify all charts display correctly
```

---

## Data Transformation Examples

### Bar Chart Data
```typescript
// Nivo format
const nivoBarData = [
  {
    id: "catches",
    data: [
      { x: "Pike", y: 12 },
      { x: "Carp", y: 8 },
    ]
  }
];

// Recharts format
const rechartsBarData = [
  { name: "Pike", value: 12 },
  { name: "Carp", value: 8 },
];
```

### Line Chart Data
```typescript
// Nivo format
const nivoLineData = [
  {
    id: "catches",
    data: [
      { x: "2024-01-01", y: 5 },
      { x: "2024-01-02", y: 8 },
    ]
  }
];

// Recharts format
const rechartsLineData = [
  { date: "2024-01-01", catches: 5 },
  { date: "2024-01-02", catches: 8 },
];
```

---

## Testing Checklist

- [ ] All 5 charts render without errors
- [ ] Data displays correctly (no missing bars/points)
- [ ] Axes labels are readable
- [ ] Tooltips show correct information
- [ ] Charts are responsive on mobile
- [ ] Dark mode works correctly
- [ ] Empty state handled gracefully
- [ ] Large datasets (50+ items) perform well
- [ ] Animations are smooth
- [ ] Accessibility (keyboard navigation, ARIA labels)

---

## Rollback Plan

If issues arise after migration:

### Quick Rollback
1. Revert `src/pages/Insights.tsx`
2. Reinstall Nivo: `npm install @nivo/bar @nivo/core @nivo/line`
3. Deploy previous version

### Partial Rollback
Keep migrated charts that work, revert problematic ones:

```tsx
// Keep both libraries temporarily
import { ResponsiveBar as NivoBar } from "@nivo/bar";
import { BarChart as RechartsBar } from "recharts";

// Use Recharts for most, Nivo for problematic chart
<RechartsBar data={data1} /> // Works
<NivoBar data={data2} />      // Needs more work
```

---

## Expected Outcomes

### Bundle Size
- **Before:** ~340 KB charts
- **After:** ~180 KB charts
- **Savings:** ~160 KB (47% reduction)

### Performance
- **Initial load:** ~0.5s faster (mobile 3G)
- **Parse time:** ~50ms faster
- **Memory:** ~2MB less

### Developer Experience
- ✅ Single chart library (simpler codebase)
- ✅ Better TypeScript support (Recharts)
- ✅ Matches shadcn/ui components
- ✅ More examples/documentation available

---

## Estimated Effort

| Phase | Time | Priority |
|-------|------|----------|
| Preparation | 1 hour | Medium |
| Migration | 6 hours | Medium |
| Testing | 2 hours | High |
| Cleanup | 1 hour | Low |
| **Total** | **10 hours** | **Medium** |

---

## Status

- [ ] Migration plan created
- [ ] Recharts utilities created
- [ ] First chart migrated (example)
- [ ] All charts migrated
- [ ] Testing completed
- [ ] Nivo dependencies removed
- [ ] Bundle size verified

**Current:** Planning phase
**Next:** Create utilities and migrate first chart
**Blocked by:** None
**Assigned to:** TBD
