-- Rebrand to Gulistan Travel (gulistantravel.uz), 2026-11-28.
-- Rewrites the old brand names in stored settings and catalogue text, so the live database follows the
-- new name without a catalogue reset. Text the owner wrote by hand without the old names is untouched.
UPDATE settings SET value = replace(replace(replace(replace(value,
    'your Silk Road travel assistant', 'the Gulistan Travel assistant'),
    'Silk Road assistant', 'Gulistan Travel assistant'),
    'Silk Road Tours', 'Gulistan Travel'),
    'National Tours', 'Gulistan Travel')
  WHERE key IN ('ai', 'contact');
UPDATE settings SET value = json_set(value, '$.agencyName', 'Gulistan Travel')
  WHERE key = 'contact' AND coalesce(json_extract(value, '$.agencyName'), '') = '';
UPDATE settings SET value = json_set(value, '$.email', 'info@gulistantravel.uz')
  WHERE key = 'contact' AND coalesce(json_extract(value, '$.email'), '') = '';
UPDATE faq_items SET question = replace(question, 'National Tours', 'Gulistan Travel'), answer = replace(answer, 'National Tours', 'Gulistan Travel')
  WHERE question LIKE '%National Tours%' OR answer LIKE '%National Tours%';
UPDATE content_items SET title = replace(title, 'National Tours', 'Gulistan Travel'), excerpt = replace(excerpt, 'National Tours', 'Gulistan Travel'), body = replace(body, 'National Tours', 'Gulistan Travel')
  WHERE title LIKE '%National Tours%' OR excerpt LIKE '%National Tours%' OR body LIKE '%National Tours%';
