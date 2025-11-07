import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Send, Loader2, Trash2, Download } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function Chat() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
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
  }, [user, conversationId, conversationCreated]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.conversationData.messages]);

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast.error('メッセージを入力してください');
      return;
    }
    
    if (!conversationId) {
      toast.error('会話の初期化中です。しばらくお待ちください。');
      return;
    }

    const userMessage = message;
    setMessage("");

    console.log('Sending message:', userMessage, 'to conversation:', conversationId);

    chatMutation.mutate(
      {
        conversationId,
        userMessage,
      },
      {
        onSuccess: (data) => {
          console.log('Message sent successfully:', data);
          refetchConversation();
        },
        onError: (error) => {
          console.error('Failed to send message:', error);
          toast.error("エラーが発生しました: " + error.message);
          setMessage(userMessage); // Restore message on error
        },
      }
    );
  };

  const handleClearChat = () => {
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

  const handleDownloadSpec = async () => {
    if (!conversationId) {
      toast.error('まず会話を開始してください');
      return;
    }

    if (!conversation || conversation.conversationData.messages.length < 5) {
      toast.error('もう少し質問に答えてから要件定義書を生成してください');
      return;
    }

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Architect - アプリ設計支援AI</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSpec}
                disabled={generateSpecMutation.isPending || !conversationId}
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
              <Button variant="ghost" size="sm" onClick={logout}>
                ログアウト
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 container py-6 flex flex-col max-w-4xl">
        <ScrollArea className="flex-1 mb-4" ref={scrollRef}>
          <div className="space-y-4 pr-4">
            {!conversation?.conversationData.messages.length && (
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold mb-4">Architectへようこそ!</h2>
                <p className="text-muted-foreground mb-4">
                  あなたのアイデアを実装可能な要件定義書に変えます。
                </p>
                <p className="text-sm text-muted-foreground">
                  質問に答えるだけで、Manus1.5で使えるプロンプトが完成します。<br />
                  認証、データベース、デザイン、技術要件など、必要な情報を全て収集します。
                </p>
                <p className="text-lg font-semibold mt-6">
                  どんなアプリを作りたいですか?
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  例: 「ダイエット記録アプリ」「消える手紙アプリ」「タスク管理ツール」
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

        {/* Input Area */}
        <div className="border-t pt-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-muted-foreground mb-2">
              Debug: conversationId={conversationId || 'null'}, 
              isPending={createConversation.isPending ? 'true' : 'false'},
              chatPending={chatMutation.isPending ? 'true' : 'false'}
            </div>
          )}
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
              disabled={chatMutation.isPending || !conversationId}
              className="flex-1"
            />
            <Button
              onClick={() => {
                console.log('Send button clicked', { message, conversationId });
                handleSendMessage();
              }}
              disabled={!message.trim() || chatMutation.isPending || !conversationId}
              size="icon"
              title={!conversationId ? '会話の初期化中...' : '送信'}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
