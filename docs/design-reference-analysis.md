# PRATTO design reference analysis

## 1. Purpose and authority

This document records the implementation in `design-reference/` as the visual and interaction source of truth for the next frontend phase.

The authority boundary is deliberate:

- `design-reference/` owns UI composition, visual identity, interaction models, responsive intent, component appearance, density, and UX tone.
- The real PRATTO application owns architecture, routes, authentication, tenant isolation, API contracts, validation, database rules, media storage, analytics semantics, publication history, and all business behavior.
- A later implementation must translate the reference onto the real application. It must not copy the mock store or weaken the current contracts to make the reference easier to reproduce.
- This analysis does not authorize frontend implementation or backend changes.

## 2. Review method and runtime result

The complete reference source, its two embedded briefs, mock data, components, store, Customer screens, Admin screens, and Vite setup were inspected. The application was then run locally and navigated with Chromium at the following representative sizes:

- Customer frame: 390 × 812 px.
- Admin large desktop: 1440 × 1000 px.
- Admin desktop: 1280 × 800 px.
- Admin small laptop/tablet landscape: 1024 × 768 px.

The runtime pass covered entry, feed, category selection, gallery gestures, detail sheet, restaurant information, unavailable menu, dashboard, dishes, categories, drawers, validation, search empty state, drag state, confirmation, preview, restaurant settings, opening hours, appearance, saving, toast feedback, sidebar collapse, and loading states.

No browser console errors, page exceptions, or failed network requests were observed during the automated pass.

The exported `vite.config.ts` imports `.figma/make/site.json`, but that file is absent. The reference therefore cannot start with its original Vite configuration as delivered. It was run with a minimal transient Vite configuration using the same React and Tailwind plugins. This did not change the rendered application code, but the missing Figma file is a packaging/reproducibility issue to resolve before treating the reference as independently runnable.

## 3. Product and UX thesis

The visual concept is a warm editorial restaurant experience built around photography, not a delivery application and not a generic SaaS dashboard.

The central Customer interaction is full-viewport vertical discovery. Each dish is treated as an editorial feature: photography fills the surface, typography and gradients provide hierarchy, and navigation chrome stays quiet. TikTok/Reels contributes the swipe model only; there are no social-network controls or visual imitation.

The Admin uses the same typography, neutrals, accent, radii, and restrained depth, but changes mode from immersive discovery to compact operation. It is desktop-first and information-dense without becoming visually cold.

Hard product exclusions in the reference are cart, checkout, payment, orders, delivery, quantity controls, customer login, favorites, reviews, recommendations, QR scanning, and purchase CTAs. The only Customer action on a dish is to inspect it and return to browsing.

## 4. Complete visual identity

### 4.1 Character

The identity is:

- Food-first: food photography is the most visually dominant material.
- Warm: cream and sand replace generic white/gray surfaces.
- Editorial: Instrument Serif is reserved for restaurant names, screen headings, and dish titles.
- Contemporary and restrained: icons are thin Lucide outlines, decoration is sparse, and shadows are contextual.
- Premium but accessible: large readable titles, clear prices, generous touch targets, and direct language.
- Brandable: one restaurant accent token recolors controlled highlights without changing the neutral foundation.

### 4.2 Color system

The normative CSS variables are defined in `design-reference/src/index.css` and were confirmed from computed browser styles.

| Token | Value | Primary use |
| --- | --- | --- |
| `--color-cream` | `#fff9f4` | Main Customer and Admin surfaces, sheets, dialogs, inputs |
| `--color-sand` | `#f3ebe3` | App background, secondary surfaces, skeletons, soft buttons |
| `--color-sand-deep` | `#e9ded2` | Hover/pressed surfaces, inactive toggle track, image fallback |
| `--color-ink` | `#181716` | Primary text, active Admin navigation, dark buttons |
| `--color-ink-soft` | `#4a4642` | Body and secondary text |
| `--color-ink-faint` | `#8a827a` | Labels, hints, metadata, inactive navigation |
| `--color-accent` | `#f45b3d` | Primary CTA, selected highlights, validation, chart emphasis |
| `--color-accent-deep` | `#d8452a` | Accent text and hover state |
| `--color-herb` | `#3f7652` | Open/active/success states and availability toggles |
| `--color-line` | `#eadfd4` | Hairline borders and dividers |

Additional chart accents are terracotta `#e08a4a`, olive `#7a8a5c`, clay `#c96a4a`, and warm gray `#a8a099`. Warning toast uses `#c07a1b`.

Accent presets are Páprica, Terracota, Erva, Açafrão, Ameixa, and Índigo. The default is Páprica. The system computes a darker custom accent by multiplying RGB channels by `0.82`.

Color usage rule: accent is rare and purposeful. It belongs on primary actions, selected/active markers, compact status feedback, and data emphasis. Neutral surfaces and photography must remain dominant.

### 4.3 Typography

The reference imports Google Fonts:

