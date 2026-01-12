-- ユーザーステータステーブル
-- ユーザーの現在のアクティビティ状態を管理

CREATE TABLE IF NOT EXISTS user_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline', -- 'online', 'measuring', 'idle', 'offline'
  current_category TEXT, -- 計測中のカテゴリ（measuring時のみ）
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_status ON user_status(status);
CREATE INDEX IF NOT EXISTS idx_user_status_last_active ON user_status(last_active_at);

-- RLS (Row Level Security) ポリシー設定
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- 誰でも全ユーザーのステータスを読み取り可能
CREATE POLICY "Anyone can read user_status" ON user_status
  FOR SELECT
  USING (true);

-- 自分のステータスのみ更新可能
CREATE POLICY "Users can update own status" ON user_status
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 自分のステータスのみ挿入可能
CREATE POLICY "Users can insert own status" ON user_status
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 自分のステータスのみ削除可能
CREATE POLICY "Users can delete own status" ON user_status
  FOR DELETE
  USING (auth.uid() = user_id);

-- 更新時刻を自動更新する関数
CREATE OR REPLACE FUNCTION update_user_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー設定
DROP TRIGGER IF EXISTS update_user_status_updated_at ON user_status;
CREATE TRIGGER update_user_status_updated_at
  BEFORE UPDATE ON user_status
  FOR EACH ROW
  EXECUTE FUNCTION update_user_status_updated_at();
