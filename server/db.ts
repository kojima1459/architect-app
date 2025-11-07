import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, conversations, specifications, templates, InsertConversation, InsertSpecification, InsertTemplate } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Conversation helpers
export async function createConversation(data: InsertConversation) {
  console.log('[DB] createConversation called with:', JSON.stringify(data, null, 2));
  const db = await getDb();
  if (!db) {
    console.error('[DB] Database not available');
    throw new Error("Database not available");
  }
  
  try {
    const result = await db.insert(conversations).values(data);
    console.log('[DB] Conversation created, result:', result);
    return result;
  } catch (error) {
    console.error('[DB] Failed to create conversation:', error);
    throw error;
  }
}

export async function getConversationsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.lastUpdated));
}

export async function getConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateConversation(id: number, data: Partial<InsertConversation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(conversations).set(data).where(eq(conversations.id, id));
}

export async function deleteConversation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(conversations).where(eq(conversations.id, id));
}

// Specification helpers
export async function createSpecification(data: InsertSpecification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(specifications).values(data);
  return result;
}

export async function getSpecificationsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(specifications).where(eq(specifications.userId, userId)).orderBy(desc(specifications.createdAt));
}

export async function getSpecificationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(specifications).where(eq(specifications.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateSpecification(id: number, data: Partial<InsertSpecification>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(specifications).set(data).where(eq(specifications.id, id));
}

// Template helpers
export async function getAllTemplates() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(templates);
}

export async function getTemplatesByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(templates).where(eq(templates.category, category));
}

export async function createTemplate(data: InsertTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(templates).values(data);
  return result;
}
