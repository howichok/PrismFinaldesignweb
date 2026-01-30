# Исправление белых фликов в тёмной теме

## ВАЖНО: Политика без localStorage

**Мы НЕ используем localStorage/sessionStorage/IndexedDB для хранения настроек темы.**

Вместо этого используем системные настройки пользователя через `prefers-color-scheme`.

## Причины проблемы

1. **CSS загружается раньше JS** → страница рендерится в светлой теме
2. **JS проверяет системные настройки** → добавляет `dark-mode` класс
3. **Перерисовка** → визуальный "флик" белого фона

## Решение: Blocking Script в `<head>` с prefers-color-scheme

### Шаг 1: Добавить inline-скрипт в `<head>` ПЕРЕД CSS

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">

  <!-- КРИТИЧНО: Этот скрипт ДОЛЖЕН быть ДО любых CSS файлов -->
  <script>
    // Синхронный скрипт - блокирует рендеринг, но выполняется мгновенно
    // Использует СИСТЕМНЫЕ настройки пользователя, НЕ localStorage
    (function() {
      try {
        var darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (darkMode) {
          document.documentElement.classList.add('dark-mode');
          document.documentElement.style.colorScheme = 'dark';
        }
      } catch(e) {}
    })();
  </script>

  <!-- CSS загружается ПОСЛЕ установки класса -->
  <link rel="stylesheet" href="css/main.css">
  ...
</head>
```

### Шаг 2: CSS должен применять тему к `html`, не только `body`

```css
/* main.css - В САМОМ НАЧАЛЕ файла */

/* Базовые цвета - светлая тема по умолчанию */
:root {
  --color-bg: #ffffff;
  --color-text: #0a0a0a;
  --color-surface: #ffffff;
}

/* Тёмная тема - применяется к html */
html.dark-mode {
  --color-bg: #0a0a0a;
  --color-text: #fafafa;
  --color-surface: #141414;
}

/* Или используйте @media напрямую для автоматической темы */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0a0a0a;
    --color-text: #fafafa;
    --color-surface: #141414;
  }
}

/* Фон html и body */
html {
  background-color: var(--color-bg);
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
}
```

### Шаг 3: Предотвратить FOUC (Flash of Unstyled Content)

```html
<head>
  <script>
    // Использует prefers-color-scheme вместо localStorage
    (function() {
      try {
        var darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (darkMode) {
          document.documentElement.classList.add('dark-mode');
          document.documentElement.style.colorScheme = 'dark';
        }
      } catch(e) {}
    })();
  </script>

  <!-- Скрыть body до полной загрузки (опционально) -->
  <style>
    body { opacity: 0; }
    body.loaded { opacity: 1; transition: opacity 0.1s; }
  </style>
</head>
<body>
  ...
  <script>document.body.classList.add('loaded');</script>
</body>
```

## Для Next.js / React

### Вариант A: next/script с `beforeInteractive`

```tsx
// app/layout.tsx или pages/_document.tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (darkMode) {
                    document.documentElement.classList.add('dark-mode');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Вариант B: _document.tsx (Pages Router)

```tsx
// pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html suppressHydrationWarning>
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var d = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (d) document.documentElement.classList.add('dark-mode');
                } catch(e) {}
              })();
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

### Вариант C: С Tailwind CSS

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-white dark:bg-gray-950 transition-colors">
        {children}
      </body>
    </html>
  );
}
```

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class', // Важно: использовать class, не media
  // ...
}
```

## Для переходов между страницами (SPA)

```css
/* Добавить transition для плавности */
html {
  background-color: var(--color-bg);
  /* Не анимировать при первой загрузке */
}

html.transitions-enabled {
  transition: background-color 0.2s ease;
}

body {
  background-color: var(--color-bg);
}

html.transitions-enabled body {
  transition: background-color 0.2s ease, color 0.2s ease;
}
```

```js
// Включить transitions после первой загрузки
window.addEventListener('load', () => {
  requestAnimationFrame(() => {
    document.documentElement.classList.add('transitions-enabled');
  });
});
```

## Чеклист

- [ ] Inline script в `<head>` ПЕРЕД CSS
- [ ] CSS переменные на `html.dark-mode`, не только `body`
- [ ] `background-color` на `html` элементе
- [ ] `suppressHydrationWarning` на `<html>` в Next.js
- [ ] Tailwind: `darkMode: 'class'`
- [ ] Transitions включать ПОСЛЕ первой загрузки
