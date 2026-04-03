-- Ejecutar en Neon si ya tenías tablas sin user_id (una sola vez).

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Datos anteriores al login: no coinciden con ningún usuario de Clerk (puedes borrarlos o ignorarlos).
UPDATE reminders SET user_id = 'legacy_pre_auth' WHERE user_id IS NULL;
UPDATE push_subscriptions SET user_id = 'legacy_pre_auth' WHERE user_id IS NULL;

ALTER TABLE reminders ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders (user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);