- UI/body: Instrument Sans, variable weights 400–700.
- Editorial: Instrument Serif, regular and italic.
- Fallbacks: system sans for Instrument Sans; Georgia/ui-serif for Instrument Serif.

Observed hierarchy:

| Role | Typical treatment |
| --- | --- |
| Restaurant entry name | Instrument Serif, 42 px, line-height 1 |
| Customer feed dish title | Instrument Serif, 34 px, line-height 1.05 |
| Customer screen title | Instrument Serif, 32–34 px |
| Customer detail title | Instrument Serif, 30 px |
| Admin page title | Instrument Serif, 34 px |
| Drawer title | Instrument Serif, 24 px |
| Metric value | Instrument Sans, 30 px, semibold |
| Primary body | Instrument Sans, 15 px, relaxed line-height where descriptive |
| Control text | 14–15 px, medium/semibold |
| Section label | 11 px, semibold, uppercase, tracking 0.14–0.22 em |
| Price | 15–20 px, semibold, tabular numerals |

Serif is not used for dense operational copy, table labels, form labels, or buttons. It supplies editorial identity at headings only.

### 4.4 Spacing and density

The declared direction is an 8 px spacing system. The implementation uses an 8 px base rhythm with 4 px half-steps and common values of 8, 12, 16, 20, 24, 28, and 32 px.

Key layout values:

- Customer horizontal content padding: 16–20 px; entry content uses 24 px.
- Admin main padding: 24 px, increasing to 40 px at `lg`.
- Admin card padding: 20 px.
- Drawer header/body: 24 px horizontal; body and header commonly 20 px vertical.
- Form control height: 44 px; compact buttons: 36 px; icon buttons: 40 px.
- Customer bottom navigation reserves approximately 96–112 px within content overlays.
- Main admin content width: up to Tailwind `max-w-6xl`; settings narrow to `max-w-2xl`, `max-w-3xl`, or `max-w-5xl` according to task.

### 4.5 Shape language

- Standard controls and form fields: 12 px radius.
- Cards, tables, category tiles, dialogs: 16 px radius.
- Detail sheet top radius: 24 px.
- Entry logo tile: 24 px radius.
- Statuses and filter chips: full pill where the role benefits from compact selection/status.
- Customer device frame: 36 px internal radius; Admin preview shells use approximately 31–44 px radii and 9–10 px dark bezels.
- Food thumbnails: 8 px radius.

The system avoids pills as a default container. They are reserved for category filters, prices, status badges, and selected compact controls.

### 4.6 Elevation and shadows

The Admin is mostly flat, using tonal separation and 1 px borders. Elevation appears when an object is transient or physically above another surface:

- Customer frame: large ambient shadow (`0 40px 80px -30px rgba(24,23,22,.45)`).
- Primary Customer CTA: colored ambient shadow tied to the accent.
- Logo tiles: compact ambient shadow.
- Drawer: left-cast shadow plus subtle ring.
- Dialog: strong `shadow-2xl` over a 45% ink backdrop.
- Toast: `0 12px 30px -12px rgba(24,23,22,.35)`.
- Dragged row: `0 16px 34px -14px rgba(24,23,22,.45)` and 90% opacity.

Persistent cards do not float. Borders and warm surface contrast carry the hierarchy at rest.

### 4.7 Iconography and imagery

- Icons use Lucide React with strokes around 1.7–2.2 depending on state.
- Active navigation slightly increases stroke weight.
- Photography is high-crop, full-bleed, and `object-cover`.
- Image failure uses a warm branded placeholder with a utensil icon and “Imagem indisponível”; no broken-image browser icon is exposed.
- Dietary/allergen communication combines a glyph and text, never color alone.

## 5. Customer information architecture and screens

### 5.1 Prototype shell

The reference has a bottom-center `Cliente / Admin / Indisponível` switcher. This is a review harness, not part of the product UI. On larger screens the Customer experience is centered in a 390 × 812 px device-like frame. Below the small-screen breakpoint it occupies the full viewport using `100dvh`.

### 5.2 Restaurant entry

Purpose: orient a visitor arriving from a QR link and provide one immediate path into discovery.

Composition:

- Cover photo occupies 46% of the frame.
- A gradient dissolves the cover into the cream background.
- A 96 × 96 px logo/monogram tile overlaps the transition.
- Open/closed status, restaurant name, uppercase tagline, description, location, and one coral CTA follow in centered alignment.
- Copy ends with a small swipe hint.

Interaction: `Explorar o menu` enters the feed. There is no splash sequence or onboarding carousel.

### 5.3 Vertical dish feed

This is the signature surface.

- Each item is exactly one feed viewport high and snaps at the start.
- The feed uses mandatory vertical snap and `scroll-snap-stop: always`.
- Photography fills the entire item.
- Top and bottom gradient scrims keep chips and text readable without opaque cards.
- Category, title, short description, price, “Ver detalhes”, and availability appear near the bottom.
- The first active item displays a bouncing double-chevron hint.
- “Indisponível hoje” is a subdued glass badge, not a disabled page.
- The overlay itself is the detail trigger.

