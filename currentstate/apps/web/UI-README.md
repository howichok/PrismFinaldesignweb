# PrismMTR UI Design System

This document describes the design tokens, component usage, and motion rules for the PrismMTR web application.

## Design Tokens

### Colors

The design uses CSS custom properties with HSL values for theming:

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `0 0% 100%` | `240 10% 4%` | Page background |
| `--foreground` | `240 10% 4%` | `0 0% 98%` | Primary text |
| `--muted` | `240 5% 96%` | `240 4% 16%` | Secondary surfaces |
| `--primary` | `235 86% 65%` | same | Buttons, links |
| `--destructive` | `0 84% 60%` | `0 62% 50%` | Error states |
| `--success` | `142 76% 36%` | `142 70% 45%` | Success states |
| `--warning` | `38 92% 50%` | same | Warning states |

### Prism Gradient (accent)

Used sparingly for brand accents:
```css
.prism-gradient {
  background: linear-gradient(135deg, violet-500, blue-500, cyan-500);
}
```

### Typography

- Font: Inter (via Google Fonts)
- Scale: Tailwind default (sm: 14px, base: 16px, lg: 18px, 2xl: 24px)

### Radius

- `--radius: 0.5rem` (8px)
- Cards, buttons, badges use `rounded-lg` (--radius)

---

## Component Usage

### Button

```tsx
import { Button } from "@/components/ui/button";

<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
```

### Badge / StatusBadge

```tsx
import { Badge, StatusBadge } from "@/components/ui/badge";

<Badge variant="default">Label</Badge>
<StatusBadge status="PUBLISHED" />
<StatusBadge status="PENDING" />
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

<Card interactive> {/* Adds hover effects */}
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### PageHeader

```tsx
import { PageHeader, PageTabs } from "@/components/app-shell";

<PageHeader title="Projects" subtitle="Manage your projects">
  <Button>New Project</Button>
</PageHeader>
```

### Empty State

```tsx
import { EmptyState } from "@/components/shared";

<EmptyState
  icon={<FolderIcon className="h-12 w-12" />}
  title="No projects"
  description="Create your first project"
  action={{ label: "Create", onClick: () => {} }}
/>
```

---

## Motion Rules

### Timing Budget
| Type | Duration | Easing |
|------|----------|--------|
| Micro (hover, focus) | 120-180ms | ease-out |
| Panels (drawer, modal) | 180-240ms | ease-in-out |
| Page transitions | 200-300ms | ease-out |

### Reduced Motion

All animations respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## File Structure

```
components/
├── ui/              # Base shadcn/ui components
│   ├── button.tsx
│   ├── badge.tsx
│   └── card.tsx
├── app-shell/       # Layout components
│   ├── Sidebar.tsx
│   ├── TopBar.tsx
│   ├── PageHeader.tsx
│   └── NotificationDrawer.tsx
└── shared/          # Reusable patterns
    ├── EmptyState.tsx
    └── LoadingSkeleton.tsx
```
