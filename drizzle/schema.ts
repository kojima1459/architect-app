import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Conversations table - stores chat history and current phase
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conversationData: json("conversationData").$type<{
    messages: Array<{
      role: 'ai' | 'user';
      content: string;
      timestamp: string;
    }>;
    answers: Record<string, any>;
  }>().notNull(),
  currentPhase: int("currentPhase").default(1).notNull(),
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Specifications table - stores generated app specifications
 */
export const specifications = mysqlTable("specifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conversationId: int("conversationId"),
  appName: varchar("appName", { length: 255 }).notNull(),
  specData: json("specData").$type<{
    概要: {
      アプリ名: string;
      キャッチコピー: string;
      ターゲットユーザー: string;
      核心的価値: string;
    };
    機能一覧: {
      必須機能: Array<{ name: string; description: string }>;
      あったら良い機能: Array<{ name: string; description: string }>;
      将来的な機能: Array<{ name: string; description: string }>;
    };
    画面遷移図: string;
    ワイヤーフレーム: Record<string, string>;
    データベース設計: Array<{ table: string; columns: string }>;
    技術要件: {
      認証: string;
      データベース: string;
      AI機能: string;
      定期タスク: string;
      外部API: string;
    };
    デザイン要件: {
      カラースキーム: string[];
      フォント: string[];
      トンマナ: string;
      アニメーション: string[];
    };
    実現可能性評価: {
      実現可能: string[];
      工夫が必要: Array<{ feature: string; alternative: string }>;
      実現困難: Array<{ feature: string; reason: string }>;
    };
  }>().notNull(),
  manusPrompt: text("manusPrompt").notNull(),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Specification = typeof specifications.$inferSelect;
export type InsertSpecification = typeof specifications.$inferInsert;

/**
 * Templates table - stores frequently used patterns
 */
export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 100 }).notNull(),
  templateData: json("templateData").$type<{
    name: string;
    description: string;
    features: string[];
    techStack: string[];
    examples: string[];
  }>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;
