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
      console.log('[Router] Creating conversation for user:', ctx.user.id);
      const result = await db.createConversation({
        userId: ctx.user.id,
        conversationData: {
          messages: [],
          answers: {},
        },
        currentPhase: 1,
      });
      console.log('[Router] Create result:', result);
      console.log('[Router] Result type:', typeof result);
      console.log('[Router] Result keys:', Object.keys(result));
      
      // Try different ways to get insertId
      let insertId: number;
      if ('insertId' in result && result.insertId) {
        insertId = Number(result.insertId);
      } else if (Array.isArray(result) && result.length > 0 && 'insertId' in result[0]) {
        insertId = Number(result[0].insertId);
      } else {
        console.error('[Router] Could not extract insertId from result:', result);
        insertId = 0;
      }
      
      console.log('[Router] Extracted insertId:', insertId);
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
        console.log('[Chat API] Received message:', {
          conversationId: input.conversationId,
          userId: ctx.user.id,
          messageLength: input.userMessage.length,
        });

        const conversation = await db.getConversationById(input.conversationId);
        if (!conversation) {
          console.error('[Chat API] Conversation not found:', input.conversationId);
          throw new Error("Conversation not found");
        }
        
        if (conversation.userId !== ctx.user.id) {
          console.error('[Chat API] User mismatch:', {
            conversationUserId: conversation.userId,
            requestUserId: ctx.user.id,
          });
          throw new Error("Conversation not found");
        }

        const messageCount = conversation.conversationData.messages.length;
        
        const systemPrompt = `あなたはアプリ設計の専門家です。
ユーザーの曖昧なアイデアから、Manus1.5で実装可能な要件定義書を作成します。

【目的】
開発初心者が「Manus1.5に投げる完璧なプロンプト」を生成するために、以下の情報を質問を通じて収集します：

1. **アイデアの核心** - 何を作りたいのか、なぜ作るのか
2. **ターゲットユーザー** - 誰が使うのか、どんなシーンで使うのか
3. **コア機能** - 必須機能、あったら良い機能、将来的な機能
4. **認証** - ログインが必要か、誰でも使えるか
5. **データベース** - どんなデータを保存するのか
6. **デザイン・雰囲気** - 色、フォント、レイアウトのイメージ
7. **技術要件** - AI機能、外部API、決済機能など
8. **画面構成** - 主要なページと画面遷移

【現在の進捗】
会話数: ${messageCount}

【指示】
- 最初の質問でアイデアの核心を把握します
- 次に、上記の情報を1つずつ丁寧に質問して収集します
- 具体的な例や選択肢を提示して、初心者でも答えやすくします
- 10～15回の対話で必要な情報を全て収集します
- 情報が十分集まったら、「これで必要な情報が揃いました！右上の『要件定義書をダウンロード』ボタンをクリックして、Manusプロンプトを取得してください！」と伝えます

自然でフレンドリーな対話を心がけてください。`;

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
        console.log('[Chat API] Calling LLM with', messages.length, 'messages');
        let aiMessage: string;
        try {
          const response = await invokeLLM({ messages });
          aiMessage = typeof response.choices[0].message.content === 'string' 
            ? response.choices[0].message.content 
            : "申し訳ございません。エラーが発生しました。";
          console.log('[Chat API] LLM response received, length:', aiMessage.length);
        } catch (error) {
          console.error('[Chat API] LLM error:', error);
          aiMessage = "申し訳ございません。AIの応答生成に失敗しました。もう一度お試しください。";
        }

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

        try {
          await db.updateConversation(input.conversationId, {
            conversationData: {
              ...conversation.conversationData,
              messages: updatedMessages,
            },
          });
          console.log('[Chat API] Conversation updated successfully');
        } catch (error) {
          console.error('[Chat API] Failed to update conversation:', error);
          throw new Error('会話の更新に失敗しました');
        }

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
            content: `あなたはアプリ設計の専門家です。以下の会話履歴から、Manus1.5でそのまま使える完璧な要件定義書を生成してください。

【manusPromptに含める内容】
以下の形式で、Manus1.5にそのままコピペできるプロンプトを作成してください：

"""
# [アプリ名]

## 概要
- **キャッチコピー**: [一言で表現]
- **ターゲットユーザー**: [誰が使うのか]
- **核心的価値**: [このアプリが解決する問題]

## 主要機能
### 必須機能
1. [機能1]: [詳細な説明]
2. [機能2]: [詳細な説明]
...

### あったら良い機能
- [機能]: [説明]

## 認証とユーザー管理
- [ログインが必要か、誰でも使えるか]
- [ユーザー情報の管理方法]

## データベース設計
[保存するデータとテーブル構造を詳細に説明]

## 画面構成とUI/UX
### 主要な画面
1. [画面名]: [機能とレイアウトの説明]
2. [画面名]: [機能とレイアウトの説明]
...

### ナビゲーション
[画面間の遷移を説明]

## デザイン要件
- **色**: [メインカラー、アクセントカラー]
- **フォント**: [フォントの雰囲気]
- **雰囲気**: [全体的なデザインの雰囲気]

## 技術要件
- **AI機能**: [必要なAI機能]
- **外部API**: [使用するAPI]
- **その他**: [特殊な技術要件]

## 実装の注意点
[開発時に気をつけるべきポイント]
"""

会話履歴から得られた情報を元に、上記の形式で詳細なプロンプトを生成してください。
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
