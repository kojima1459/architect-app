import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { ArrowRight, MessageSquare, FileText, Zap, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    setLocation("/chat");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="container py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-10 w-10" />}
            <h1 className="text-2xl font-bold text-foreground">{APP_TITLE}</h1>
          </div>
          <Button asChild>
            <a href={getLoginUrl()}>ログイン</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            <span>AI駆動のアプリ設計支援ツール</span>
          </div>
          
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            あなたのアイデアを<br />実装可能な仕様書に
          </h2>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            曖昧なアイデアを、わずか5分の対話でManus1.5で実装可能な完璧な仕様書に変換。
            必要最小限の質問で要件を引き出し、そのままManusエージェントに渡せるプロンプトを自動生成します。
          </p>
          
          <Button size="lg" className="text-lg px-8 py-6" asChild>
            <a href={getLoginUrl()}>
              今すぐ始める
              <ArrowRight className="ml-2 w-5 h-5" />
            </a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container py-20">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">主な機能</h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="text-xl font-semibold mb-2">対話型ヒアリング</h4>
              <p className="text-muted-foreground">
                5段階のフェーズで、アイデアの核心から技術的制約まで、AIが適切な質問で要件を引き出します。
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="text-xl font-semibold mb-2">設計書自動生成</h4>
              <p className="text-muted-foreground">
                機能一覧、画面遷移図、データベース設計など、完全な仕様書をリアルタイムで生成します。
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="text-xl font-semibold mb-2">Manusプロンプト生成</h4>
              <p className="text-muted-foreground">
                最終的に、Manusエージェントにそのまま渡せる3000文字以内の最適化されたプロンプトを生成します。
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container py-20 bg-gradient-to-r from-purple-50 to-blue-50 rounded-3xl">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">使い方</h3>
          
          <div className="space-y-8">
            {[
              {
                phase: "Phase 1",
                title: "アイデアの核心",
                description: "どんなアプリを作りたいか、ざっくりとした説明から始めます。AIが類似アプリを提示し、核心機能を推測します。"
              },
              {
                phase: "Phase 2",
                title: "ユーザー・用途",
                description: "誰が使うのか、どんな時に使うのかを明確にします。AIがユースケースを自動生成します。"
              },
              {
                phase: "Phase 3",
                title: "コア機能",
                description: "必須の機能を定義します。AIがMECE分析を行い、未回答の重要項目を質問します。"
              },
              {
                phase: "Phase 4",
                title: "デザイン・雰囲気",
                description: "アプリの雰囲気やデザインの方向性を選択します。参考アプリの提示も可能です。"
              },
              {
                phase: "Phase 5",
                title: "技術的制約",
                description: "期限や予算を確認し、AIが実現可能性を自動判定します。"
              }
            ].map((step, index) => (
              <div key={index} className="flex gap-6 items-start">
                <div className="phase-indicator phase-active flex-shrink-0">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm text-primary font-semibold mb-1">{step.phase}</div>
                  <h4 className="text-xl font-semibold mb-2">{step.title}</h4>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-4">
            今すぐアイデアを形にしましょう
          </h3>
          <p className="text-muted-foreground mb-8">
            5分の対話で、Manusで作れるプロンプトが完成します。
          </p>
          <Button size="lg" className="text-lg px-8 py-6" asChild>
            <a href={getLoginUrl()}>
              無料で始める
              <ArrowRight className="ml-2 w-5 h-5" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="container py-8 border-t">
        <div className="text-center text-sm text-muted-foreground">
          © 2025 {APP_TITLE}. Powered by Manus.
        </div>
      </footer>
    </div>
  );
}
