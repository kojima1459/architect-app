import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  conversation: router({
    // Create new conversation
    create: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await db.createConversation({
        userId: ctx.user.id,
        conversationData: {
          messages: [],
          answers: {},
        },
        currentPhase: 1,
      });
      const insertId = 'insertId' in result ? Number(result.insertId) : 0;
      return { success: true, id: insertId };
    }),

    // Get user's conversations
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getConversationsByUserId(ctx.user.id);
    }),

    // Get conversation by ID
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const conversation = await db.getConversationById(input.id);
        if (!conversation || conversation.userId !== ctx.user.id) {
          throw new Error("Conversation not found");
        }
        return conversation;
      }),

    // Update conversation
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        conversationData: z.any().optional(),
        currentPhase: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const conversation = await db.getConversationById(input.id);
        if (!conversation || conversation.userId !== ctx.user.id) {
          throw new Error("Conversation not found");
        }
        
        const updateData: any = {};
        if (input.conversationData) updateData.conversationData = input.conversationData;
        if (input.currentPhase) updateData.currentPhase = input.currentPhase;
        
        await db.updateConversation(input.id, updateData);
        return { success: true };
      }),

    // Delete conversation
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const conversation = await db.getConversationById(input.id);
        if (!conversation || conversation.userId !== ctx.user.id) {
          throw new Error("Conversation not found");
        }
        
        await db.deleteConversation(input.id);
        return { success: true };
      }),

    // AI chat - process user message and generate AI response
    chat: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        userMessage: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const conversation = await db.getConversationById(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id) {
          throw new Error("Conversation not found");
        }

        const systemPrompt = `あなたはアプリ設計の専門家です。
ユーザーの曖昧なアイデアから、Manus1.5で実装可能な仕様書を作成します。
MECE、実現可能性、UXを重視してください。

現在のフェーズ: ${conversation.currentPhase}/5

フェーズ1: アイデアの核心を理解する
フェーズ2: ユーザー・用途を明確にする
フェーズ3: コア機能を定義する
フェーズ4: デザイン・雰囲気を決める
フェーズ5: 技術的制約を確認する

ユーザーの回答に基づいて、適切な質問や提案を行ってください。
必要に応じて選択肢を提示し、具体的な例を挙げてください。`;

        // Build message history
        const messages = [
          { role: "system" as const, content: systemPrompt },
          ...conversation.conversationData.messages.map(m => ({
            role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
            content: m.content,
          })),
          { role: "user" as const, content: input.userMessage },
        ];

        // Call LLM
        const response = await invokeLLM({ messages });
        const aiMessage = typeof response.choices[0].message.content === 'string' 
          ? response.choices[0].message.content 
          : "申し訳ございません。エラーが発生しました。";

        // Update conversation
        const updatedMessages = [
          ...conversation.conversationData.messages,
          {
            role: 'user' as const,
            content: input.userMessage,
            timestamp: new Date().toISOString(),
          },
          {
            role: 'ai' as const,
            content: aiMessage,
            timestamp: new Date().toISOString(),
          },
        ];

        await db.updateConversation(input.conversationId, {
          conversationData: {
            ...conversation.conversationData,
            messages: updatedMessages,
          },
        });

        return {
          aiMessage,
          currentPhase: conversation.currentPhase,
        };
      }),

    // Advance to next phase
    advancePhase: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const conversation = await db.getConversationById(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id) {
          throw new Error("Conversation not found");
        }

        const nextPhase = Math.min(conversation.currentPhase + 1, 5);
        await db.updateConversation(input.conversationId, {
          currentPhase: nextPhase,
        });

        return { success: true, currentPhase: nextPhase };
      }),
  }),

  specification: router({
    // Generate specification from conversation
    generate: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const conversation = await db.getConversationById(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id) {
          throw new Error("Conversation not found");
        }

        // Build prompt for specification generation
        const messages = [
          {
            role: "system" as const,
            content: `あなたはアプリ設計の専門家です。以下の会話履歴から、完全な仕様書とManusプロンプトを生成してください。

仕様書には以下を含めてください:
1. アプリ概要（アプリ名、キャッチコピー、ターゲットユーザー、核心的価値）
2. 機能一覧（必須機能、あったら良い機能、将来的な機能）
3. 画面遷移図（Mermaid記法）
4. ワイヤーフレーム
5. データベース設計
6. 技術要件
7. デザイン要件
8. 実現可能性評価

JSONフォーマットで返してください。`,
          },
          {
            role: "user" as const,
            content: JSON.stringify(conversation.conversationData.messages),
          },
        ];

        const response = await invokeLLM({
          messages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "app_specification",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  appName: { type: "string" },
                  specData: {
                    type: "object",
                    properties: {
                      概要: {
                        type: "object",
                        properties: {
                          アプリ名: { type: "string" },
                          キャッチコピー: { type: "string" },
                          ターゲットユーザー: { type: "string" },
                          核心的価値: { type: "string" },
                        },
                        required: ["アプリ名", "キャッチコピー", "ターゲットユーザー", "核心的価値"],
                        additionalProperties: false,
                      },
                    },
                    required: ["概要"],
                    additionalProperties: true,
                  },
                  manusPrompt: { type: "string" },
                },
                required: ["appName", "specData", "manusPrompt"],
                additionalProperties: false,
              },
            },
          },
        });

        const specContent = response.choices[0].message.content;
        if (!specContent || typeof specContent !== 'string') {
          throw new Error("Failed to generate specification");
        }

        const spec = JSON.parse(specContent);

        // Save specification
        const result = await db.createSpecification({
          userId: ctx.user.id,
          conversationId: input.conversationId,
          appName: spec.appName,
          specData: spec.specData,
          manusPrompt: spec.manusPrompt,
          version: 1,
        });

        const insertId = 'insertId' in result ? Number(result.insertId) : 0;
        return {
          success: true,
          specificationId: insertId,
          specification: spec,
        };
      }),

    // List user's specifications
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getSpecificationsByUserId(ctx.user.id);
    }),

    // Get specification by ID
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const spec = await db.getSpecificationById(input.id);
        if (!spec || spec.userId !== ctx.user.id) {
          throw new Error("Specification not found");
        }
        return spec;
      }),

    // Update specification
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        specData: z.any().optional(),
        manusPrompt: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const spec = await db.getSpecificationById(input.id);
        if (!spec || spec.userId !== ctx.user.id) {
          throw new Error("Specification not found");
        }

        const updateData: any = {
          version: spec.version + 1,
        };
        if (input.specData) updateData.specData = input.specData;
        if (input.manusPrompt) updateData.manusPrompt = input.manusPrompt;

        await db.updateSpecification(input.id, updateData);
        return { success: true };
      }),
  }),

  template: router({
    // Get all templates
    list: publicProcedure.query(async () => {
      return await db.getAllTemplates();
    }),

    // Get templates by category
    getByCategory: publicProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        return await db.getTemplatesByCategory(input.category);
      }),
  }),
});

export type AppRouter = typeof appRouter;
