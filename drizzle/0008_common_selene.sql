ALTER TABLE "feedback_tag" ADD COLUMN "icon" text;
--> statement-breakpoint
-- Only untouched default names receive icons/renames; retain custom names and availability.
-- If a desired name belongs to another tag, retain the legacy name and its assignments.
UPDATE feedback_tag AS tag
SET name = CASE WHEN EXISTS (
  SELECT 1 FROM feedback_tag other WHERE lower(other.name) = lower(defaults.name) AND other.id <> tag.id
) THEN tag.name ELSE defaults.name END,
icon = defaults.icon
FROM (VALUES
('10000000-0000-4000-8000-000000000001'::uuid, 'Gameplay', 'Gameplay', '🕹️'),
('10000000-0000-4000-8000-000000000002'::uuid, 'UI', 'UI', '💻'),
('10000000-0000-4000-8000-000000000003'::uuid, 'Class-specific', 'Class Specific', '🧙'),
('10000000-0000-4000-8000-000000000004'::uuid, 'Combat', 'Combat', '⚔️'),
('10000000-0000-4000-8000-000000000005'::uuid, '$$$', 'Marketplace', '🛍️')
) AS defaults(id, old_name, name, icon)
WHERE tag.id = defaults.id AND tag.name = defaults.old_name;
--> statement-breakpoint
-- Existing custom names or reserved IDs win; never merge or replace their assignments.
INSERT INTO feedback_tag (id, name, icon) VALUES
('10000000-0000-4000-8000-000000000006', 'Items', '🏹'),
('10000000-0000-4000-8000-000000000007', 'Zones', '🗺️'),
('10000000-0000-4000-8000-000000000008', 'Visuals', '👁️'),
('10000000-0000-4000-8000-000000000009', 'Audio', '🔊'),
('10000000-0000-4000-8000-000000000010', 'Events', '🎉'),
('10000000-0000-4000-8000-000000000011', 'Spells/Abilities', '🪄'),
('10000000-0000-4000-8000-000000000012', 'Quests', '📜'),
('10000000-0000-4000-8000-000000000013', 'Other', '👉')
ON CONFLICT DO NOTHING;
