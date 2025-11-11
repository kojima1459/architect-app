import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Send, Loader2, Trash2, Download, Mic, MicOff, ArrowRight } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { appTemplates } from "@/data/templates";

export default function Chat() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Create conversation once when user is authenticated
  const [conversationCreated, setConversationCreated] = useState(false);
  
  const createConversation = trpc.conversation.create.useMutation();
  const { data: conversation, refetch: refetchConversation } = trpc.conversation.get.useQuery(
    { id: conversationId! },
    { enabled: !!conversationId }
  );
  const chatMutation = trpc.conversation.chat.useMutation();
  const deleteConversation = trpc.conversation.delete.useMutation();
  const generateSpecMutation = trpc.specification.generate.useMutation();

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (user && !conversationId && !conversationCreated) {
      console.log('[Chat] Creating new conversation...');
      setConversationCreated(true);
      createConversation.mutate(undefined, {
        onSuccess: (data) => {
          console.log('[Chat] Conversation created with ID:', data.id);
          setConversationId(data.id);
        },
        onError: (error) => {
          console.error('[Chat] Failed to create conversation:', error);
          toast.error('会話の作成に失敗しました: ' + error.message);
          setConversationCreated(false); // Allow retry
        },
      });
    }
  }, [user, conversationId, conversationCreated, createConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [conversation?.conversationData.messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !conversationId) return;

    const userMessage = message;
    setMessage("");

    chatMutation.mutate(
      { conversationId, userMessage },
      {
        onSuccess: () => {
          refetchConversation();
        },
        onError: (error) => {
          toast.error('エラーが発生しました: ' + error.message);
        },
      }
    );
  };

  const handleClearChat = async () => {
    if (!conversationId) return;
    
    if (!confirm('会話をクリアして新しいチャットを開始しますか?')) return;

    deleteConversation.mutate(
      { id: conversationId },
      {
        onSuccess: () => {
          toast.success('会話をクリアしました');
          setConversationId(null);
          setConversationCreated(false);
        },
        onError: (error) => {
          toast.error('エラーが発生しました: ' + error.message);
        },
      }
    );
  };

  // Voice input handler
  const toggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('このブラウザは音声入力に対応していません');
      return;
    }

    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    // Start listening
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      toast.info('音声入力中...');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMessage(prev => prev + (prev ? ' ' : '') + transcript);
      toast.success('音声をテキストに変換しました');
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      toast.error('音声認識エラー: ' + event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleDownloadSpec = async () => {
    if (!conversationId) return;

    toast.info('要件定義書を生成中...');
    
    generateSpecMutation.mutate(
      { conversationId },
      {
        onSuccess: (data) => {
          // Create markdown content
          const spec = data.specification;
          const appName = spec.appName || 'アプリ';
          const mdContent = `# ${appName} - 要件定義書

${spec.manusPrompt || ''}
`;
          
          // Download as .md file
          const blob = new Blob([mdContent], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${appName.replace(/\\s+/g, '_')}_要件定義書.md`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          toast.success('要件定義書をダウンロードしました!');
        },
        onError: (error) => {
          toast.error('エラーが発生しました: ' + error.message);
        },
      }
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex flex-col">
      {/* Fixed Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 shadow-sm">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Architect - アプリ設計支援AI
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadSpec}
                disabled={generateSpecMutation.isPending || !conversationId}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                {generateSpecMutation.isPending ? (
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                ) : (
                  <Download className="mr-2 w-4 h-4" />
                )}
                要件定義書をダウンロード
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearChat}
                disabled={!conversationId || deleteConversation.isPending}
              >
                <Trash2 className="mr-2 w-4 h-4" />
                クリア
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/history")}>
                履歴
              </Button>
              <Button variant="outline" size="sm" onClick={logout} className="border-red-500 text-red-500 hover:bg-red-50">
                ログアウト
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 container py-6 flex flex-col max-w-5xl">
        <ScrollArea className="flex-1 mb-6" ref={scrollRef}>
          <div className="space-y-6 pr-4">
            {!conversation?.conversationData.messages.length && (
              <div className="text-center py-16 px-6">
                <div className="max-w-3xl mx-auto">
                  <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                    Architectへようこそ!
                  </h2>
                  <p className="text-xl text-foreground mb-6">
                    あなたのアイデアを実装可能な要件定義書に変えます。
                  </p>
                  <p className="text-base text-muted-foreground mb-8 leading-relaxed">
                    質問に答えるだけで、Manus1.5で使えるプロンプトが完成します。<br />
                    認証、データベース、デザイン、技術要件など、必要な情報を全て収集します。
                  </p>
                  <div className="bg-card/50 backdrop-blur rounded-lg p-8 mb-8 border border-primary/20">
                    <p className="text-2xl font-semibold mb-6">
                      どんなアプリを作りたいですか?
                    </p>
                    <p className="text-sm text-muted-foreground mb-6">
                      テンプレートから選ぶか、自由に入力してください
                    </p>
                    {/* Template Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                      {appTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => {
                            if (conversationId) {
                              setMessage(template.initialPrompt);
                              toast.success(`${template.title}テンプレートを選択しました`);
                            }
                          }}
                          disabled={!conversationId}
                          className={`group relative overflow-hidden rounded-xl p-4 text-left transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-br ${template.color}`}
                        >
                          <div className="relative z-10">
                            <div className="text-3xl mb-2">{template.icon}</div>
                            <p className="font-semibold text-white text-sm mb-1">{template.title}</p>
                            <p className="text-xs text-white/80">{template.description}</p>
                          </div>
                          <ArrowRight className="absolute bottom-2 right-2 w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
                        </button>
                      ))}
                    </div>
                    <p className="text-lg font-bold text-center text-primary mt-4">
                      または、下の入力欄に自由にアイデアを入力してください
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-primary/10 rounded-lg p-4">
                      <p className="font-semibold text-primary mb-2">💡 あなただけのアプリを作ろう!</p>
                      <p className="text-muted-foreground">アイデアを形にする第一歩</p>
                    </div>
                    <div className="bg-primary/10 rounded-lg p-4">
                      <p className="font-semibold text-primary mb-2">🚀 アプリで稼ごう!</p>
                      <p className="text-muted-foreground">収益化の可能性を探る</p>
                    </div>
                    <div className="bg-primary/10 rounded-lg p-4">
                      <p className="font-semibold text-primary mb-2">✨ アイデアでマネタイズ!</p>
                      <p className="text-muted-foreground">思いつきを価値に変える</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {conversation?.conversationData.messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-6 py-4 ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg"
                      : "bg-card border border-border shadow-md"
                  }`}
                >
                  <Streamdown>{msg.content}</Streamdown>
                </div>
              </div>
            ))}
            
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl px-6 py-4 shadow-md">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Usage Guide */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 mb-4 border border-primary/20">
          <h3 className="text-lg font-bold text-primary mb-3">💡 使い方ガイド</h3>
          <ol className="space-y-2 text-sm text-foreground mb-4">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary min-w-[1.5rem]">1.</span>
              <span>チャットでAIと対話し、アプリの要件を明確化します</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary min-w-[1.5rem]">2.</span>
              <span>上部の「要件定義書をダウンロード」ボタンで.mdファイルを取得します</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary min-w-[1.5rem]">3.</span>
              <span>下記のリンクから<strong>Manus1.5エージェントモード</strong>を開きます</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary min-w-[1.5rem]">4.</span>
              <span>ダウンロードした要件定義書を添付し、「このアプリを作って」と入力します</span>
            </li>
          </ol>
          <a
            href="https://app.manus.im"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:from-primary/90 hover:to-primary/70 transition-all shadow-md hover:shadow-lg"
          >
            <span>🚀 Manus1.5エージェントモードを開く</span>
          </a>
        </div>

        {/* Input Area - Enlarged */}
        <div className="bg-card/80 backdrop-blur rounded-2xl p-4 shadow-lg border border-primary/20">
          <div className="flex gap-3">
            <Button
              onClick={toggleVoiceInput}
              disabled={!conversationId || chatMutation.isPending}
              size="lg"
              variant={isListening ? "destructive" : "outline"}
              className="h-16 px-6"
            >
              {isListening ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </Button>
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
              disabled={!conversationId || chatMutation.isPending}
              className="flex-1 h-16 text-lg px-6 bg-background/50 border-primary/30 focus:border-primary"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || chatMutation.isPending}
              size="lg"
              className="h-16 px-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {chatMutation.isPending ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Send className="w-6 h-6" />
              )}
            </Button>
          </div>
          

        </div>

        {/* Footer Catchphrases */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            💡 アイデアを形に | 🚀 アプリで稼ぐ | ✨ マネタイズを実現
          </p>
        </div>
      </div>
    </div>
  );
}
