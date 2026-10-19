# Stitch Design System DNA - AI SGK Tin học THCS

## 1. Identity & Philosophy
- **Name**: Khan-Focus Educational Stage (Hình 2 Redesign)
- **Target Audience**: Secondary School Students (Grades 6-9, Ages 11-15) & Teachers in School LAN Computer Labs
- **Pedagogical Pedigree**: Socratic Method (No direct answers, guided inquiry), Low Cognitive Load, Non-punitive Remediation
- **Environment**: Offline-Ready School LAN (18 student PCs connected to teacher host, zero external internet reliance)

## 2. Color Palette & WCAG AAA Contrast (>= 7:1)
- **Surface**:
  - `bg-main`: `#F8FAFC` (Slate 50, warm paper)
  - `bg-surface`: `#FFFFFF` (Pure white)
  - `border-subtle`: `#E2E8F0` (Slate 200)
  - `border-focus`: `#1E40AF` (Deep Royal Blue)
- **Primary / Brand**:
  - `primary-dark`: `#1E40AF` (Blue 800 - WCAG AAA 8.7:1 with white text)
  - `primary-hover`: `#1D4ED8` (Blue 700)
  - `primary-light`: `#EFF6FF` (Blue 50)
- **Text & Contrast**:
  - `text-primary`: `#0F172A` (Slate 900 - WCAG AAA 17.5:1 with white)
  - `text-secondary`: `#475569` (Slate 600 - WCAG AAA 7.6:1 with white)
  - `text-white`: `#FFFFFF`
- **Remediation / Chưa đúng (Non-punitive Amber)**:
  - `amber-bg`: `#FFFBEB` (Amber 50)
  - `amber-border`: `#F59E0B` (Amber 500)
  - `amber-text`: `#78350F` (Amber 900 - WCAG AAA 11.4:1 contrast)
  - `amber-badge`: `#D97706` (Amber 600)
- **Success / Đúng (Encouraging Emerald)**:
  - `emerald-bg`: `#ECFDF5` (Emerald 50)
  - `emerald-border`: `#10B981` (Emerald 500)
  - `emerald-text`: `#065F46` (Emerald 900 - WCAG AAA 7.3:1 contrast)
  - `emerald-badge`: `#059669` (Emerald 600)

## 3. Typography & Sizing
- **Font Stack**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Zero-Dependency**: No external Google Fonts required on school LAN machines.
- **Hierarchy**:
  - Header Title: 18px (Font weight 700)
  - Question Title: 18px - 20px (Font weight 700, line-height 1.5)
  - Option Buttons: 16px (Font weight 600, min-height 52px)
  - Body / Explanation: 15px - 16px (line-height 1.6)
  - Metadata / Labels: 13px - 14px (Font weight 600)

## 4. Layout & School Screen Responsiveness
- **Target Resolution**: $1366 \times 768$ (Effective viewport height ~625px)
- **Left Roadmap Sidebar**: 240px - 260px fixed width, shows 4 pedagogical stages.
- **Center Focus Canvas**: Flexible width, single-question layout, zero vertical scroll trap within question block.
- **Right Socratic Drawer**: 360px collapsible drawer, closed by default on screens <= 1440px to eliminate distraction.
- **Touch / Click Target**: Min 48px - 56px per interactive element.
- **Accessibility**: Keyboard navigable (1-4, Enter, Tab), `:focus-visible` styling, ARIA radiogroup roles.
