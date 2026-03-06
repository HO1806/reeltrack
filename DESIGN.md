# ReelTrack Design System & UI/UX Guidelines

This document serves as the single source of truth for ReelTrack's design system, theme, layout, and UI/UX patterns. Any future modifications to the user interface must respect these principles to maintain consistency and brand identity.

## 1. Core Visual Identity

ReelTrack features a premium, cinematic "dark mode" aesthetic. The design relies heavily on deep, spatial backgrounds, glowing accents, and glassmorphism (translucency + background blur) to create depth and hierarchy.

### 1.1 Colors

**Base Palette:**

- **Background:** `#05050a` (Deep Space / Super Black)
- **Card:** `#0c0c16` (Dark Blue-Grey)
- **Elevated:** `#12121e` (Lighter Blue-Grey)

**Accents:**

- **Primary Accent / Glow:** `#f5c518` (Cinematic Gold / IMDb Yellow)
- **Accent Dim:** `#b38f0d`

**Text Colors:**

- **Primary:** `#f8f8f8` (Off-white, 97% opacity)
- **Secondary:** `#a0a0b0` (Cool Grey)
- **Muted:** `#8b8b9c` (Darker Grey)

**Status Colors:**

- **Success / Green:** `#4ade80`
- **Info / Blue:** `#60a5fa`
- **Danger / Red:** `#f87171`
- **Purple:** `#c084fc`

### 1.2 Translucency & Glassmorphism (Semantic Tokens)

Used extensively for overlays, panels, and borders to create depth without heavy solid colors.

- **Surface Base:** `rgba(255, 255, 255, 0.02)`
- **Surface Elevated:** `rgba(255, 255, 255, 0.03)`
- **Surface Active:** `rgba(255, 255, 255, 0.05)`
- **Surface Hover:** `rgba(255, 255, 255, 0.08)`
- **Surface Highlight:** `rgba(255, 255, 255, 0.12)`

**Borders:**

- **Subtle:** `rgba(255, 255, 255, 0.05)`
- **Default:** `rgba(255, 255, 255, 0.12)`
- **Hover:** `rgba(255, 255, 255, 0.20)`

### 1.3 Typography

- **Headings / Numbers (`--font-bebas`):** `Bebas Neue` - Used for titles, scores, and prominent stylistic numbers. Usually applied with `tracking-[0.05em]`.
- **Primary Body (`--font-sans`):** `DM Sans` - Standard readable font for most UI components and descriptions.
- **Serif (`--font-crimson`):** `Crimson Pro` - Occasional use for stylistic quotes or classic cinematic text elements.

---

## 2. Global Layout & Structure

- **Background Setup:** The `<body>` has a complex background composed of a radial gradient, a subtle grid pattern, and an SVG noise filter (`fractalNoise`). This texture must not be overridden.
- **Layout Container (`main`):** Uses Flexbox (`flex-1 flex flex-col`) to fill the viewport height.
- **Max Widths:**
  - Content Max: `1600px`
  - Filter Max: `1000px`

### Global Components

1. **Navbar:** Fixed at the top, includes search, navigation links, and settings access.
2. **FilterBar:** Sticky or below the navbar, contains multi-faceted filtering options.
3. **LibraryGrid / Content:** The main display area using standard CSS grids or flex wrappings.

---

## 3. Reusable UI Components (CSS Classes)

Whenever implementing new UI, always use these utility classes configured in `index.css` to guarantee consistency:

- `.glass-panel`: Standard container. Background `surface-elevated` + `backdrop-blur-2xl` + premium shadow.
- `.glass-panel-elevated`: Foreground containers (modals, popups).
- `.glass-cockpit`: Heavy glassmorphic effect used for high-tech or overlaid panels (e.g., stats).
- `.stat-card`: Used for data metrics. Flex row, padding, rounded corners, hover border transitions.
- `.input-field`: Standardized text input styling with inner shadow, border, and gold focus rings.
- `.btn-primary`: Action buttons. Round (`rounded-full`), gold background, black text, with a glow shadow.
- `.btn-secondary`: Secondary action buttons. Translucent background, white text, subtle hover highlight.
- `.pill-badge`: Small UI chips. `surface-active` background, uppercase, wide tracking.
- `.score-badge`: Used for displaying movie/show ratings. `Bebas Neue` font, gold background, custom inset shadow.
- `.section-title`: Small headers with wide tracking, uppercase text, and gold accent color.
- `.section-divider`: Gradient 1px horizontal line from gold to transparent for section breaks.

---

## 4. Animation & Motion Design

ReelTrack uses a combination of custom CSS keyframes and `framer-motion` for fluid, premium interactions. Always respect `prefers-reduced-motion`.

**Custom CSS Tailwind Animations:**

- `.animate-cinematic`: Dramatic fade-in, scale-up, and blur reduction (0.8s). Used for initial page or large modal loads.
- `.animate-glow`: Pulsing gold drop-shadow. Used for active or highlighted elements.
- `.animate-shimmer`: Loading states or premium highlights.
- `.animate-fade-slide-up`: Modals and dropdowns appearing.
- `.animate-breathe`: Subtle slow scaling (1 -> 1.02 -> 1) over 4s.
- `.card-hover`: Applied to grid items. Subtly lifts the element (`-translate-y-3`) and intensifies the shadow over 700ms on hover.

**Framer Motion (`motion/react`):**
Preferred for complex mount/unmount logic (e.g., `<AnimatePresence>`).
*Standard entrance pattern:*

```jsx
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
  {/* Content */}
</motion.div>
```

---

## 5. Development Guidelines for UI Changes

1. **Do not introduce new arbitrary hex colors** unless absolutely necessary. Stick to the semantic RGB alpha values (e.g., `bg-surface-active`) or theme definitions.
2. **Avoid standard Tailwind borders** (like `border-gray-500`). Use `border-border-default` or `border-border-subtle`.
3. **Icons:** Use the `lucide-react` library.
4. **Toasts/Notifications:** Use the built-in system instead of standard browser popups (`alert`/`confirm()`) whenever possible.
5. **Responsiveness:** Maintain standard Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`). Mobile interfaces should stack elements that sit horizontally on desktop, reducing glass blur sizes if performance dictates.

*Keep it dark, keep it cinematic, keep it snappy.*
