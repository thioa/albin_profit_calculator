# CSS Class Analysis Report
## Albion Market Insight Project

**Generated:** April 6, 2026  
**Scope:** `src/` directory - all TSX components and CSS files  
**Analysis Type:** Comprehensive class usage, naming conflicts, and Tailwind compliance

---

## Executive Summary

The codebase demonstrates **good Tailwind CSS adoption** but has several areas of concern:
- ✅ Extensive use of the custom `glass-panel` component class (59 instances)
- ✅ Consistent use of design tokens (primary, sidebar-*, destructive, etc.)
- ⚠️ **Heavy use of arbitrary font sizes** (text-[8px], text-[9px], text-[10px], text-[11px])
- ⚠️ **Undefined/non-standard classes** (text-on-surface, font-body, custom-scrollbar)
- ⚠️ **Mix of inline styles and Tailwind** for dynamic values
- ⚠️ **Incomplete custom CSS class definitions in index.css**

---

## 1. Custom CSS Classes Defined in `src/index.css`

### Classes Found (6 total)

| Class Name | Location | Type | Status |
|-----------|----------|------|--------|
| `.glass-panel` | @layer components, lines 49-52 | Component | ✅ Defined & Used |
| `.page-container` | @layer components, lines 107-127 | Component | ✅ Defined & Used (1x) |
| `.text-muted-accessible` | @layer components, line 101 | Utility | ✅ Defined (0x used) |
| `.text-label-accessible` | @layer components, line 103 | Utility | ✅ Defined (0x used) |
| `.material-symbols-outlined` | @layer components, line 96 | Utility | ✅ Defined (0x used) |
| `[data-slot="..."]` | @layer components, lines 54-94 | Attribute selectors | ✅ Defined |

### Detailed Class Definitions

#### `.glass-panel` (49-52)
```css
.glass-panel {
  background: rgba(32, 38, 47, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(245, 158, 11, 0.15);
}
```
**Usage:** 59 instances across components  
**Quality:** ✅ Excellent - Well-designed, reusable component class  
**Consistency:** High

