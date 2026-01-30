import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type SortDirection = "asc" | "desc";

type SelectSpec = Record<string, any>;
type IncludeSpec = Record<string, any>;

type DbRow = any;

type QueryArgs = Record<string, any>;

type UpdateArgs = {
  where: Record<string, any>;
  data: Record<string, any>;
  select?: SelectSpec;
};

type CreateArgs = {
  data: Record<string, any>;
  select?: SelectSpec;
};

type UpsertArgs = {
  where: Record<string, any>;
  create: Record<string, any>;
  update: Record<string, any>;
  select?: SelectSpec;
};

type TableName = keyof Database["public"]["Tables"];

type RelationConfig = {
  type: "one" | "many";
  table: TableName;
  foreignKey: string;
  targetKey?: string;
};

const dateFields = new Set([
  "createdAt",
  "updatedAt",
  "publishedAt",
  "reviewedAt",
  "respondedAt",
  "joinedAt",
  "expiresAt",
  "addedAt",
]);

function normalizeDates(row: DbRow) {
  const normalized = { ...row };
  for (const key of Object.keys(normalized)) {
    if (dateFields.has(key) && typeof normalized[key] === "string") {
      normalized[key] = new Date(normalized[key] as string);
    }
  }
  return normalized;
}

type ModelConfig = {
  table: TableName;
  primaryKey?: string;
  compositeKeys?: Record<string, string[]>;
  relations?: Record<string, RelationConfig>;
};

const modelConfigs: Record<string, ModelConfig> = {
  user: {
    table: "users",
    primaryKey: "id",
  },
  accountConnection: {
    table: "account_connections",
    primaryKey: "id",
  },
  session: {
    table: "sessions",
    primaryKey: "id",
  },
  company: {
    table: "companies",
    primaryKey: "id",
  },
  companyMembership: {
    table: "company_memberships",
    primaryKey: "id",
    compositeKeys: {
      companyId_userId: ["companyId", "userId"],
    },
  },
  post: {
    table: "posts",
    primaryKey: "id",
  },
  project: {
    table: "projects",
    primaryKey: "id",
  },
  projectUpdate: {
    table: "project_updates",
    primaryKey: "id",
  },
  moderationRequest: {
    table: "moderation_requests",
    primaryKey: "id",
  },
  invite: {
    table: "invites",
    primaryKey: "id",
  },
  projectCollaboratorCompany: {
    table: "project_collaborator_companies",
    primaryKey: "id",
    compositeKeys: {
      projectId_companyId: ["projectId", "companyId"],
    },
  },
  partnership: {
    table: "partnerships",
    primaryKey: "id",
    compositeKeys: {
      companyAId_companyBId: ["companyAId", "companyBId"],
    },
  },
  ticket: {
    table: "tickets",
    primaryKey: "id",
  },
  ticketMessage: {
    table: "ticket_messages",
    primaryKey: "id",
  },
  notification: {
    table: "notifications",
    primaryKey: "id",
  },
  auditLog: {
    table: "audit_logs",
    primaryKey: "id",
  },
  fileAsset: {
    table: "file_assets",
    primaryKey: "id",
  },
};

