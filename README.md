# VisionClinic（視機能評価・ビジョントレーニング）

スマホカメラで眼球運動を読み取り、両眼視機能（輻輳）を評価して個別トレーニングを自動処方するアプリ。

## 主要機能
- 患者管理
- 眼球運動検査（MediaPipe Face Landmarker で虹彩トラッキング）
- 視機能チェックリスト（約30項目）
- AI処方（Claude Haiku 4.5）
- ビジョントレーニング
  - 追従（滑動性眼球運動）
  - 跳躍（サッケード）
  - 輻輳トレーニング
  - 周辺視野
  - アイストレッチ
- メトロノーム内蔵（58 BPM基準、10刻み可変）
- 動画撮影・保存
- 印刷レポート

## 技術スタック
- Next.js 16 + TypeScript + Tailwind CSS v4
- Supabase（vzkfkazjylrkspqrnhnx）
- MediaPipe Face Landmarker（虹彩中心含む478ランドマーク）
- Claude Haiku 4.5 API（処方生成）

## 共同開発
二葉先生との共同プロジェクト（ビジョントレーニング・斜位評価・スポーツ分野の知見を反映）

## セットアップ
```bash
npm install
# .env.local に以下を設定
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
# ANTHROPIC_API_KEY=
npm run dev
```

## DB初期化
Supabase SQL Editor で `supabase_schema.sql` を実行。