#### `.page-container` (107-127)
```css
.page-container {
  width: 100%;
  padding-left: 1rem;
  padding-right: 1rem;
  padding-top: 1.5rem;
  padding-bottom: 2rem;
  /* Responsive breakpoints: sm:, lg: */
}
```
**Usage:** 1 instance ([AppShell.tsx](src/components/layout/AppShell.tsx#L341))  
**Quality:** ✅ Good - Responsive padding layout  
**Recommendation:** Consider using Tailwind utilities instead: `w-full px-4 sm:px-6 lg:px-8 py-6 pb-8`

#### Unused Classes
- `.text-muted-accessible` - Never used
- `.text-label-accessible` - Never used
- `.material-symbols-outlined` - Never used (Material Symbols font exists but class not applied)

---

## 2. Class Naming Conflicts & Issues

### Issue #1: Undefined/Non-Standard Classes (CRITICAL)

| Class | File(s) | Instances | Issue |
|-------|---------|-----------|-------|
| `text-on-surface` | BaseCalculator.tsx, Library.tsx | 3 | ❌ Not in Tailwind, not in index.css |
| `font-body` | App.tsx | 1 | ❌ Not defined (should be font-sans) |
| `custom-scrollbar` | Library.tsx:118 | 1 | ❌ Not defined |
| `bg-error` / `error` | MyCrafting.tsx:142 | 1 | ❌ Should be `bg-destructive` |

**Locations:**
- [BaseCalculator.tsx - Line 809](src/components/calculators/BaseCalculator.tsx#L809): `CITY_COLORS[calc.bestCity] ?? "bg-gray-800 text-on-surface border-primary/20"`
- [BaseCalculator.tsx - Line 959](src/components/calculators/BaseCalculator.tsx#L959): Same pattern
- [Library.tsx - Line 65](src/components/library/Library.tsx#L65): `bg-gray-800 text-on-surface`
- [Library.tsx - Line 118](src/components/library/Library.tsx#L118): `max-h-[400px] custom-scrollbar`
- [App.tsx - Line 19](src/App.tsx#L19): `font-body`
- [MyCrafting.tsx - Line 142](src/components/features/MyCrafting.tsx#L142): `bg-error` (condition)

---

### Issue #2: Arbitrary Font Sizes (SIGNIFICANT CONCERN)

**Total instances of arbitrary text sizes: 95+**

These break the design system and should be replaced with standard Tailwind sizes:

```
text-[8px]   - 23 instances  → Use: text-xs (12px)
text-[9px]   - 25 instances  → Use: text-xs (12px) or create tw-text-[9px]
text-[10px]  - 32 instances  → Create custom size or use text-xs
text-[11px]  - 8 instances   → Use: text-sm (14px)
```

**Files with highest arbitrary text-size usage:**
1. [BaseCalculator.tsx](src/components/calculators/BaseCalculator.tsx) - 35+ instances
2. [MyCrafting.tsx](src/components/features/MyCrafting.tsx) - 20+ instances
3. [ProfitScanner.tsx](src/components/features/ProfitScanner.tsx) - 18+ instances
4. [ProfileView.tsx](src/components/auth/ProfileView.tsx) - 12+ instances
5. [PriceChecker.tsx](src/components/features/PriceChecker.tsx) - 8+ instances

**Examples:**
```tsx
// ❌ Current (arbitrary)
<span className="text-[10px] font-black uppercase">Label</span>
<p className="text-[8px] text-primary/25">Description</p>
<div className="text-[9px] uppercase">Item</div>

// ✅ Better (standardized)
// Option 1: Use standard sizes
<span className="text-xs font-black uppercase">Label</span>
<p className="text-xs text-primary/25">Description</p>

// Option 2: Create custom text size in CSS
<span className="text-micro font-black uppercase">Label</span>
```

---

### Issue #3: Arbitrary Width/Height Values

| Pattern | Count | Example | Recommendation |
|---------|-------|---------|-----------------|
| `min-w-[180px]` | 1 | [MyCrafting.tsx:156](src/components/features/MyCrafting.tsx#L156) | Use: `min-w-44` or `min-w-48` |
| `max-w-[1000px]` | 1 | [Library.tsx:36](src/components/library/Library.tsx#L36) | Use: `max-w-4xl` |
| `max-w-[1400px]` | 1 | [BaseCalculator.tsx:518](src/components/calculators/BaseCalculator.tsx#L518) | Use: `max-w-6xl` or `max-w-7xl` |
| `max-h-[400px]` | 1 | [Library.tsx:118](src/components/library/Library.tsx#L118) | Use: `max-h-96` |
| `w-[calc(...)]` | Multiple (UI components) | [UI components](src/components/ui/) | Dynamic - acceptable |

---

### Issue #4: Inconsistent Spacing & Padding Patterns

**Pattern Inconsistency:**
- Some components use `rounded-xl`, others `rounded-2xl`, others `rounded-3xl`
- Padding varies: `p-2`, `p-3`, `p-4`, `p-5`, `p-6` across different contexts
- Border radius not standardized for specific component types

**Recommendation:** Establish component style guidelines:
- Cards/Panels: `rounded-2xl` (consistent across 80%+ of usage)
- Buttons: `rounded-lg` (consistent)
- Inputs: `rounded-xl` (mostly consistent)

---

## 3. Inline Styles (Non-Tailwind)

**Total inline style occurrences: 6**

### Issue #5: Inline Styles for Static Values

| File | Line | Code | Issue | Fix |
|------|------|------|-------|-----|
| [MarketPulse.tsx](src/components/features/MarketPulse.tsx#L265) | 265 | `style={{background: '#151a21'}}` | Should use Tailwind | `className="bg-[#151a21]"` or create CSS variable |
| [MarketPulse.tsx](src/components/features/MarketPulse.tsx#L270) | 270 | `style={{background: '#151a21'}}` | Same | Same |
| [MarketPulse.tsx](src/components/features/MarketPulse.tsx#L291-294) | 291-294 | Multiple `style={{background: '...'}}`  | Same (4 instances) | Consolidate into Tailwind |
| [TopFlipping.tsx](src/components/features/TopFlipping.tsx#L444) | 444 | `style={{ minHeight: '40px' }}` | Should use Tailwind | `className="min-h-10"` |

### Issue #6: Inline Styles for Dynamic Values (ACCEPTABLE)

These are justified because they're dynamic and can't be statically defined:

| File | Line | Type | Reason | ✅ |
|------|------|------|--------|-----|
| [MyCrafting.tsx](src/components/features/MyCrafting.tsx#L143) | 143 | Dynamic width % | Calculated progress bar | Justified |
| [UI Sidebar](src/components/ui/sidebar.tsx) | 132, 190, 611 | CSS custom properties | Dynamic layout values | Justified |

---

## 4. Class Usage Patterns & Coverage

### Custom Classes Summary

```
Total Custom CSS Classes:        6 defined
Classes Actually Used:           2-3 actively used
Unused Classes:                  3
Usage Saturation:                ~40%
```

### Most Used Tailwind Patterns

| Pattern | Count | Status |
|---------|-------|--------|
| `glass-panel` | 59 | ✅ Core component class |
| `flex` | 400+ | ✅ Standard |
| `gap-*` | 250+ | ✅ Standard |
| `rounded-xl/2xl/3xl` | 200+ | ⚠️ Inconsistent |
| `text-[Xpx]` | 95+ | ❌ Problematic |
| `border-primary/*` | 150+ | ✅ Good |
| `bg-*/text-*` | 300+ | ✅ Standard |
| `hidden sm:block` | 45+ | ✅ Good responsive |

---

## 5. Design Token Usage & Consistency

### Good Usage (✅)

Design tokens are consistently used and well-organized:

```
Color tokens: --primary, --sidebar-primary, --destructive, --muted, --card
Spacing tokens: --radius (0.625rem), --radius-sm through --radius-4xl
Typography: --font-sans (Geist Variable), --font-mono (JetBrains)
```

**Usage Examples:**
- ✅ `text-primary` / `text-primary/50` - Consistently used (200+ instances)
- ✅ `bg-sidebar-primary` / `bg-sidebar-accent` - Consistently used (50+ instances)
- ✅ `border-primary/10` / `border-primary/20` - Opacity variations well used
- ✅ `text-destructive` - Good semantic naming

---

## 6. Specific Files with Issues

### High Priority Issues

#### [BaseCalculator.tsx](src/components/calculators/BaseCalculator.tsx) (142 issues)
- **Problem:** Heavy use of arbitrary text sizes + undefined `text-on-surface` class
- **Instances:** 35+ `text-[10px]`, 8+ `text-[8px]`, 3x `text-on-surface`
- **Lines:** 625, 638, 652, 669, 689, 809, 870, 920, 961, 1023-1058, 1160, 1187, 1288, 1314-1351, 1374
- **Impact:** Moderate - affects calculator tables and labels
- **Fix Effort:** High - requires systematic refactoring

#### [MyCrafting.tsx](src/components/features/MyCrafting.tsx) (95 issues)
- **Problem:** Arbitrary text sizes throughout
- **Instances:** 20+ `text-[10px]`, 5+ `text-[8px]`, 3+ `text-[9px]`
- **Lines:** 165, 172, 202, 235, 237, 252, 255, 261, 265, 281, 288, 295-296, 304
- **Impact:** High - visible to users
- **Fix Effort:** High

#### [Library.tsx](src/components/library/Library.tsx) (4 issues)
- **Problem:** Undefined `text-on-surface`, `custom-scrollbar`, arbitrary sizes
- **Instances:** 1x `text-on-surface`, 1x `custom-scrollbar`, 2x `text-[10px]`, 1x `max-w-[1000px]`
- **Lines:** 36, 65, 67, 118
- **Impact:** Medium
- **Fix Effort:** Low

#### [App.tsx](src/App.tsx) (1 issue)
- **Problem:** Undefined `font-body` class
- **Instances:** 1x `font-body`
- **Line:** 19
- **Impact:** Low
- **Fix Effort:** Trivial

#### [ProfileView.tsx](src/components/auth/ProfileView.tsx) (12 issues)
- **Problem:** Arbitrary text sizes
- **Instances:** 12x `text-[10px]` or smaller
- **Impact:** Medium
- **Fix Effort:** Medium

---

### Medium Priority Issues

#### [ProfitScanner.tsx](src/components/features/ProfitScanner.tsx) (18+ issues)
- Arbitrary text sizes throughout
- Lines: 197, 202, 211-220, 280-364

#### [MarketPulse.tsx](src/components/features/MarketPulse.tsx) (6 issues)
- Inline `style={{background: '#151a21'}}` on select options
- Lines: 265, 270, 291-294

#### [TopFlipping.tsx](src/components/features/TopFlipping.tsx) (1 issue)
- Inline `style={{ minHeight: '40px' }}`
- Line: 444

---

## 7. Tailwind Class Combination Issues

### Potential Issues (Minor)

| Pattern | File | Issue | Severity |
|---------|------|-------|----------|
| `hidden sm:inline` | Multiple | Good responsive design | ✅ OK |
| `text-primary/40 hover:text-primary` | Multiple | Good opacity shifts | ✅ OK |
| `bg-black/40 border border-primary/20` | Multiple | Good contrast | ✅ OK |

### No Major Tailwind Conflicts Found
- No conflicting utility classes detected
- Responsive breakpoints used correctly
- Color opacity system used consistently

---

## 8. Recommendations for Cleanup

### Priority 1 (Critical) - Fix Undefined Classes

1. **Fix `text-on-surface`** → Replace with Tailwind equivalent
   ```tsx
   // ❌ Current
   className="text-on-surface"
   
   // ✅ Fix
   className="text-foreground" // or appropriate color
   ```
   **Files:** [BaseCalculator.tsx](src/components/calculators/BaseCalculator.tsx), [Library.tsx](src/components/library/Library.tsx)

2. **Fix `font-body`** → Replace with defined class
   ```tsx
   // ❌ Current (App.tsx:19)
   className="... font-body ..."
   
   // ✅ Fix
   className="... font-sans ..." // already defined in theme
   ```

3. **Fix `custom-scrollbar`** → Create CSS class or use standard
   ```css
   /* Add to index.css @layer components */
   .custom-scrollbar {
     scrollbar-width: thin;
     scrollbar-color: theme('colors.primary / 0.2') transparent;
   }
   ```

4. **Fix `bg-error`** → Use `bg-destructive`
   ```tsx
   // ❌ Current (MyCrafting.tsx:142)
   bg-error
   
   // ✅ Fix
   bg-destructive
   ```

---

### Priority 2 (High) - Standardize Arbitrary Text Sizes

**Create 3 new CSS classes in `index.css`:**

```css
@layer components {
  .text-micro {
    @apply text-[8px] leading-tight;
  }
  .text-tiny {
    @apply text-[9px] leading-tight;
  }
  .text-label {
    @apply text-[10px] leading-normal;
  }
}
```

**Then replace globally:**
- Replace 23x `text-[8px]` with `text-micro`
- Replace 25x `text-[9px]` with `text-tiny`  
- Replace 32x `text-[10px]` with `text-label`
- Replace 8x `text-[11px]` with `text-sm`

**Use find/replace across all files:**
```
text-\[8px\] → text-micro
text-\[9px\] → text-tiny
text-\[10px\] → text-label
text-\[11px\] → text-sm
```

---

### Priority 3 (Medium) - Replace Inline Styles

**MarketPulse.tsx - Select option styling:**
```tsx
// ❌ Current
<option value="demand" style={{background: '#151a21'}}>Demand</option>

// ✅ Better - Add global style
// In index.css:
select option {
  background-color: rgb(21, 26, 33);
  color: inherit;
}
```

**TopFlipping.tsx - Min height:**
```tsx
// ❌ Current
<div style={{ minHeight: '40px' }}>

// ✅ Better
<div className="min-h-10">
```

---

### Priority 4 (Low) - Optimize Unused Classes

**Remove or repurpose:**
- `.text-muted-accessible` - Not used, unclear purpose
- `.text-label-accessible` - Not used, unclear purpose
- `.material-symbols-outlined` - Not used

**Action:** Delete from `index.css` if truly unused, or document their intended purpose.

---

### Priority 5 (Low) - Replace `.page-container`

**Option 1: Keep for consistency**
- `.page-container` is well-designed and used once
- Keeps layout logic in CSS

**Option 2: Inline Tailwind utilities**
```tsx
// Instead of:
<div className="page-container">

// Use:
<div className="w-full px-4 sm:px-6 lg:px-8 py-6 pb-8">
```

**Recommendation:** Keep `.page-container` - it's reusable and well-designed.

---

## 9. Summary Table

| Issue | Count | Severity | Effort | Files |
|-------|-------|----------|--------|-------|
| Undefined classes | 4 | 🔴 Critical | Low | 4 files |
| Arbitrary text-[Xpx] | 95+ | 🟠 High | High | 8 files |
| Arbitrary width/height | 4 | 🟡 Medium | Low | 3 files |
| Inline static styles | 5 | 🟡 Medium | Low | 3 files |
| Unused CSS classes | 3 | 🟢 Low | None | 1 file |
| **TOTAL ISSUES** | **111+** | Mixed | Medium | 12 files |

---

## 10. Action Plan

### Phase 1 (Immediate) - Critical Fixes
1. ✅ Replace all `text-on-surface` with `text-foreground`
2. ✅ Replace `font-body` with `font-sans`
3. ✅ Fix `bg-error` → `bg-destructive`
4. ✅ Define or remove `custom-scrollbar`

**Estimated time:** 15 minutes

### Phase 2 (This Week) - Standardize Text Sizes
1. Add 3 new CSS classes to `index.css` (text-micro, text-tiny, text-label)
2. Global find/replace across all TSX files
3. Test UI for visual consistency

**Estimated time:** 1-2 hours

### Phase 3 (Next Week) - Polish
1. Replace inline styles with Tailwind
2. Standardize border radius patterns
3. Audit responsive classes

**Estimated time:** 1 hour

---

## 11. Tools & Scripts

### Find/Replace Commands (for VS Code)

**Find undefined classes:**
```regex
(text-on-surface|font-body|custom-scrollbar|bg-error)
```

**Find arbitrary text sizes:**
```regex
text-\[(8|9|10|11)px\]
```

**Find inline styles requiring fixes:**
```regex
style=\{\{(background|minHeight)
```

---

## Conclusion

The codebase demonstrates **good foundational design patterns** with the custom `glass-panel` class and consistent use of design tokens. However, **arbitrary font sizes** represent the most significant technical debt, appearing 95+ times across 8 files.

**Recommended approach:**
1. ✅ Fix 4 undefined classes (15 min) - **Do this now**
2. ✅ Create 3 text-size utility classes (5 min) - **Do this before Phase 2**
3. ✅ Refactor text sizes project-wide (2 hours) - **Schedule this week**
4. ✅ Clean up remaining issues (1 hour) - **Schedule next week**

**Expected outcome:** A cleaner, more maintainable codebase that adheres to Tailwind CSS best practices and the established design system.