const relationConfigs: Record<string, Record<string, RelationConfig>> = {
  company: {
    memberships: {
      type: "many",
      table: "company_memberships",
      foreignKey: "companyId",
    },
    owner: {
      type: "one",
      table: "users",
      foreignKey: "ownerUserId",
    },
    createdBy: {
      type: "one",
      table: "users",
      foreignKey: "createdByUserId",
    },
  },
  companyMembership: {
    company: {
      type: "one",
      table: "companies",
      foreignKey: "companyId",
    },
    user: {
      type: "one",
      table: "users",
      foreignKey: "userId",
    },
    invitedBy: {
      type: "one",
      table: "users",
      foreignKey: "invitedByUserId",
    },
  },
  post: {
    createdBy: {
      type: "one",
      table: "users",
      foreignKey: "createdByUserId",
    },
    ownerUser: {
      type: "one",
      table: "users",
      foreignKey: "ownerUserId",
    },
    ownerCompany: {
      type: "one",
      table: "companies",
      foreignKey: "ownerCompanyId",
    },
  },
  project: {
    createdBy: {
      type: "one",
      table: "users",
      foreignKey: "createdByUserId",
    },
    ownerUser: {
      type: "one",
      table: "users",
      foreignKey: "ownerUserId",
    },
    ownerCompany: {
      type: "one",
      table: "companies",
      foreignKey: "ownerCompanyId",
    },
  },
  projectUpdate: {
    createdBy: {
      type: "one",
      table: "users",
      foreignKey: "createdByUserId",
    },
    reviewedBy: {
      type: "one",
      table: "users",
      foreignKey: "reviewedByUserId",
    },
    project: {
      type: "one",
      table: "projects",
      foreignKey: "projectId",
    },
  },
  moderationRequest: {
    submittedBy: {
      type: "one",
      table: "users",
      foreignKey: "submittedByUserId",
    },
    reviewedBy: {
      type: "one",
      table: "users",
      foreignKey: "reviewedByUserId",
    },
  },
  invite: {
    createdBy: {
      type: "one",
      table: "users",
      foreignKey: "createdByUserId",
    },
    toUser: {
      type: "one",
      table: "users",
      foreignKey: "toUserId",
    },
    company: {
      type: "one",
      table: "companies",
      foreignKey: "companyId",
    },
    fromCompany: {
      type: "one",
      table: "companies",
      foreignKey: "fromCompanyId",
    },
    toCompany: {
      type: "one",
      table: "companies",
      foreignKey: "toCompanyId",
    },
    project: {
      type: "one",
      table: "projects",
      foreignKey: "projectId",
    },
  },
  partnership: {
    companyA: {
      type: "one",
      table: "companies",
      foreignKey: "companyAId",
    },
    companyB: {
      type: "one",
      table: "companies",
      foreignKey: "companyBId",
    },
    createdBy: {
      type: "one",
      table: "users",
      foreignKey: "createdByUserId",
    },
  },
  ticket: {
    createdBy: {
      type: "one",
      table: "users",
      foreignKey: "createdByUserId",
    },
  },
  ticketMessage: {
    author: {
      type: "one",
      table: "users",
      foreignKey: "authorUserId",
    },
    ticket: {
      type: "one",
      table: "tickets",
      foreignKey: "ticketId",
    },
  },
  notification: {
    user: {
      type: "one",
      table: "users",
      foreignKey: "userId",
    },
  },
  auditLog: {
    actor: {
      type: "one",
      table: "users",
      foreignKey: "actorUserId",
    },
  },
};

function getRelations(modelName: string) {
  return relationConfigs[modelName] ?? {};
}

function extractRelationRequests(
  select?: SelectSpec,
  include?: IncludeSpec,
) {
  const requests: Record<string, SelectSpec | true> = {};
  if (select) {
    for (const [key, value] of Object.entries(select)) {
      if (typeof value === "object" && value) {
        requests[key] = value as SelectSpec;
      }
    }
  }
  if (include) {
    for (const [key, value] of Object.entries(include)) {
      if (value === true) {
        requests[key] = true;
      } else if (value && typeof value === "object") {
        requests[key] = value.select ?? true;
      }
    }
  }
  return requests;
}

function pickSelect(row: DbRow, select?: SelectSpec) {
  if (!select) return { ...row };
  const result: DbRow = {};
  for (const [key, value] of Object.entries(select)) {
    if (value === true) {
      result[key] = row[key];
    }
  }
  return result;
}

function shapeWithRelations(
  row: DbRow,
  select: SelectSpec | undefined,
  include: IncludeSpec | undefined,
  relationsData: DbRow,
) {
  if (!select && !include) {
    return { ...row, ...relationsData };
  }

  if (select) {
    const base = pickSelect(row, select);
    return { ...base, ...relationsData };
  }

  return { ...row, ...relationsData };
}

