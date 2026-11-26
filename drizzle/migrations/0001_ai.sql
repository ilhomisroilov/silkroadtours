-- AI travel assistant, trip planner and admin audit tables.
CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  source TEXT NOT NULL DEFAULT 'assistant',
  page TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  booking_reference TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT "ai_conversations_source_ck" CHECK (source IN ('assistant','planner'))
);
CREATE INDEX ai_conversations_created_idx ON ai_conversations (created_at);
CREATE INDEX ai_conversations_ip_idx ON ai_conversations (ip_hash, created_at);

CREATE TABLE ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sources TEXT NOT NULL DEFAULT '[]',
  provider TEXT,
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT "ai_messages_role_ck" CHECK (role IN ('user','assistant')),
  CONSTRAINT "ai_messages_status_ck" CHECK (status IN ('ok','error','fallback','unanswered'))
);
CREATE INDEX ai_messages_conversation_idx ON ai_messages (conversation_id, id);
CREATE INDEX ai_messages_created_idx ON ai_messages (created_at, status);

CREATE TABLE ai_tool_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  conversation_id TEXT REFERENCES ai_conversations(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  input TEXT NOT NULL,
  ok INTEGER NOT NULL DEFAULT 1,
  result_count INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX ai_tool_logs_created_idx ON ai_tool_logs (created_at, tool);

CREATE TABLE ai_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  message_id INTEGER NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT "ai_feedback_rating_ck" CHECK (rating IN (-1, 1))
);

CREATE TABLE saved_trip_plans (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT REFERENCES ai_conversations(id) ON DELETE SET NULL,
  locale TEXT NOT NULL,
  request TEXT NOT NULL,
  plan TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX admin_audit_logs_created_idx ON admin_audit_logs (created_at);

-- Default assistant configuration (editable in Admin → AI). Secrets never live here.
INSERT OR IGNORE INTO settings (key, value) VALUES ('ai', '{"assistantName":"Silk Road assistant","temperature":0.4,"maxOutputTokens":900,"timeoutMs":20000,"perMinuteLimit":12,"retentionDays":90,"enabled":true,"welcome":{"en":"Hello! I''m your Silk Road travel assistant. Tell me what kind of journey you are planning, and I''ll help you discover Uzbekistan.","uz":"Assalomu alaykum! Men Silk Road Tours sayohat yordamchisiman. Qanday sayohat rejalashtiryapsiz? Oʻzbekistonni kashf qilishda yordam beraman.","ru":"Здравствуйте! Я ваш помощник по путешествиям Silk Road Tours. Расскажите, какую поездку вы планируете, и я помогу открыть Узбекистан."},"extraInstructions":""}');