Category changes preserve the same feed model, replace the dish set, reset scroll to the top, and fade the new feed in.

`Populares` is computed by view count in the mock and is not a persisted category in the Admin list.

### 5.4 Category chips

- Horizontally scrollable, hidden scrollbar, masked fade at the left/right edges.
- Selected chip: white background, accent-deep text, light shadow.
- Unselected chip: translucent white glass over photography, white text, hover increase in opacity.
- All chips are snap-aligned and use a 150 ms pressed scale transition.

### 5.5 Categories grid

- Cream scroll surface with a serif title and concise prompt.
- Two-column image grid, 4:5 tiles, 16 px corners.
- Bottom gradient plus white serif label on each tile.
- Selecting a category returns directly to the filtered feed and clearly selects its chip.
- The bottom navigation remains fixed while the grid scrolls underneath.

### 5.6 Dish detail sheet

- A bottom sheet remains visually connected to the feed.
- Maximum height is 88% of the viewport.
- The 224 px media header includes a drag handle, close button, and gallery indicators.
- Body order: category, dish name and price, full description, ingredients, dietary/allergen badges, and a full-width “Voltar ao menu” action.
- Close paths: close button, backdrop click, Escape, top-handle drag, or vertical gallery drag.
- There is no purchase CTA.

### 5.7 Horizontal media gallery

Intended behavior:

- Pointer direction locks after an 8 px dominance threshold.
- Horizontal movement controls image paging; vertical movement can be forwarded to sheet dismissal.
- A move advances at 50 px displacement or 0.3 px/ms velocity.
- Edge dragging is rubber-banded to 25% displacement.
- Snap animation uses 280 ms with `cubic-bezier(.25,.46,.45,.94)`.
- Active pagination grows from a 5 px dot to an 18 px pill.

Observed defect: the sliding strip is `n × 100%` wide, but its transform moves by `-100%` per index. CSS transform percentages are relative to the strip itself, so a swipe to the second image moves an entire multi-image strip and reveals an empty black region. This is captured in `customer-03-horizontal-gallery-second-image.png`. The next implementation should preserve the gesture model but correct the translation math or use native horizontal scroll-snap as the real frontend already does.

### 5.8 Restaurant information

- Cover image, overlapping brand tile, restaurant name, status, description.
- Opening hours in a simple divided list.
- Address and contact cards follow below.
- If all days are closed/unconfigured, a compact empty state appears.

Observed defect: the upper part of the overlapping logo tile renders behind the cover image, leaving only its lower section visible. The tile needs an explicit stacking position/z-index in implementation.

### 5.9 Public unavailable screen

A minimal branded 404/unavailable state uses the PRATTO mark, a short editorial heading, supporting text, and a quiet attribution. It avoids technical error codes and actions that cannot help the visitor.

### 5.10 Customer bottom navigation

- Three destinations: Menu, Categorias, Restaurante.
- Feed mode uses a black-to-transparent overlay and white active state.
- Non-feed screens use a cream translucent surface, border, and accent active state.
- Active icons increase stroke weight; labels move from medium to semibold.

## 6. Admin information architecture and screens

### 6.1 Shell and sidebar

The Admin is a full-height desktop workspace with a fixed left sidebar and independently scrollable main content.

Navigation hierarchy:

- Visão geral
- Cardápio
  - Pratos
  - Categorias
  - Prévia
- Restaurante
  - Informações
  - Horários
  - Aparência

Expanded sidebar width is 240 px. Collapsed width is 76 px. It auto-collapses below 1120 px and can always be toggled manually. Expanded mode shows restaurant identity, group headings, labels, and the “Recolher” action; collapsed mode keeps icons and native title tooltips.

### 6.2 Dashboard overview

- Header: 7-day eyebrow and serif “Visão geral”.
- Three metric cards: menu accesses, dish views, interactions/clicks, each with icon and positive delta.
- Five-column analytics band: a three-column area chart plus a two-column horizontal category chart.
- Ranked dishes card with thumbnail, numeric position, progress bar, views, and price.
- Loading skeleton preserves the same metric/chart/list geometry.
- A retry-capable error component exists, but the live screen hardcodes the failure flag to false and therefore does not expose this state through normal interaction.

Observed chart issue: Y-axis labels in the area chart are visibly clipped to repeated “00” text at both 1440 and 1024 px because of the negative left chart margin/axis layout. The visual style should be preserved, but chart margins must be corrected.

### 6.3 Dishes

- Header includes dish/category counts and one “Novo prato” CTA.
- Search filters live by name.
- Horizontally scrollable category filters use a dark selected chip and outlined neutral chips.
- A compact six-column table shows drag handle, image/name/summary, category, price, availability toggle, and edit action.
- Reordering is enabled only with no query and the “Todas” filter. Otherwise a concise explanation is shown.
- The no-dishes empty state provides a first-action CTA; no-search-results uses a smaller no-action state.
- Hover is a subtle sand tint.
- The active drag row elevates, gains a shadow, and retains 90% opacity while surrounding rows animate through dnd-kit transforms.