async function fetchRelationData(
  relationName: string,
  relation: RelationConfig,
  rows: DbRow[],
) {
  const supabase = getSupabaseAdmin() as any;
  if (relation.type === "one") {
    const ids = Array.from(
      new Set(rows.map((row) => row[relation.foreignKey]).filter(Boolean)),
    ) as string[];
    if (!ids.length) return new Map<string, DbRow | null>();
    const { data, error } = await supabase
      .from(relation.table)
      .select("*")
      .in(relation.targetKey ?? "id", ids);
    if (error || !data) return new Map();
    const lookup = new Map(
      data.map((item) => [
        item[relation.targetKey ?? "id"],
        normalizeDates(item),
      ]),
    );
    return new Map(
      rows.map((row) => [
        row[relation.foreignKey] as string,
        lookup.get(row[relation.foreignKey] as string) ?? null,
      ]),
    );
  }

  const ids = Array.from(new Set(rows.map((row) => row.id).filter(Boolean))) as
    | string[]
    | number[];
  if (!ids.length) return new Map<string, DbRow[]>();
  const { data, error } = await supabase
    .from(relation.table)
    .select("*")
    .in(relation.foreignKey, ids);
  if (error || !data) return new Map();
  const grouped = new Map<string, DbRow[]>();
  for (const item of data.map(normalizeDates)) {
    const key = item[relation.foreignKey] as string;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  return grouped;
}

async function attachRelations(
  modelName: string,
  rows: DbRow[],
  select?: SelectSpec,
  include?: IncludeSpec,
  forcedRelations?: Record<string, any>,
) {
  const relations = getRelations(modelName);
  const requests = {
    ...extractRelationRequests(select, include),
    ...(forcedRelations ?? {}),
  };
  if (!Object.keys(requests).length) {
    return rows.map((row) => shapeWithRelations(row, select, include, {}));
  }

  const relationResults: Record<string, Map<string, any>> = {};
  await Promise.all(
    Object.entries(requests).map(async ([key, value]) => {
      const relation = relations[key];
      if (!relation) {
        relationResults[key] = new Map();
        return;
      }
      relationResults[key] = await fetchRelationData(key, relation, rows);
    }),
  );

  return rows.map((row) => {
    const relationsData: DbRow = {};
    for (const [key, selection] of Object.entries(requests)) {
      const relation = relations[key];
      const relationMap = relationResults[key];
      if (!relation) {
        relationsData[key] = null;
        continue;
      }
      if (relation.type === "one") {
        const related =
          relationMap?.get(row[relation.foreignKey] as string) ?? null;
        relationsData[key] =
          selection && selection !== true && related
            ? pickSelect(related as DbRow, selection as SelectSpec)
            : related;
      } else {
        const related =
          relationMap?.get(row.id as string) ?? ([] as DbRow[]);
        relationsData[key] =
          selection && selection !== true
            ? related.map((item) =>
                pickSelect(item as DbRow, selection as SelectSpec),
              )
            : related;
      }
    }
    return shapeWithRelations(row, select, include, relationsData);
  });
}

function splitWhere(
  modelName: string,
  query: ReturnType<ReturnType<typeof getSupabaseAdmin>["from"]>,
  where?: Record<string, any>,
) {
  if (!where) return { query, relationFilters: {} as Record<string, any> };
  const config = modelConfigs[modelName];
  const compositeKeys = config?.compositeKeys ?? {};
  const relations = getRelations(modelName);
  const relationFilters: Record<string, any> = {};
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (compositeKeys[key]) {
      const compositeValue = value as Record<string, any>;
      for (const column of compositeKeys[key]) {
        if (compositeValue?.[column] !== undefined) {
          query = query.eq(column, compositeValue[column]);
        }
      }
      continue;
    }
    if (value === null) {
      query = query.is(key, null);
      continue;
    }
    if (Array.isArray(value)) {
      query = query.in(key, value as unknown[]);
      continue;
    }
    if (typeof value === "object") {
      if (relations[key]) {
        relationFilters[key] = value;
      } else {
        const nested = value as Record<string, any>;
        if ("equals" in nested) {
          query = query.eq(key, nested.equals as string);
        }
      }
      continue;
    }
    query = query.eq(key, value);
  }
  return { query, relationFilters };
}

