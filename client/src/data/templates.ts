export interface AppTemplate {
  id: string;
  title: string;
  icon: string;
  description: string;
  initialPrompt: string;
  color: string;
}

export const appTemplates: AppTemplate[] = [
  {
    id: "sns",
    title: "SNS・コミュニティ",
    icon: "📱",
    description: "ユーザー同士が交流できるSNSアプリ",
    color: "from-blue-500 to-purple-500",
    initialPrompt: "InstagramやTwitterのようなSNS・コミュニティアプリを作りたいです。ユーザー同士が投稿を共有したり、フォローしたり、コメントやいいねができる機能を持つアプリを想定しています。",
  },
  {
    id: "ecommerce",
    title: "ECサイト・ショップ",
    icon: "🛒",
    description: "商品を販売するオンラインストア",
    color: "from-green-500 to-emerald-500",
    initialPrompt: "Amazonや楽天のようなECサイト・オンラインショップを作りたいです。商品の閲覧、カート機能、決済、注文管理などの機能を持つアプリを想定しています。",
  },
  {
    id: "todo",
    title: "タスク管理・TODO",
    icon: "✅",
    description: "やることを管理するタスクアプリ",
    color: "from-orange-500 to-red-500",
    initialPrompt: "TodoistやTrelloのようなタスク管理・TODOアプリを作りたいです。タスクの作成、完了、期限設定、カテゴリ分けなどの機能を持つアプリを想定しています。",
  },
  {
    id: "business",
    title: "業務管理・ダッシュボード",
    icon: "📊",
    description: "ビジネスデータを可視化する管理ツール",
    color: "from-indigo-500 to-blue-500",
    initialPrompt: "SalesforceやNotionのような業務管理・ダッシュボードアプリを作りたいです。データの可視化、レポート作成、チーム管理などの機能を持つアプリを想定しています。",
  },
  {
    id: "learning",
    title: "学習・教育アプリ",
    icon: "🎓",
    description: "学習コンテンツを提供する教育プラットフォーム",
    color: "from-pink-500 to-rose-500",
    initialPrompt: "UdemyやCourseraのような学習・教育アプリを作りたいです。コース管理、動画視聴、クイズ、進捗管理などの機能を持つアプリを想定しています。",
  },
  {
    id: "finance",
    title: "家計簿・資産管理",
    icon: "💰",
    description: "お金の管理をサポートする財務アプリ",
    color: "from-yellow-500 to-amber-500",
    initialPrompt: "Money ForwardやZaimのような家計簿・資産管理アプリを作りたいです。収支の記録、カテゴリ分類、グラフ表示、予算管理などの機能を持つアプリを想定しています。",
  },
];