The runtime sequence changed the dish order through the real in-memory drag interaction, confirming that this is implemented rather than a decorative handle.

### 6.4 Create/edit dish drawer

- Right-side drawer, full viewport height, maximum width 520 px.
- Header and footer remain fixed while the body scrolls.
- Sections: Mídia, Informações básicas, Informações do menu, Ingredientes e dietas, Disponibilidade.
- Image upload supports empty, drag-over, preview, replace, remove, uploading, and FileReader failure states.
- Fields include name, short description, full description, price, category, ingredients, dietary/allergen tags, and availability.
- Ingredients become removable chips; dietary tags have selected and semantic preview states.
- Required errors are inline with icon, border, and message; invalid submit also raises a toast.
- Saving disables footer buttons and shows a spinner.

Important gaps:

- Remove-image confirmation requested by the embedded design brief is not implemented.
- A backdrop or Escape can still close the drawer while saving because only footer buttons are disabled.
- Server failure is not realistically simulated; only success and client validation are normally reachable.

### 6.5 Categories

- Header includes active count, description, and “Nova categoria”.
- Table columns: handle, category and description, dish count, status, actions.
- Status variants: active, inactive, archived. Archived rows are reduced to 55% opacity.
- Dnd-kit reordering is functional.
- Editing/creation uses the same drawer pattern with name, optional description, status, and position.
- Archive uses a destructive confirmation dialog and an informational toast.

The confirmation dialog is compact, centered, and uses a 45% ink backdrop. The destructive icon sits in an accent-tinted tile. Cancel is ghost-like; the destructive action uses the accent button.

### 6.6 Mobile preview

- A live `CustomerApp` instance is the source of truth inside a 380 × 780 px phone frame.
- External controls can select category, jump to a dish, and switch between Menu and Restaurante.
- The Customer interface is not duplicated outside the phone.
- At widths below `lg`, preview and controls stack vertically; at `lg`, they sit side by side.

The embedded brief calls for unpublished-change indication, but the rendered preview does not show one.

### 6.7 Restaurant information settings

- Narrow `max-w-3xl` form.
- Identity section includes square logo and 16:9 cover uploads.
- About section groups restaurant name, slogan, description, and address.
- Contact section groups Instagram, WhatsApp, and website.
- Save uses a loading state and success toast.

Only the name has runtime validation in the reference.

### 6.8 Opening hours

- Seven-row weekly editor inside one bordered surface.
- Each row has an open/closed toggle and weekday.
- Open days show two time inputs separated by “até”.
- Closed days receive a sand tint and replace inputs with a moon icon plus “Fechado”.
- At small widths, rows can wrap; at `sm` and above they remain a single line.
- Save state and toast feedback are implemented.

### 6.9 Appearance

- Two-column layout at `lg`: controlled customization on the left and a sticky live mobile preview on the right.
- Preset accent swatches use check marks and selection rings.
- Native color input and hex text input allow controlled custom color.
- Logo and cover are previewed but edited in Informações.
- Accent changes immediately affect category chips, primary buttons, active navigation, and small highlights through shared CSS variables.

This is intentionally not a page builder. Layout, type, neutral colors, and component structure remain fixed.

### 6.10 Publishing state

The store implements `published`, `unsaved`, `publishing`, and `failed` status types, keeps draft and published snapshots, simulates a publish delay, and exposes a publish action. No Admin component reads `publishStatus` or calls `publish`.

Therefore the rendered reference does not implement the requested sticky publication status bar, preview/publish actions, failure state, or unpublished-change marker. This is a material gap between the embedded design specification and the visible reference.

## 7. Reusable component system

### 7.1 Buttons

`Button` variants:

- Solid: accent background, white text, colored ambient shadow.
- Soft: sand background, ink text.
- Ghost: transparent with black 5% hover.
- Outline: hairline border with stronger hover border.

Sizes are 36 px (`sm`) and 44 px (`md`). All use 12 px corners, 150 ms transitions, pressed scale `0.98`, disabled opacity 40%, and accent focus ring.

`IconButton` is 40 × 40 px, circular, and presses to 95% scale.

### 7.2 Forms

- Shared 44 px controls with 12 px corners.
- Cream background and line border.
- Accent/25 focus ring and stronger focus border.
- Error switches border to accent and adds an icon + 13 px message.
- Labels are 13 px medium; required marker is accent-deep.
- Hints are 13 px faint ink.
- Textarea uses the same surface and a relaxed line-height.
- Select uses a custom inline chevron asset.
- Toggle is 44 × 24 px; thumb is 20 px. Herb means on, sand-deep means off.

### 7.3 Feedback