function matchesSimpleWhere(
  row: DbRow | null,
  where?: Record<string, any>,
) {
  if (!where || !row) return false;
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (typeof value === "object" && value !== null) {
      const nested = value as Record<string, any>;
      if ("equals" in nested && row[key] !== nested.equals) {
        return false;
      }
      continue;
    }
    if (row[key] !== value) return false;
  }
  return true;
}

async function findMany(modelName: string, args: QueryArgs = {}) {
  const supabase = getSupabaseAdmin() as any;
  const config = modelConfigs[modelName];
  let query = supabase.from(config.table).select("*");
  const { query: filteredQuery, relationFilters } = splitWhere(
    modelName,
    query,
    args.where,
  );
  query = filteredQuery;

  if (args.orderBy) {
    for (const [column, direction] of Object.entries(args.orderBy)) {
      query = query.order(column, { ascending: direction === "asc" });
    }
  }
  if (args.skip) {
    query = query.range(args.skip, (args.skip ?? 0) + (args.take ?? 100) - 1);
  } else if (args.take) {
    query = query.limit(args.take);
  }

  const { data, error } = await query;
  if (error || !data) {
    throw new Error(error?.message ?? "Database query failed.");
  }
  let rows = await attachRelations(
    modelName,
    (data as DbRow[]).map(normalizeDates),
    args.select,
    args.include,
    Object.keys(relationFilters).length ? relationFilters : undefined,
  );
  if (Object.keys(relationFilters).length) {
    rows = rows.filter((row) => {
      for (const [relationName, relationWhere] of Object.entries(
        relationFilters,
      )) {
        const related = row[relationName] as
          | DbRow
          | DbRow[]
          | null;
        if (Array.isArray(related)) {
          const match = related.some((item) =>
            matchesSimpleWhere(item, relationWhere as Record<string, any>),
          );
          if (!match) return false;
        } else if (
          !matchesSimpleWhere(
            related as DbRow,
            relationWhere as Record<string, any>,
          )
        ) {
          return false;
        }
      }
      return true;
    });
  }
  return rows;
}

async function findFirst(modelName: string, args: QueryArgs = {}) {
  const items = await findMany(modelName, { ...args, take: 1 });
  return items[0] ?? null;
}

async function findUnique(modelName: string, args: QueryArgs = {}) {
  const items = await findMany(modelName, { ...args, take: 1 });
  return items[0] ?? null;
}

async function create(modelName: string, args: CreateArgs) {
  const supabase = getSupabaseAdmin() as any;
  const config = modelConfigs[modelName];
  const { data, error } = await supabase
    .from(config.table)
    .insert(args.data as any)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Insert failed.");
  }
  const rows = await attachRelations(
    modelName,
    [normalizeDates(data as DbRow)],
    args.select,
  );
  return rows[0];
}

async function update(modelName: string, args: UpdateArgs) {
  const supabase = getSupabaseAdmin() as any;
  const config = modelConfigs[modelName];
  let updateData = { ...args.data };
  for (const [key, value] of Object.entries(updateData)) {
    if (value && typeof value === "object") {
      const op = value as Record<string, number>;
      if ("increment" in op || "decrement" in op) {
        const current = await findUnique(modelName, { where: args.where });
        const currentValue =
          typeof current?.[key] === "number" ? (current[key] as number) : 0;
        updateData[key] =
          currentValue +
          (op.increment ?? 0) -
          (op.decrement ?? 0);
      }
    }
  }
  let query = supabase.from(config.table).update(updateData as any);
  query = splitWhere(modelName, query, args.where).query;
  const { data, error } = await query.select("*").single();
  if (error || !data) {
    throw new Error(error?.message ?? "Update failed.");
  }
  const rows = await attachRelations(
    modelName,
    [normalizeDates(data as DbRow)],
    args.select,
  );
  return rows[0];
}

