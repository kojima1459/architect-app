import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Copy, Check, Loader2, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function Specification() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/specification/:id");
  const [copied, setCopied] = useState(false);

  const specId = params?.id ? parseInt(params.id) : null;

  const { data: specification, isLoading } = trpc.specification.get.useQuery(
    { id: specId! },
    { enabled: !!specId }
  );

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  const handleCopyPrompt = async () => {
    if (!specification?.manusPrompt) return;

    try {
      await navigator.clipboard.writeText(specification.manusPrompt);
      setCopied(true);
      toast.success("プロンプトをコピーしました!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("コピーに失敗しました");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!specification) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">仕様書が見つかりません</p>
          <Button onClick={() => setLocation("/chat")}>チャットに戻る</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setLocation("/chat")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{specification.appName}</h1>
                <p className="text-sm text-muted-foreground">
                  バージョン {specification.version} - {new Date(specification.createdAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
            </div>
            <Button onClick={handleCopyPrompt} disabled={copied}>
              {copied ? (
                <>
                  <Check className="mr-2 w-4 h-4" />
                  コピー済み
                </>
              ) : (
                <>
                  <Copy className="mr-2 w-4 h-4" />
                  プロンプトをコピー
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Specification Details */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-6">設計書</h2>
            
            {/* 概要 */}
            {specification.specData.概要 && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-primary">アプリ概要</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">アプリ名</p>
                    <p className="text-lg">{specification.specData.概要.アプリ名}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">キャッチコピー</p>
                    <p className="text-lg">{specification.specData.概要.キャッチコピー}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">ターゲットユーザー</p>
                    <p>{specification.specData.概要.ターゲットユーザー}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">核心的価値</p>
                    <p>{specification.specData.概要.核心的価値}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 機能一覧 */}
            {specification.specData.機能一覧 && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-primary">機能一覧</h3>
                
                {specification.specData.機能一覧.必須機能 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">必須機能（優先度：高）</h4>
                    <ul className="space-y-2">
                      {specification.specData.機能一覧.必須機能.map((feature, index) => (
                        <li key={index} className="flex gap-2">
                          <span className="text-primary">•</span>
                          <div>
                            <strong>{feature.name}:</strong> {feature.description}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {specification.specData.機能一覧.あったら良い機能 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">あったら良い機能（優先度：中）</h4>
                    <ul className="space-y-2">
                      {specification.specData.機能一覧.あったら良い機能.map((feature, index) => (
                        <li key={index} className="flex gap-2">
                          <span className="text-muted-foreground">•</span>
                          <div>
                            <strong>{feature.name}:</strong> {feature.description}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {specification.specData.機能一覧.将来的な機能 && (
                  <div>
                    <h4 className="font-medium mb-2">将来的な機能（優先度：低）</h4>
                    <ul className="space-y-2">
                      {specification.specData.機能一覧.将来的な機能.map((feature, index) => (
                        <li key={index} className="flex gap-2">
                          <span className="text-muted-foreground">•</span>
                          <div>
                            <strong>{feature.name}:</strong> {feature.description}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* その他のセクション */}
            <div className="prose prose-sm max-w-none">
              <Streamdown>{JSON.stringify(specification.specData, null, 2)}</Streamdown>
            </div>
          </Card>

          {/* Manus Prompt */}
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Manusプロンプト</h2>
              <Button onClick={handleCopyPrompt} disabled={copied} variant="secondary">
                {copied ? (
                  <>
                    <Check className="mr-2 w-4 h-4" />
                    コピー済み
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 w-4 h-4" />
                    コピー
                  </>
                )}
              </Button>
            </div>
            
            <div className="bg-card rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm font-mono">
                {specification.manusPrompt}
              </pre>
            </div>

            <div className="mt-6 p-4 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium mb-2">次のステップ</p>
              <p className="text-sm text-muted-foreground">
                上記のプロンプトをコピーして、Manus1.5に貼り付けてください。
                Manusがこのプロンプトに基づいてアプリを自動生成します。
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