- Skeleton: warm sand shimmer, 1.4 s ease-in-out, layout-preserving.
- Empty state: 48 px icon tile, compact or regular spacing, concise action-oriented copy.
- Error state: warning tile, short message, optional “Tentar novamente”. A dark variant exists.
- Toast: success, error, warning, info; compact cream card; auto-dismiss after 3.6 s; manual close.
- Food image: loading skeleton, opacity reveal over 500 ms, branded error placeholder.

Observed toast issue: identical validation toasts can stack because no deduplication is applied. The capture sequence produced two simultaneous “Verifique os campos destacados” toasts.

### 7.4 Overlays

- Drawer: 300 ms slide from the right, backdrop fade, fixed header/footer, Escape and backdrop close.
- Confirmation dialog: centered compact card, Escape and backdrop cancel, 200 ms toast-style entrance.
- Customer detail sheet: 300 ms bottom transform with gesture-driven position and progressive backdrop opacity.

The overlays set dialog roles and `aria-modal`, but do not implement focus trapping, initial focus, return focus, or background inertness. These must be added during production integration.

### 7.5 Drag and drop

- Pointer activation distance: 5 px.
- Keyboard sensor and sortable keyboard coordinates are included.
- Handle alone is draggable; the row remains interactive.
- Cursor changes from grab to grabbing.
- Active row receives z-index, shadow, and slight opacity change.

### 7.6 Status and content primitives

- `StatusBadge`: open/closed dot plus text.
- `DietaryBadge`: glyph plus text and semantic border/text treatment.
- `SectionLabel`: recurring uppercase eyebrow.
- Category chips, metric cards, ranked rows, phone preview, and dish overlay are signature composite patterns and should become reusable production components rather than page-local copies.

## 8. Motion and microinteractions

### 8.1 Feed motion

Feed motion is scroll-driven, not slideshow-driven.

- Current image reaches scale 1.06 and moves toward 1.00 as it leaves the center.
- Text opacity falls according to distance from viewport center.
- Text translates by up to approximately 14 px with scroll direction.
- An IntersectionObserver at 60% tracks the active item.
- CSS scroll snap performs the primary physical transition.

The subtle scale direction in code means the centered image is slightly enlarged rather than exactly 1.0 as described by the embedded specification. The implementation should be treated as the rendered visual reference, while the scale can be normalized later if motion QA confirms that the spec's “current at full scale” feels better.

### 8.2 Category transitions

Changing dish sets mounts a 280 ms fade/6 px upward entrance. Moving from the category grid to a filtered feed is immediate but visually continuous because the selected chip and same full-frame shell are preserved.

### 8.3 Sheet gesture

- Sheet follows downward pointer movement exactly.
- Dismiss threshold is 130 px.
- Backdrop opacity decreases linearly over 420 px of drag.
- Failed dismissal snaps to zero using the standard 300 ms sheet transition.

### 8.4 Buttons, toggles, images, and feedback

- Buttons: 150 ms hover/pressed feedback.
- Toggle: 200 ms color and thumb transform.
- Food images: 500 ms opacity reveal.
- Category grid images: 500 ms hover scale to 1.05.
- Toast: 220 ms fade/translate/scale entrance.
- Skeleton: 1.4 s shimmer.
- Saving/upload: compact spinners and explicit verb changes.

### 8.5 Reduced motion

Global CSS forces animations and transitions to 0.01 ms. Feed motion also checks `prefers-reduced-motion` and disables its scale/fade/translation variables.

Coverage is partial: the preview's external jump still calls smooth scrolling directly, and scroll-smooth category behavior is not conditionally disabled in component logic. Production should centralize a reduced-motion-aware scroll helper.

## 9. Responsive behavior

### 9.1 Customer

- Mobile is the native layout, designed around 390 px.
- Under the small breakpoint, the app fills width and `100dvh`, with no device-frame rounding or outer padding.
- At `sm` and above, it becomes a fixed 390 × 812 px centered frame with 36 px corners, ring, and shadow.
- Customer content itself does not become a tablet/desktop multi-column layout; the mobile menu remains a mobile object.
- Bottom navigation and category chips remain touch-oriented and horizontally safe.

### 9.2 Admin

- Desktop-first, never redesigned as a mobile app.
- Sidebar collapses automatically below 1120 px.
- Metrics: one column by default, two at `sm`, three at `lg`.
- Charts: one column below `lg`; five-column split at `lg`.
- Preview: stacked below `lg`, side-by-side at `lg`.
- Appearance: one column below `lg`, `1fr + 400 px` at `lg`.
- Settings form subgrids generally move from one column to two/three at `sm`.
- Hours rows wrap below `sm`.

The 1024 px dashboard remains usable with the collapsed 76 px sidebar and three metric cards. The current fixed-grid dish/category tables do not have an explicit horizontal overflow wrapper, so widths near or below 1024 px require careful production testing. The 1280 px dishes capture is usable, but the category-filter row consumes substantial horizontal space.

## 10. Important state coverage

