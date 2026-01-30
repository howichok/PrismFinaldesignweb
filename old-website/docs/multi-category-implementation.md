# Мульти-выбор категорий

## Текущая ситуация

- Projects: 4 категории (building, station, line_section, line)
- Posts: 5 категорий (news, update, announcement, guide, showcase)
- Используется single-select (radio buttons)
- В БД хранится TEXT с CHECK constraint

## Архитектура для мульти-выбора

### Вариант 1: PostgreSQL ARRAY (рекомендуется)

```sql
-- Миграция: изменить TEXT на TEXT[]
ALTER TABLE projects
  ALTER COLUMN category TYPE TEXT[]
  USING ARRAY[category];

-- Добавить constraint для валидации элементов массива
ALTER TABLE projects
  ADD CONSTRAINT valid_categories
  CHECK (category <@ ARRAY['building', 'station', 'line_section', 'line']);

-- Индекс для поиска по категориям
CREATE INDEX idx_projects_categories_gin ON projects USING GIN(category);
```

**Плюсы:**
- Нативная поддержка PostgreSQL
- Быстрый поиск с GIN-индексом
- Простые запросы: `WHERE 'building' = ANY(category)`

**Минусы:**
- Нельзя добавить метаданные к связи
- Сложнее сортировать по популярности категорий

### Вариант 2: Junction Table (many-to-many)

```sql
-- Таблица категорий
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('project', 'post')),
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Связь проектов с категориями
CREATE TABLE project_categories (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, category_id)
);

-- Индексы
CREATE INDEX idx_project_categories_project ON project_categories(project_id);
CREATE INDEX idx_project_categories_category ON project_categories(category_id);
```

**Плюсы:**
- Можно добавить метаданные (иконки, цвета, порядок)
- Легко расширять количество категорий
- Можно делать статистику по категориям

**Минусы:**
- Сложнее запросы (JOIN)
- Больше таблиц

### Рекомендация

Для простоты используйте **Вариант 1 (ARRAY)**, если:
- Категории статичны (не меняются часто)
- Не нужны метаданные для категорий
- Важна простота кода

Используйте **Вариант 2 (Junction)**, если:
- Категории динамические (админ может добавлять)
- Нужны иконки/цвета/описания для категорий
- Планируете статистику/фильтры по категориям
