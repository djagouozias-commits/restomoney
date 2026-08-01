-- Migration 008 : Autoriser entity_type = 'employe' dans sessions
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_entity_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_entity_type_check
  CHECK (entity_type IN ('structure', 'admin', 'employe'));