| State | Implemented and reachable | Notes |
| --- | --- | --- |
| Customer entry loading | Yes | Warm layout-preserving skeleton |
| Customer feed loading | Yes | Full image, chips, and overlay skeleton |
| Image loading/failure | Yes | Generic `FoodImage` behavior |
| Category with no dishes | Yes in component | Requires empty data to reach |
| Restaurant hours empty | Yes in component | Requires all days closed |
| Public unavailable | Yes | Dedicated harness view |
| Customer general/network error | Component exists, not wired to CustomerApp | No reachable retry state in mock flow |
| Detail loading | No distinct state | Sheet uses already-loaded mock data |
| Dashboard loading | Yes | Reachable on mount |
| Dashboard error | Component exists, intentionally unreachable | `failed` is hardcoded false |
| Dishes loading | Yes | Reachable on view mount |
| Dishes empty | Yes in component | Not reachable from seeded UI without deleting data |
| Search empty | Yes | Reachable and captured |
| Categories loading | Yes | Reachable on view mount |
| Categories empty | Yes in component | Not reachable from seeded UI |
| Form validation | Yes | Inline + toast |
| Form saving/success | Yes | Simulated delays and toast |
| Backend save failure | No realistic path | Mock store cannot fail |
| Upload empty/uploading/failure | Yes in component | Failure only on FileReader error |
| Confirmation | Yes | Category archive |
| Dragging | Yes | Dishes/categories |
| Publication states | Store only | No rendered UI |
| Unpublished preview | No | Required by embedded brief but absent |

## 11. Screenshot inventory

All screenshots are stored in `design-reference/screenshots/`.

### Customer

- `customer-00-entry-loading.png`
- `customer-01-restaurant-entry.png`
- `customer-02-dish-feed.png`
- `customer-03-horizontal-gallery-second-image.png` — captures the gallery translation defect.
- `customer-04-dish-feed-second-item.png`
- `customer-05-dish-detail-sheet.png`
- `customer-06-categories-grid.png`
- `customer-07-filtered-feed.png`
- `customer-08-restaurant-info.png`
- `customer-09-unavailable.png`

### Admin

- `admin-00-dashboard-loading.png`
- `admin-01-dashboard-overview-1440.png`
- `admin-02-dishes-loading.png`
- `admin-03-dishes-table.png`
- `admin-04-dishes-dragging.png`
- `admin-05-dishes-empty-search.png`
- `admin-06-new-dish-drawer.png`
- `admin-07-dish-validation-errors.png`
- `admin-08-categories-loading.png`
- `admin-09-categories-table.png`
- `admin-10-new-category-drawer.png`
- `admin-11-category-validation-error.png`
- `admin-12-archive-confirmation-dialog.png`
- `admin-13-mobile-preview.png`
- `admin-14-restaurant-information-settings.png`
- `admin-15-opening-hours.png`
- `admin-16-hours-saving.png`
- `admin-17-success-toast.png`
- `admin-18-appearance-live-preview.png`
- `admin-19-dashboard-responsive-1024.png`
- `admin-20-dishes-responsive-1280.png`

## 12. Differences from the current PRATTO frontend

### 12.1 Architecture and data flow

Reference:

- React/Vite/Tailwind 4 prototype.
- One in-memory context store with mock data and simulated delays.
- No routing, authentication, organization context, HTTP, SSR, persistent errors, or backend authorization.
- Draft/published snapshots are local objects.

Current application:

- Next.js App Router with real routes and middleware.
- TanStack Query for server state; React Hook Form and Zod for forms.
- Auth boundary, organization context, establishment scope, real REST APIs, stable errors, and persisted state.
- Explicit editable-menu selection is required before categories, products, media, or publication operations.
- Publication is idempotent and versioned; historical snapshots are immutable.
- Public menu supports SSR initial data, canonical slug correction, infinite pagination, analytics thresholds, images and video, and server/client error paths.

The next phase must keep all current architecture and behavior. The reference's provider, mock entities, timers, and numeric price handling must not be migrated.

### 12.2 Global visual system

Current frontend uses a dark slate/emerald Tailwind presentation, Arial/Helvetica, mostly inline page-local classes, stacked sections, and generic cards. The reference replaces this visual world with cream/sand/ink/paprika/herb, Instrument Sans/Serif, restrained editorial hierarchy, food imagery, thinner borders, and contextual shadows.

The existing global focus treatment and reduced-motion handling are functional assets to preserve conceptually, but they should be expressed with the reference tokens.

### 12.3 Customer experience

What the current public menu already preserves and should continue to own:

- Real published contract data and canonical URLs.
- Full-viewport vertical snap feed.
- Category filtering with reset to top.
- Infinite pagination and per-page failures.
- Analytics lifecycle, impressions, qualified views, and interactions.
- Image/video media, autoplay/mute behavior, and media-change analytics.
- Light/dark restaurant theme modes.
- Public loading, empty, not-found/unavailable, and retry states.
- Accessible feed semantics and details dialog.

What should be replaced visually/UX-wise from the current frontend:

