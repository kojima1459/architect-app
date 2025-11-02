import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Send, Loader2, FileText, Copy, Check } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function Chat() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [currentPhase, setCurrentPhase] = useState(1);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const createConversation = trpc.conversation.create.useMutation();
  const { data: conversation, refetch: refetchConversation } = trpc.conversation.get.useQuery(
    { id: conversationId! },
    { enabled: !!conversationId }
  );
  const chatMutation = trpc.conversation.chat.useMutation();
  const generateSpec = trpc.specification.generate.useMutation();

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (user && !conversationId) {
      createConversation.mutate(undefined, {
        onSuccess: (data) => {
          setConversationId(data.id);
        },
      });
    }
  }, [user, conversationId]);

  useEffect(() => {
    if (conversation) {
      setCurrentPhase(conversation.currentPhase);
    }
  }, [conversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.conversationData.messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !conversationId) return;

    const userMessage = message;
    setMessage("");

    chatMutation.mutate(
      {
        conversationId,
        userMessage,
      },
      {
        onSuccess: () => {
          refetchConversation();
        },
        onError: (error) => {
          toast.error("エラーが発生しました: " + error.message);
        },
      }
    );
  };

  const handleGenerateSpec = async () => {
    if (!conversationId) return;

    generateSpec.mutate(
      { conversationId },
      {
        onSuccess: (data) => {
          toast.success("仕様書を生成しました!");
          setLocation(`/specification/${data.specificationId}`);
        },
        onError: (error) => {
          toast.error("エラーが発生しました: " + error.message);
        },
      }
    );
  };

  const handleCopyPrompt = async () => {
    // This will be implemented when we have the specification
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const phases = [
    { id: 1, name: "アイデアの核心" },
    { id: 2, name: "ユーザー・用途" },
    { id: 3, name: "コア機能" },
    { id: 4, name: "デザイン・雰囲気" },
    { id: 5, name: "技術的制約" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold">Architect - アプリ設計支援AI</h1>
              <Button variant="ghost" onClick={() => setLocation("/history")}>
                履歴
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={handleGenerateSpec}
              disabled={currentPhase < 5 || generateSpec.isPending}
            >
              {generateSpec.isPending ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <FileText className="mr-2 w-4 h-4" />
                  仕様書を生成
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Phase Progress */}
      <div className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {phases.map((phase, index) => (
              <div key={phase.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`phase-indicator ${
                      phase.id < currentPhase
                        ? "phase-completed"
                        : phase.id === currentPhase
                        ? "phase-active"
                        : "phase-pending"
                    }`}
                  >
                    {phase.id}
                  </div>
                  <span className="text-xs mt-2 text-center max-w-[80px]">{phase.name}</span>
                </div>
                {index < phases.length - 1 && (
                  <div
                    className={`h-0.5 w-12 mx-2 ${
                      phase.id < currentPhase ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-6">
        <div className="grid lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
          {/* Chat Area */}
          <Card className="flex flex-col h-[calc(100vh-280px)]">
            <div className="p-4 border-b">
              <h2 className="font-semibold">対話</h2>
            </div>
            
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {!conversation?.conversationData.messages.length && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">
                      Architectへようこそ!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      あなたのアイデアを実装可能な設計書に変えます。<br />
                      5分の対話で、Manusで作れるプロンプトが完成します。
                    </p>
                    <p className="text-sm text-muted-foreground mt-4">
                      さあ、始めましょう!<br />
                      どんなアプリを作りたいですか?ざっくりで大丈夫です。
                    </p>
                  </div>
                )}
                
                {conversation?.conversationData.messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={msg.role === "user" ? "chat-message-user" : "chat-message-ai"}>
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                  </div>
                ))}
                
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="chat-message-ai">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="メッセージを入力..."
                  disabled={chatMutation.isPending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || chatMutation.isPending}
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Preview Area */}
          <Card className="flex flex-col h-[calc(100vh-280px)]">
            <div className="p-4 border-b">
              <h2 className="font-semibold">設計書プレビュー</h2>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {!conversation?.conversationData.messages.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    対話を進めると、ここに設計書がリアルタイムで表示されます。
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <h3>収集した情報</h3>
                    <p className="text-sm text-muted-foreground">
                      現在Phase {currentPhase}/5を進行中です。<br />
                      全てのフェーズが完了したら、「仕様書を生成」ボタンで完全な設計書とManusプロンプトを生成できます。
                    </p>
                    
                    {conversation.conversationData.answers && Object.keys(conversation.conversationData.answers).length > 0 && (
                      <div className="mt-4">
                        <h4>回答済み項目</h4>
                        <ul className="text-sm">
                          {Object.entries(conversation.conversationData.answers).map(([key, value]) => (
                            <li key={key}>
                              <strong>{key}:</strong> {String(value)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
}
