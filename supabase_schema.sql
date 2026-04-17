-- ==========================================================
-- VisionClinic V2 スキーマ（視機能評価・ビジョントレーニングアプリ）
-- 二葉先生設計: 30項目チェック・7項目カメラ・3モード・プロモード・安全基準
-- ==========================================================

-- 院テーブル
CREATE TABLE IF NOT EXISTS vc_clinics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 患者
CREATE TABLE IF NOT EXISTS vc_patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male','female','other')),
  phone TEXT,
  occupation TEXT,
  wears_glasses BOOLEAN DEFAULT false,
  age_group TEXT CHECK (age_group IN ('child','adult','elderly')) DEFAULT 'adult',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 視機能評価（検査結果）
CREATE TABLE IF NOT EXISTS vision_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES vc_patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL,
  assessed_at TIMESTAMPTZ DEFAULT now(),

  -- 輻輳（近点集中）
  convergence_left_displacement_mm NUMERIC,
  convergence_right_displacement_mm NUMERIC,
  convergence_asymmetry_ratio NUMERIC,
  convergence_near_point_cm NUMERIC,
  focus_hold_at_apex BOOLEAN,

  -- カメラ7項目全自動評価（V2）
  eval_convergence JSONB,       -- {score, level, rawValue, unit, details}
  eval_divergence JSONB,
  eval_fixation JSONB,
  eval_pursuit JSONB,
  eval_saccade JSONB,
  eval_blink JSONB,
  eval_head_compensation JSONB,
  camera_total_score NUMERIC,
  camera_total_level TEXT CHECK (camera_total_level IN ('normal','mild','moderate','impaired')),

  -- 追従・跳躍（旧: 手動入力。V2ではカメラ自動が優先）
  pursuit_smoothness TEXT CHECK (pursuit_smoothness IN ('good','fair','poor')),
  saccade_accuracy TEXT CHECK (saccade_accuracy IN ('good','fair','poor')),

  -- チェックリスト
  checklist_scores JSONB,       -- {a:[...], b:[...], c:[...], note:""}
  checklist_total INTEGER,
  checklist_level TEXT CHECK (checklist_level IN ('normal','mild','moderate','impaired')),

  -- 総合判定
  function_level TEXT CHECK (function_level IN ('normal','mild','moderate','impaired')),
  recommended_mode TEXT CHECK (recommended_mode IN ('vision','athlete','deskwork')),

  -- 動画・メモ
  video_url TEXT,
  therapist_note TEXT,

  -- AI処方結果
  ai_analysis JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ビジョントレーニング種目マスタ（V2: 10種）
CREATE TABLE IF NOT EXISTS vision_exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('pursuit','saccade','convergence','peripheral','eye_stretch','balance')),
  difficulty TEXT CHECK (difficulty IN ('beginner','intermediate','advanced')),
  default_bpm INTEGER,
  duration_sec INTEGER,
  description TEXT,
  instruction TEXT,
  image_url TEXT,
  video_url TEXT,
  priority_order INTEGER,       -- 優先順位（1が最優先）
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 施術提案ルール（二葉先生の知見ベース、管理画面から編集可能）
CREATE TABLE IF NOT EXISTS vc_treatment_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID,               -- NULL = 全院共通（デフォルトルール）
  trigger_eval TEXT NOT NULL CHECK (trigger_eval IN ('convergence','divergence','fixation','pursuit','saccade','blink','headCompensation')),
  trigger_level TEXT NOT NULL CHECK (trigger_level IN ('mild','moderate','impaired')),
  treatments TEXT[] NOT NULL,   -- 施術内容の配列
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 処方プラン
CREATE TABLE IF NOT EXISTS vision_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES vc_patients(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES vision_assessments(id),
  clinic_id UUID NOT NULL,
  training_mode TEXT CHECK (training_mode IN ('vision','athlete','deskwork')),
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  therapist_note TEXT,
  ai_generated_plan JSONB
);

CREATE TABLE IF NOT EXISTS vision_plan_exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES vision_plans(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES vision_exercises(id),
  display_order INTEGER,
  target_bpm INTEGER,
  duration_sec INTEGER DEFAULT 60
);

-- ==========================================================
-- RLS 有効化
-- ==========================================================
ALTER TABLE vc_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_plan_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE vc_clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE vc_treatment_rules ENABLE ROW LEVEL SECURITY;

-- 種目マスタは全員が読める
DROP POLICY IF EXISTS "public_read_vision_exercises" ON vision_exercises;
CREATE POLICY "public_read_vision_exercises" ON vision_exercises FOR SELECT USING (true);