- Dark/slate header, generic bold sans hierarchy, and opaque lower content surface.
- Current feed card typography and spacing.
- Current category chip visuals.
- Current details modal presentation.
- Generic public loading/error/empty presentation.

What should be added/adapted from the reference:

- Restaurant entry screen.
- Warm editorial system and Instrument font pair.
- Minimal gradient scrims with serif dish titles.
- Customer bottom navigation and category grid.
- Restaurant information destination.
- Drag-enabled bottom sheet visual model.
- Branded food-image fallback.
- Reference price/status/dietary presentation, mapped to real fields.

The current native horizontal scroll-snap gallery is more robust than the reference's broken transform implementation and should be retained internally while adopting the reference's dots and gesture styling.

### 12.4 Admin experience

The current Admin is one long page that stacks analytics, establishment settings, categories, products, media, and publication. It is functionally rich but visually dense and difficult to scan.

The reference should replace the page composition with:

- Fixed grouped sidebar.
- Separate task views.
- Reference headings, tables, drawers, filters, previews, feedback, and warm surfaces.
- Collapsed sidebar behavior at small-laptop widths.

The following real functions must be preserved and adapted, not removed:

- Auth/logout and organization/establishment context.
- Explicit menu targeting; never auto-select the first editable menu.
- Categories: status transitions, archive semantics, order, `archivedAt`, errors.
- Products: DECIMAL strings, promotional price, availability states, featured flag, archive/status/order.
- Media: upload, image/video type, primary selection, order, removal, real errors.
- Publication: idempotency key, active version, history, immutable snapshots, QR/link sharing.
- Analytics: period/category/product filters, five real metrics, daily series, and both rankings.
- Establishment: slug, phone, WhatsApp, structured address, operating hours, theme mode, primary color, logo, cover.

## 13. Contract mismatches requiring adaptation

These differences cannot be solved by copying reference types:

| Reference model | Real PRATTO contract | Implementation consequence |
| --- | --- | --- |
| `price: number` | Decimal string | Keep string parsing/validation end-to-end; format for display only |
| `available: boolean` | `AVAILABLE`, `TEMPORARILY_UNAVAILABLE`, `HIDDEN` plus product active/inactive | Reference toggle alone is insufficient; retain complete state controls |
| `short` and `description` | One `description` field | Exact overlay/detail copy split needs a product/contract decision; do not silently add a client-only field |
| Dietary tag array | `allergens` and `ingredients` strings | Badge derivation needs an explicit supported vocabulary or conservative text display |
| `image` + URL array | Ordered media objects with IMAGE/VIDEO and primary flag | Render real media and preserve media management semantics |
| Numeric mock views/clicks | Real analytics summary, filters, daily series, rankings | Restyle without reducing metric coverage |
| Category status includes `archived` | ACTIVE/INACTIVE plus `archivedAt` | Map archived appearance from `archivedAt`, not a fabricated status enum |
| Tagline, Instagram, website | Not present in current establishment contract | Do not persist unsupported fields; resolve scope before adding backend fields |
| Single string address | Structured address | Keep structured form and compose display text |
| Accent + computed deep accent | Theme mode + primary color | Derive darker UI tone client-side; preserve LIGHT/DARK mode |
| Local published snapshot | Real versioned immutable publication | Use current publication endpoints/history/idempotency |
| No menu selector | Explicit `menuId` required | Integrate a visible menu context selector into the reference Admin shell/screens |

## 14. Reuse, replace, and adapt map

### Reuse from the reference

- CSS token values and semantic roles.
- Instrument Sans/Serif pairing and hierarchy.
- Customer entry, feed composition, category chips/grid, bottom nav, detail sheet appearance, restaurant info, and unavailable screen.
- Admin sidebar, task-based IA, card/table/drawer/dialog/form styling, appearance preview, and responsive collapse.
- Warm skeleton, branded image error, empty/error/toast patterns.
- Dnd-kit visual behavior and keyboard-capable handle pattern.
- Motion durations and restrained interaction character.

### Preserve from the current frontend

- Next.js routing/SSR/middleware.
- Authentication, organization selection, session-derived tenant context, authorization, and logout.
- API clients, TanStack Query cache/invalidation, React Hook Form/Zod, and stable error mapping.
- Every real contract field and status.
- Explicit menu target selection.
- Media storage/upload contract and video support.
- Versioned publication, idempotency, history, public URL, QR/share.
- Analytics event capture, filtering, and semantics.
- Accessibility semantics already present in the public feed.
- Current tests as behavioral guardrails.

### Replace in the current frontend

- Slate/emerald visual identity and Arial typography.
- Single long Admin page and repeated generic card styling.
- Page-local visual primitives that duplicate buttons, inputs, notices, states, and panels.
- Current public feed/header/details visual composition.
- Generic loading/empty/error styling.

### Adapt rather than copy

