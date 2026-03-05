# Phase 17A: Mobile UX Polish

## Purpose

Make the mobile experience feel native-quality and remove the most obvious friction points before TestFlight distribution. No database schema changes.

## Changes

### 1. Responsive Vault Layout

- **app/page.tsx**
  - Mobile: `p-4`, tablet/desktop: `p-6`; main container uses `pb-safe` for gesture bars/safe areas.
  - Main content has `overflow-y-auto` for smooth scrolling.

- **ItemList (vault grid)**
  - Mobile (&lt;640px): single-column list, full-width cards, comfortable padding.
  - Tablet (640–1024px): 2-column grid.
  - Desktop: single column (max-w-2xl).
  - Cards: `p-4`, `rounded-xl`, `shadow-sm`, `border border-neutral-200`; desktop hover: `transition`, `hover:shadow-md`, `hover:-translate-y-[1px]`.

### 2. Tap Targets (44px minimum)

- **Button (src/components/ui/Button.tsx)**  
  New reusable button with `min-h-[44px]`, `min-w-[44px]`, `touch-manipulation`, and variants: primary, secondary, danger, success.

- **ItemList**  
  Inbox/Vault/Type filter buttons and Sort select use at least 44px height; Load more button and priority select updated.

- **TagChips**  
  Chips use `min-h-[44px]` / `min-w-[44px]` on small screens, normal size on `sm+`.

- **AddToCollection**  
  Select has `min-h-[44px]` and `touch-manipulation`.

- **ItemDetailClient**  
  Action buttons use Button component or explicit 44px min height.

- **SearchClient**  
  Tag filter buttons, Save/Create alert, Load more use 44px min height where appropriate.

- **Share import**  
  Success screen and form buttons are stacked on mobile with 44px min height.

### 3. Keyboard Overlap / Safe Area

- **ItemDetailClient**  
  Wrapped in `min-h-screen overflow-y-auto pb-safe`; inner content uses `safe-area-bottom` so inputs stay visible when the keyboard is open.

- **Share import page**  
  Page wrapper: `min-h-screen overflow-y-auto pb-safe`; content area uses `safe-area-bottom` and responsive padding.

- **globals.css**  
  New utility `.pb-safe` (padding-bottom from safe-area-inset-bottom).

### 4. Share Import Success Screen

- After a successful Quick Save, show a dedicated success screen:
  - **✓ Saved to Inbox**
  - Buttons (stacked on mobile): [View Item], [Add Tags], [Move to Collection], [Back to Vault].
  - All use 44px min height and full-width on mobile.
  - View Item / Add Tags / Move to Collection link to the new item; Back to Vault links to `/app`. On navigation, `savedItemId` is cleared and pending payloads are refetched.

### 5. Mobile Search UX

- **SearchBar (src/components/search/SearchBar.tsx)**
  - Autofocus when the search view is opened.
  - Input: `h-12`, `text-base`, `px-4`, `rounded-xl`.
  - Clear button when query is non-empty (44px tap target).
  - Close button (link to Vault) with 44px tap target.

- **SearchClient**  
  Uses SearchBar; tag filters and actions use larger tap targets; loading state uses skeleton placeholders.

### 6. Loading States (Skeletons)

- **Skeleton (src/components/ui/Skeleton.tsx)**  
  Reusable `Skeleton` and helpers: `SkeletonCard` (vault), `SkeletonLine`.

- **Vault**  
  “Load more” shows two skeleton cards while loading.

- **Share import**  
  Initial load shows skeleton blocks.

- **Search**  
  Initial results load shows skeleton rows.

### 7. Layout Shift Reduction

- **ItemList cards**  
  Each card has a consistent preview container: `aspect-video`, `bg-neutral-100`, `rounded-lg`, so images/file previews and cards reserve height and avoid jump.

### 8. Mobile Bottom Padding

- Main vault container in **app/page.tsx** uses `pb-safe` so content clears the gesture bar and safe area on notched devices.

### 9. Files Touched

- **New:** `docs/PHASE17A_MOBILE_UX_POLISH.md`, `src/components/ui/Skeleton.tsx`, `src/components/ui/Button.tsx`, `src/components/search/SearchBar.tsx`
- **Modified:** `src/app/(app)/app/page.tsx`, `src/app/(app)/share-import/page.tsx`, `src/app/(app)/app/item/[id]/ItemDetailClient.tsx`, `src/components/ItemList.tsx`, `src/components/TagChips.tsx`, `src/components/AddToCollection.tsx`, `src/app/(app)/search/SearchClient.tsx`, `src/app/(app)/app/VaultClient.tsx`, `src/app/globals.css`

## Verification Checklist

- [ ] **Mobile vault scrolling** – Vault list scrolls smoothly; no content stuck under the gesture bar (pb-safe).
- [ ] **Tap targets** – Buttons, tag chips, collection selector, and item actions are easy to hit (≥44px) on phone.
- [ ] **Keyboard** – When editing item description, tags, or quick-save fields, the keyboard does not cover the focused input (scroll/safe-area behavior).
- [ ] **Share-import success** – After saving from share-import, the “✓ Saved to Inbox” screen appears with View Item, Add Tags, Move to Collection, Back to Vault; buttons are stacked on mobile.
- [ ] **Search** – Search input is focused when opened; large input and Clear/Close buttons work; results loading shows skeletons.

## Testing

- Run `pnpm lint` and `pnpm exec tsc --noEmit`.
- Test on iPhone simulator, Android emulator, and desktop browser with mobile viewport.