-- 施術提案ルール: 自院 or 共通ルールが読める
DROP POLICY IF EXISTS "read_treatment_rules" ON vc_treatment_rules;
CREATE POLICY "read_treatment_rules" ON vc_treatment_rules FOR SELECT
  USING (clinic_id IS NULL OR clinic_id = (SELECT id FROM vc_clinics WHERE owner_user_id = auth.uid() LIMIT 1));

-- 施術提案ルール: 自院のルールのみ編集可
DROP POLICY IF EXISTS "manage_treatment_rules" ON vc_treatment_rules;
CREATE POLICY "manage_treatment_rules" ON vc_treatment_rules FOR ALL
  USING (clinic_id = (SELECT id FROM vc_clinics WHERE owner_user_id = auth.uid() LIMIT 1))
  WITH CHECK (clinic_id = (SELECT id FROM vc_clinics WHERE owner_user_id = auth.uid() LIMIT 1));

-- 院別データのRLS
DROP POLICY IF EXISTS "clinic_vc_patients" ON vc_patients;
CREATE POLICY "clinic_vc_patients" ON vc_patients FOR ALL
  USING (clinic_id = (SELECT id FROM vc_clinics WHERE owner_user_id = auth.uid() LIMIT 1))
  WITH CHECK (clinic_id = (SELECT id FROM vc_clinics WHERE owner_user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "clinic_vision_assessments" ON vision_assessments;
CREATE POLICY "clinic_vision_assessments" ON vision_assessments FOR ALL
  USING (clinic_id = (SELECT id FROM vc_clinics WHERE owner_user_id = auth.uid() LIMIT 1))
  WITH CHECK (clinic_id = (SELECT id FROM vc_clinics WHERE owner_user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "clinic_vision_plans" ON vision_plans;
CREATE POLICY "clinic_vision_plans" ON vision_plans FOR ALL
  USING (clinic_id = (SELECT id FROM vc_clinics WHERE owner_user_id = auth.uid() LIMIT 1))
  WITH CHECK (clinic_id = (SELECT id FROM vc_clinics WHERE owner_user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "clinic_vision_plan_exercises" ON vision_plan_exercises;
CREATE POLICY "clinic_vision_plan_exercises" ON vision_plan_exercises FOR ALL
  USING (plan_id IN (SELECT id FROM vision_plans WHERE clinic_id = (SELECT id FROM vc_clinics WHERE owner_user_id = auth.uid() LIMIT 1)));

DROP POLICY IF EXISTS "clinic_vc_clinics_self" ON vc_clinics;
CREATE POLICY "clinic_vc_clinics_self" ON vc_clinics FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- ==========================================================
-- 初期データ: ビジョントレーニング10種目（二葉先生設計・優先順位つき）
-- ==========================================================
DELETE FROM vision_exercises;

INSERT INTO vision_exercises (name, category, difficulty, default_bpm, duration_sec, priority_order, description, instruction) VALUES
-- 1位: 遠近切替（輻輳・開散）
('遠近切替（輻輳・開散）','convergence','beginner',NULL,60,1,
 '寄り目と遠くを見る切り替えを繰り返し、輻輳と開散のバランスを改善する基本トレーニング',
 '腕を伸ばしてペン先を見る→ゆっくり鼻先まで近づける→再び腕を伸ばす。両目で1本に見え続けることを確認しながら繰り返す'),

-- 2位: ゆっくり追従
('ゆっくり追従','pursuit','beginner',48,60,2,
 'ゆっくり動くターゲットを目だけで追い、滑動性眼球運動の質を高める',
 '顔を動かさず目だけでゆっくり動くターゲットを追う。頭が動きそうなら顎に手を添える。水平→垂直の順で行う'),

-- 3位: 注視
('注視トレーニング','convergence','beginner',NULL,60,3,
 '1点を見つめ続ける力を鍛え、注視の安定性を高める',
 '画面中央のマークを30秒間じっと見つめる。目が逸れたら素早く戻す。逸脱回数をカウント'),

-- 4位: ジャンプコンバージェンス
('ジャンプコンバージェンス','convergence','intermediate',NULL,60,4,
 '近い点と遠い点を素早く切り替え、輻輳の瞬発力を鍛える',
 '手前20cmと腕を伸ばした位置に2つの点を置き、交互にジャンプして見る。両目で1本に見える速度を上げていく'),

-- 5位: デジタルストリング
('デジタルストリング','convergence','intermediate',NULL,60,5,
 'ブロックストリングのデジタル版。3点の奥行きに焦点を合わせ両眼視を強化',
 '画面上に手前・中間・奥の3つのビーズが表示される。順番に焦点を合わせ、X型の線が見えることを確認する'),

-- 6位: 水平サッカード
('水平サッカード','saccade','beginner',58,60,6,
 '左右2点間で視点を素早く正確に飛ばし、跳躍眼球運動の精度を高める',
 '30cm離した左右の点をメトロノームに合わせて交互に見る。オーバーシュートせず正確に到達することを意識'),

-- 7位: 円追従
('円追従','pursuit','intermediate',68,60,7,
 '円を描くように動くターゲットを追い、追従の滑らかさと方向転換を改善',
 '時計回り30秒→反時計回り30秒。滑らかさを重視。カクカクしたら速度を落とす'),

-- 8位: ランダムサッカード
('ランダムサッカード','saccade','advanced',88,60,8,
 'ランダム位置に出現するターゲットに素早く反応し、全方向のサッカード精度を鍛える',
 '画面のランダムな位置に出現するマークを素早く見る。反応時間と到達精度を測定'),

-- 9位: 周辺視野トレーニング
('周辺視野トレーニング','peripheral','intermediate',NULL,45,9,
 '中央を見たまま周辺の刺激に反応し、視野の広さと反応速度を改善',
 '画面中央の点を見続けながら、周辺に出るマークの位置を指で示す。中心視を外さないことがポイント'),

-- 10位: 視覚＋バランス連動
('視覚＋バランス連動','balance','advanced',NULL,60,10,
 '眼球運動と身体バランスを同時に行い、視覚-前庭-体性感覚の統合を強化',
 '片足立ちしながら画面のターゲットを追従する。安定したら目を閉じて5秒→開けて追従を繰り返す')

ON CONFLICT DO NOTHING;

-- ==========================================================
-- 初期データ: 施術提案ルール（二葉先生の臨床知見ベース）
-- ==========================================================
INSERT INTO vc_treatment_rules (clinic_id, trigger_eval, trigger_level, treatments, display_order) VALUES
-- 輻輳低下
(NULL, 'convergence', 'moderate', ARRAY['後頭下筋調整','上部頸椎調整','眼周囲筋アプローチ'], 1),
(NULL, 'convergence', 'impaired', ARRAY['後頭下筋調整','上部頸椎調整','眼周囲筋アプローチ','前頭筋・眼輪筋リリース'], 2),

-- 開散低下
(NULL, 'divergence', 'moderate', ARRAY['後頭下筋調整','上部頸椎モビライゼーション'], 3),
(NULL, 'divergence', 'impaired', ARRAY['後頭下筋調整','上部頸椎モビライゼーション','毛様体筋リラクゼーション（温熱）'], 4),

-- 注視不安定
(NULL, 'fixation', 'moderate', ARRAY['頸椎深層屈筋活性化','姿勢調整（頭位正中化）'], 5),
(NULL, 'fixation', 'impaired', ARRAY['頸椎深層屈筋活性化','姿勢調整（頭位正中化）','前庭系アプローチ'], 6),

-- 追従低下
(NULL, 'pursuit', 'moderate', ARRAY['胸鎖乳突筋リリース','僧帽筋上部リリース','頸椎可動域改善'], 7),
(NULL, 'pursuit', 'impaired', ARRAY['胸鎖乳突筋リリース','僧帽筋上部リリース','頸椎可動域改善','後頭下筋群アプローチ'], 8),

-- サッカード低下
(NULL, 'saccade', 'moderate', ARRAY['頸椎回旋可動域改善','眼球運動の神経促通'], 9),
(NULL, 'saccade', 'impaired', ARRAY['頸椎回旋可動域改善','眼球運動の神経促通','前庭眼反射トレーニング'], 10),

-- 瞬目異常
(NULL, 'blink', 'moderate', ARRAY['眼輪筋リラクゼーション','ドライアイ対策指導'], 11),
(NULL, 'blink', 'impaired', ARRAY['眼輪筋リラクゼーション','ドライアイ対策指導','自律神経調整（副交感優位化）'], 12),

-- 頭部代償
(NULL, 'headCompensation', 'moderate', ARRAY['姿勢調整','頸椎アライメント改善','体幹安定化'], 13),
(NULL, 'headCompensation', 'impaired', ARRAY['姿勢調整','頸椎アライメント改善','体幹安定化','頸椎深層筋トレーニング'], 14)

ON CONFLICT DO NOTHING;
