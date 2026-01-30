# PrismMTR - Инструкция по деплою на Netlify

## ⚠️ ВАЖНО: Drag & Drop НЕ деплоит Functions!

Когда вы перетаскиваете папку в Netlify Deploy, **serverless functions НЕ компилируются**.
Результат: логин падает с ошибками 404/500.

---

## ✅ РЕКОМЕНДУЕМЫЙ СПОСОБ: Netlify CLI

### Шаг 1: Установите Netlify CLI (один раз)
```bash
npm install -g netlify-cli
```

### Шаг 2: Авторизуйтесь (один раз)
```bash
netlify login
```

### Шаг 3: Свяжите проект с сайтом (один раз)
```bash
cd prismmtr-site
netlify link
# Выберите существующий сайт или создайте новый
```

### Шаг 4: Деплой в продакшен
```bash
netlify deploy --prod
```

Это **ЕДИНСТВЕННЫЙ** надёжный способ деплоя с Functions.

---

## 🔧 Настройка ENV переменных

После первого деплоя, в Netlify Dashboard → Site → Site configuration → Environment variables:

| Переменная | Описание |
|------------|----------|
| `JSONBIN_API_KEY` | Ключ от JSONBin.io |
| `USERS_BIN_ID` | ID бина с пользователями |
| `PROJECTS_BIN_ID` | ID бина с проектами |
| `NICKNAME_REQUESTS_BIN_ID` | ID бина с запросами никнеймов |
| `NOTIFICATIONS_BIN_ID` | ID бина с уведомлениями |
| `DISCORD_CLIENT_ID` | Discord OAuth Client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth Client Secret |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |

**После добавления переменных — редеплой:**
```bash
netlify deploy --prod
```

---

## 🩺 Проверка после деплоя

1. **Главная страница:**
   ```
   https://ваш-сайт.netlify.app/
   ```

2. **Health Check (Functions работают):**
   ```
   https://ваш-сайт.netlify.app/.netlify/functions/health
   ```
   Должен вернуть JSON с `"status": "ok"` и списком ENV переменных.

3. **Проверка ENV:**
   В health response проверьте:
   ```json
   {
     "environment": {
       "configured": true,
       "missing": []
     }
   }
   ```
   Если `missing` не пустой — добавьте недостающие переменные.

4. **Логин:**
   После того как все ENV настроены, попробуйте войти через Discord.

---

## 🔍 Отладка

### Логи функций
Netlify Dashboard → Site → Logs → Functions

### Частые проблемы

| Ошибка | Причина | Решение |
|--------|---------|---------|
| 404 на `/.netlify/functions/*` | Drag & Drop деплой | Используйте `netlify deploy --prod` |
| 500 Internal Server Error | Отсутствует ENV | Проверьте `/health` |
| `invalid_client` | Неверный Discord Client ID/Secret | Проверьте значения в Netlify ENV |
| `Invalid users data` | Неверный формат данных | Баг в коде (уже исправлен) |

---

## 📁 Структура проекта

```
prismmtr-site/
├── netlify.toml          # Конфигурация Netlify
├── _redirects            # Правила редиректов
├── netlify/
│   └── functions/        # Serverless Functions
│       ├── health.js     # Health check
│       ├── discord-oauth.js
│       ├── google-oauth.js
│       ├── jsonbin-proxy.js
│       └── admin-api.js
├── index.html
├── admin.html
├── projects.html
├── download.html
├── help.html
├── terms.html
├── css/
├── js/
└── assets/
```

---

## 🚀 Полный цикл деплоя

```bash
# 1. Перейти в папку проекта
cd prismmtr-site

# 2. Деплой
netlify deploy --prod

# 3. Открыть сайт
netlify open:site

# 4. Проверить health
curl https://prismmtr.org/.netlify/functions/health
```

После успешного health check — логин должен работать!
