# Stitch Design System DNA (AI AGENT SGK)

## 1. Visual Theme & Color Palette
- Theme: Immersive Stage / Educational Socratic Workspace
- Surface Dark: Slate-900 (`#0f172a`), Slate-800 (`#1e293b`), Slate-700 (`#334155`)
- Accent Primary: Sky-400/500 (`#38bdf8` / `#0ea5e9`) for Knowledge & Lesson flow
- Accent Quiz: Amber-400/500 (`#fbbf24` / `#f59e0b`) for Interactive Exercises
- Accent Socratic AI: Emerald-400/500 (`#34d399` / `#10b981`) for Teacher Assistant
- Text Contrast: Pure White (`#ffffff`) on Dark, Slate-200 (`#e2e8f0`) for body. WCAG AAA compliance (Contrast ratio >= 7:1).

## 2. Micro-Copy Rules (Design Taste)
- Minimalist actions: 1 Goal - 1 Action - Copy under 10 words.
  - Button Submit: "Nộp bài & Chấm điểm tức thì"
  - Input Placeholder: "Hỏi thầy bất kỳ thắc mắc nào..."
  - Warning Badge: "Chỉ gợi mở, không giải hộ"

## 3. Structural Constraints (Zero-Overflow Layout)
- Zero Horizontal Scroll: `scrollWidth === clientWidth` on all viewport widths (1920x1080 down to 375x667).
- Touch Target Minimum: >= 44px for all option labels and buttons.
- Layout: 3-column Socratic Stage (`h-[85vh]` on desktop, stacking on mobile).