async function remove(modelName: string, args: { where: Record<string, any> }) {
  const supabase = getSupabaseAdmin() as any;
  const config = modelConfigs[modelName];
  let query = supabase.from(config.table).delete();
  query = splitWhere(modelName, query, args.where).query;
  const { data, error } = await query.select("*").single();
  if (error || !data) {
    throw new Error(error?.message ?? "Delete failed.");
  }
  return data;
}

async function upsert(modelName: string, args: UpsertArgs) {
  const existing = await findUnique(modelName, { where: args.where });
  if (existing) {
    return update(modelName, { where: args.where, data: args.update, select: args.select });
  }
  return create(modelName, { data: { ...args.create }, select: args.select });
}

async function count(modelName: string, args: { where?: Record<string, any> } = {}) {
  const supabase = getSupabaseAdmin() as any;
  const config = modelConfigs[modelName];
  let query = supabase.from(config.table).select("*", { count: "exact", head: true });
  query = splitWhere(modelName, query, args.where).query;
  const { count: result, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return result ?? 0;
}

function createModel(modelName: string) {
  return {
    findMany: (args?: QueryArgs) => findMany(modelName, args),
    findFirst: (args?: QueryArgs) => findFirst(modelName, args),
    findUnique: (args?: QueryArgs) => findUnique(modelName, args),
    create: (args: CreateArgs) => create(modelName, args),
    update: (args: UpdateArgs) => update(modelName, args),
    delete: (args: { where: Record<string, any> }) => remove(modelName, args),
    upsert: (args: UpsertArgs) => upsert(modelName, args),
    count: (args?: { where?: Record<string, any> }) => count(modelName, args),
    createMany: async (args: { data: Record<string, any>[] }) => {
      const supabase = getSupabaseAdmin() as any;
      const config = modelConfigs[modelName];
      const { error, data } = await supabase
        .from(config.table)
        .insert(args.data as any)
        .select("*");
      if (error) {
        throw new Error(error.message);
      }
      return { count: Array.isArray(data) ? data.length : 0 };
    },
    updateMany: async (args: { where?: Record<string, any>; data: Record<string, any> }) => {
      const supabase = getSupabaseAdmin() as any;
      const config = modelConfigs[modelName];
      let query = supabase.from(config.table).update(args.data as any);
      if (args.where) {
        query = splitWhere(modelName, query, args.where).query;
      }
      const { data, error } = await query.select("*");
      if (error) {
        throw new Error(error.message);
      }
      return { count: Array.isArray(data) ? data.length : 0 };
    },
  };
}

const prismaModels = {
  user: createModel("user"),
  accountConnection: createModel("accountConnection"),
  session: createModel("session"),
  company: createModel("company"),
  companyMembership: createModel("companyMembership"),
  post: createModel("post"),
  project: createModel("project"),
  projectUpdate: createModel("projectUpdate"),
  moderationRequest: createModel("moderationRequest"),
  invite: createModel("invite"),
  projectCollaboratorCompany: createModel("projectCollaboratorCompany"),
  partnership: createModel("partnership"),
  ticket: createModel("ticket"),
  ticketMessage: createModel("ticketMessage"),
  notification: createModel("notification"),
  auditLog: createModel("auditLog"),
  fileAsset: createModel("fileAsset"),
};

function transaction<T>(actions: Array<Promise<T>>): Promise<T[]>;
function transaction<T>(
  actions: (client: typeof prismaModels) => Promise<T>,
): Promise<T>;
async function transaction<T>(
  actions: Array<Promise<T>> | ((client: typeof prismaModels) => Promise<T>),
) {
  if (Array.isArray(actions)) {
    return Promise.all(actions);
  }
  return actions(prismaModels);
}

export const prisma = {
  ...prismaModels,
  $transaction: transaction,
  $disconnect: async () => {
    return undefined;
  },
  $queryRaw: async (
    _strings: TemplateStringsArray,
    ..._values: unknown[]
  ) => {
    const supabase = getSupabaseAdmin() as any;
    const { error } = await supabase.from("users").select("id").limit(1);
    if (error) {
      throw new Error(error.message);
    }
    return true;
  },
};
