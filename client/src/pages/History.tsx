import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, MessageSquare, Plus, Trash2, Download } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: conversations, isLoading, refetch } = trpc.conversation.list.useQuery(
    undefined,
    { enabled: !!user }
  );
  const { data: specifications, isLoading: specsLoading } = trpc.specification.list.useQuery(
    undefined,
    { enabled: !!user }
  );
  const deleteConversation = trpc.conversation.delete.useMutation();
  const createConversation = trpc.conversation.create.useMutation();
  const generateSpecMutation = trpc.specification.generate.useMutation();

  const handleDownloadSpec = async (conversationId: number) => {
    toast.info('要件定義書を生成中...');
    
    generateSpecMutation.mutate(
      { conversationId },
      {
        onSuccess: (data) => {
          const spec = data.specification;
          const appName = spec.appName || 'アプリ';
          const mdContent = `# ${appName} - 要件定義書

${spec.manusPrompt || ''}
`;
          
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

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  const handleDeleteConversation = async (id: number) => {
    if (!confirm("この会話を削除してもよろしいですか?")) return;

    deleteConversation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("会話を削除しました");
          refetch();
        },
        onError: (error) => {
          toast.error("エラーが発生しました: " + error.message);
        },
      }
    );
  };

  const handleNewConversation = async () => {
    createConversation.mutate(undefined, {
      onSuccess: (data) => {
        setLocation(`/chat?id=${data.id}`);
      },
      onError: (error) => {
        toast.error("エラーが発生しました: " + error.message);
      },
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">会話履歴</h1>
            <Button onClick={handleNewConversation} disabled={createConversation.isPending}>
              {createConversation.isPending ? (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              ) : (
                <Plus className="mr-2 w-4 h-4" />
              )}
              新しい会話
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Conversations */}
          <div>
            <h2 className="text-lg font-semibold mb-4">会話</h2>
            {conversations && conversations.length > 0 ? (
              <div className="space-y-4">
                {conversations.map((conversation) => {
                  // Extract title from first user message
                  const firstUserMessage = conversation.conversationData.messages.find(
                    (msg: any) => msg.role === 'user'
                  );
                  const title = firstUserMessage 
                    ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
                    : '新しい会話';
                  
                  return (
                    <Card key={conversation.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => setLocation(`/chat?id=${conversation.id}`)}>
                          <div className="flex items-center gap-3">
                            <MessageSquare className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-medium">{title}</p>
                              <p className="text-sm text-muted-foreground">
                                {conversation.conversationData.messages.length}件のメッセージ · {new Date(conversation.lastUpdated).toLocaleString('ja-JP')}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadSpec(conversation.id);
                            }}
                            disabled={generateSpecMutation.isPending || conversation.conversationData.messages.length < 5}
                            title={conversation.conversationData.messages.length < 5 ? 'もう少し会話を進めてください' : '要件定義書をダウンロード'}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conversation.id);
                            }}
                            disabled={deleteConversation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">まだ会話がありません</p>
                <Button onClick={handleNewConversation}>新しい会話を始める</Button>
              </Card>
            )}
          </div>

          {/* Specifications */}
          <div>
            <h2 className="text-lg font-semibold mb-4">生成した仕様書</h2>
            {specifications && specifications.length > 0 ? (
              <div className="space-y-4">
                {specifications.map((spec) => (
                  <Card
                    key={spec.id}
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setLocation(`/specification/${spec.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{spec.appName}</p>
                        <p className="text-sm text-muted-foreground">
                          バージョン {spec.version} - {new Date(spec.createdAt).toLocaleString('ja-JP')}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">まだ仕様書がありません</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
