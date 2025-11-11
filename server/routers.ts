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
2. **プラットフォーム** - iOSアプリか、Androidアプリか、Webアプリか、PWAか
3. **ターゲットユーザー** - 誰が使うのか、どんなシーンで使うのか
4. **コア機能** - 必須機能、あったら良い機能、将来的な機能
5. **認証** - ログインが必要か、誰でも使えるか
6. **データベース** - どんなデータを保存するのか
7. **デザイン・雰囲気** - 色、フォント、レイアウトのイメージ
8. **技術要件** - AI機能、外部API、決済機能など
9. **画面構成** - 主要なページと画面遷移

【現在の進捗】
会話数: ${messageCount}

【指示】
- 最初の質問でアイデアの核心を把握します
- 次に、上記の情報を1つずつ丁寧に質問して収集します
- **重要**: プラットフォームの質問では、必ず「iOSアプリ」「Androidアプリ」「Webアプリ」「PWA」の4つの選択肢を提示してください
- 具体的な例や選択肢を提示して、初心者でも答えやすくします
- 10～15回の対話で必要な情報を全て収集します
- 情報が十分集まったら、「素晴らしい！これで必要な情報が全て揃いました！画面上部の『要件定義書をダウンロード』ボタンをクリックして、そのファイルをManusに添付してください！きっと素晴らしいアプリができますよ！」と伝えます

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
            content: `あなたはアプリ設計の専門家です。以下の会話履歴から、Manus1.5でそのまま使える超詳細な要件定義書を生成してください。

【manusPromptに含める内容】
以下の形式で、Manus1.5にそのままコピペできる超詳細なプロンプトを作成してください：

"""
# [アプリ名]

## 概要
- **プラットフォーム**: [iOSアプリ / Androidアプリ / Webアプリ / PWA]
- **キャッチコピー**: [一言で表現]
- **ターゲットユーザー**: [誰が使うのか、年齢層、ライフスタイル]
- **核心的価値**: [このアプリが解決する問題]
- **使用シーン**: [いつ、どこで、どのように使われるか]

## ユーザーストーリー
1. [ユーザータイプ]として、[目的]のために、[機能]を使いたい
2. [ユーザータイプ]として、[目的]のために、[機能]を使いたい
...

## 主要機能
### 必須機能
1. **[機能1]**
   - 詳細: [具体的な説明]
   - 操作手順: [ステップバイステップ]
   - エッジケース: [例外処理、エラーハンドリング]

2. **[機能2]**
   - 詳細: [具体的な説明]
   - 操作手順: [ステップバイステップ]
   - エッジケース: [例外処理、エラーハンドリング]
...

### あったら良い機能
- [機能]: [説明]

### 将来的な機能
- [機能]: [説明]

## 認証とユーザー管理
- **認証方式**: [ログインが必要か、誰でも使えるか]
- **ユーザー情報**: [保存するユーザー情報]
- **権限管理**: [ロール、アクセス制御]

## データベース設計
### テーブル構造
1. **[テーブル名]**
   - [フィールド名]: [型] - [説明]
   - [フィールド名]: [型] - [説明]
   - リレーション: [他のテーブルとの関係]

2. **[テーブル名]**
   ...

## 画面構成とUI/UX
### 主要な画面
1. **[画面名]**
   - 目的: [この画面の役割]
   - レイアウト: [ヘッダー、コンテンツ、フッターの構成]
   - 主要要素: [ボタン、フォーム、リストなど]
   - 操作: [ユーザーができること]

2. **[画面名]**
   ...

### 画面遷移図 (Mermaid)
\`\`\`mermaid
graph TD
    A[ホーム] --> B[機能1]
    A --> C[機能2]
    B --> D[詳細]
    ...
\`\`\`

### ワイヤーフレーム
#### [画面名]
\`\`\`
+----------------------------------+
|  ヘッダー (タイトル、メニュー)   |
+----------------------------------+
|                                  |
|  [コンテンツエリア]            |
|  - 要素1                       |
|  - 要素2                       |
|                                  |
+----------------------------------+
|  フッター (ナビゲーション)     |
+----------------------------------+
\`\`\`

### UI/UX設計のポイント
- **使いやすさ**: [直感的な操作、シンプルなナビゲーション]
- **アクセシビリティ**: [色のコントラスト、フォントサイズ]
- **レスポンシブ対応**: [モバイル、タブレット、PCでの表示]

## デザイン要件
- **色**: 
  - メインカラー: [色名 / HEXコード]
  - アクセントカラー: [色名 / HEXコード]
  - 背景色: [色名 / HEXコード]
- **フォント**: [フォント名、雰囲気]
- **雰囲気**: [全体的なデザインの雰囲気、参考アプリ]
- **アイコン・画像**: [必要なビジュアル要素]

## 技術要件
- **プラットフォーム**: [iOS / Android / Web / PWA]
- **AI機能**: [必要なAI機能、モデル]
- **外部API**: [使用するAPI、サービス]
- **決済機能**: [必要な場合の決済方法]
- **その他**: [特殊な技術要件]

## 非機能要件
- **パフォーマンス**: [ページ読み込み時間、レスポンス速度]
- **セキュリティ**: [データ暗号化、認証セキュリティ]
- **スケーラビリティ**: [同時アクセス数、データ量]
- **保守性**: [コードの読みやすさ、ドキュメント]

## エッジケースと例外処理
1. **[ケース1]**: [ユーザーが無効な入力をした場合]
   - 対応: [エラーメッセージ表示、再入力促し]

2. **[ケース2]**: [ネットワークエラーが発生した場合]
   - 対応: [リトライ処理、オフラインモード]
...

## 実装の注意点
- [開発時に気をつけるべきポイント]
- [テストすべき項目]
- [パフォーマンス最適化のポイント]

## 概算開発コスト (Manusクレジット)
- **基本設計・開発**: 約 [X] クレジット
- **機能実装**: 約 [Y] クレジット
- **デザイン調整**: 約 [Z] クレジット
- **テスト・デバッグ**: 約 [W] クレジット
- **合計**: 約 [Total] クレジット

（※この数値は概算です。実際の消費は複雑度や修正回数により変動します。）
"""

会話履歴から得られた情報を元に、上記の形式で超詳細なプロンプトを生成してください。
特に以下の点に注意してください：
- 画面遷移図はMermaid記法で詳細に記述
- ワイヤーフレームは主要画面すべてに作成
- エッジケースは具体的な例を挙げる
- クレジット消費は機能の複雑度に応じて現実的な数値を設定

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