- Reference mock forms to real schemas and API errors.
- Reference availability toggle to full real availability/status semantics.
- Reference image uploader to real media upload, primary media, video, ordering, and removal.
- Reference dashboard charts to the real filtered analytics dataset.
- Reference publication concept to the current explicit, idempotent, historical flow.
- Reference appearance screen to real LIGHT/DARK theme plus primary color.
- Reference restaurant information fields to the real structured contract.
- Reference phone preview to the real public-menu renderer or a shared presentation layer, avoiding a second mock implementation.
- Reference gallery visuals to the current native scroll-snap implementation.

## 15. Implementation risks and important observations

### Critical integration risks

1. **Mock-to-contract drift.** Copying `PrattoProvider`, numeric prices, boolean availability, or mock category IDs would violate real contracts and tenant-safe API flow.
2. **Implicit menu selection.** The reference has one local menu and no selector. Production must continue to require explicit `menuId` and visibly preserve that context across Admin views.
3. **Duplicate Customer renderers.** Admin preview and public menu should share the production presentation layer. Reimplementing a separate mock `CustomerApp` would drift immediately.
4. **Publication semantics.** The reference's local publish method cannot replace idempotency, immutable versions, history, public activation, QR, or share behavior.
5. **Analytics loss.** The reference dashboard is visually useful but semantically smaller than the real dashboard. Restyling must not discard filters or real metrics.
6. **Media regression.** Reference forms assume one image while the real product supports ordered image/video media. The UI must retain the richer model.

### Reference defects to correct during translation

1. Horizontal gallery transform exposes an empty black page after the first swipe.
2. Restaurant information logo overlaps behind the cover because of stacking order.
3. Dashboard Y-axis labels are clipped.
4. Publication status UI is absent despite store support and specification.
5. Unpublished-change indication is absent from mobile preview.
6. General Customer errors and Admin dashboard error are not reachable in normal prototype use.
7. Duplicate toasts can stack.
8. Drawers/dialogs lack production focus management and background inertness.
9. Drawer backdrop/Escape can close while a simulated save is active.
10. Image removal lacks the specified confirmation.
11. Reduced-motion handling does not cover every programmatic smooth scroll.
12. Fixed admin table grids need overflow/column-priority behavior at narrower widths.

### Accessibility observations

Strengths:

- Visible focus styles on core primitives.
- Icon + text status semantics.
- Comfortable 40–44 px core controls.
- Gradient protection for text on images.
- Escape/backdrop close paths.
- Keyboard sensor for sorting.
- Global reduced-motion rule.

Production requirements still missing:

- Focus trap, initial focus, return focus, and inert background for modal surfaces.
- Explicit accessible names on icon-only actions where the reference relies on `title` or visual context.
- Automated contrast confirmation for accent-deep text and translucent overlay states across custom colors.
- Robust screen-reader announcements for sorting, upload progress, saving, publication, and toast deduplication.
- Safe custom accent validation so restaurant-selected colors cannot make text/focus states unreadable.

## 16. Implementation guardrails for the next phase

- Treat rendered reference screenshots and tokens as the appearance target, not the reference's data/store architecture.
- Build shared production primitives first: tokens/fonts, buttons, fields, feedback, overlays, navigation, media, and responsive containers.
- Keep feature ownership in current folders and query/API layers; visual components should consume typed real data.
- Preserve explicit `menuId` selection and session-derived organization/establishment authorization in every Admin mutation.
- Preserve DECIMAL price strings and immutable publication history.
- Preserve image and video media, primary media, order, and real upload errors.
- Preserve all current loading, empty, error, retry, and analytics paths, then restyle them to the reference.
- Do not introduce cart/order functionality or unrelated modules.
- Correct the documented reference defects instead of reproducing them.
- Validate the Customer journey at real mobile sizes and the Admin at 1440, 1280, and 1024 px, including keyboard and reduced-motion passes.

## 17. Source files reviewed

Reference visual and UX sources:

- `design-reference/src/index.css`
- `design-reference/src/App.tsx`
- `design-reference/src/store/PrattoProvider.tsx`
- `design-reference/src/data/menu.ts`
- `design-reference/src/customer/*`
- `design-reference/src/admin/*`
- `design-reference/src/components/*`
- `design-reference/src/imports/pasted_text/pratto-ui-ux-concept.md`
- `design-reference/src/imports/pasted_text/pratto-design-spec.md`
- `design-reference/PRATTO-FEATURES.md`

Current application sources used for the comparison:

- `apps/web/app/globals.css`
- `apps/web/features/admin/admin-page.tsx`
- `apps/web/features/public-menu/public-menu-screen.tsx`
- `apps/web/features/catalog/category-management.tsx`
- `apps/web/features/catalog/product-management.tsx`
- `apps/web/features/catalog/product-media-management.tsx`
- `apps/web/features/catalog/publication-management.tsx`
- `apps/web/features/establishments/settings-form.tsx`
- `apps/web/features/analytics/analytics-dashboard.tsx`
- `packages/contracts/src/public-menu.ts`
- `packages/contracts/src/catalog.ts`
- `packages/contracts/src/establishment.ts`
- `packages/contracts/src/publication.ts`
