-- Brand per deployment (National Tours on nationaltours.uz, Gulistan Travel on gulistantravel.uz), 2026-11-28.
-- db.mjs replaces __BRAND_NAME__ / __BRAND_EMAIL__ with the deployment's brand (NEXT_PUBLIC_BRAND), so
-- older names left in stored settings and catalogue text follow the brand of this database. Text the
-- owner wrote by hand without those names is untouched; the contact email is filled only when empty.
UPDATE settings SET value = replace(replace(replace(replace(replace(value,
    'your Silk Road travel assistant', 'the __BRAND_NAME__ assistant'),
    'Silk Road assistant', '__BRAND_NAME__ assistant'),
    'Silk Road Tours', '__BRAND_NAME__'),
    'National Tours', '__BRAND_NAME__'),
    'Gulistan Travel', '__BRAND_NAME__')
  WHERE key IN ('ai', 'contact');
UPDATE settings SET value = json_set(value, '$.agencyName', '__BRAND_NAME__')
  WHERE key = 'contact' AND coalesce(json_extract(value, '$.agencyName'), '') = '';
UPDATE settings SET value = json_set(value, '$.email', '__BRAND_EMAIL__')
  WHERE key = 'contact' AND coalesce(json_extract(value, '$.email'), '') = '' AND '__BRAND_EMAIL__' <> '';
UPDATE faq_items SET
    question = replace(replace(question, 'National Tours', '__BRAND_NAME__'), 'Gulistan Travel', '__BRAND_NAME__'),
    answer = replace(replace(answer, 'National Tours', '__BRAND_NAME__'), 'Gulistan Travel', '__BRAND_NAME__')
  WHERE question LIKE '%National Tours%' OR answer LIKE '%National Tours%' OR question LIKE '%Gulistan Travel%' OR answer LIKE '%Gulistan Travel%';
UPDATE content_items SET
    title = replace(replace(title, 'National Tours', '__BRAND_NAME__'), 'Gulistan Travel', '__BRAND_NAME__'),
    excerpt = replace(replace(excerpt, 'National Tours', '__BRAND_NAME__'), 'Gulistan Travel', '__BRAND_NAME__'),
    body = replace(replace(body, 'National Tours', '__BRAND_NAME__'), 'Gulistan Travel', '__BRAND_NAME__')
  WHERE title LIKE '%National Tours%' OR excerpt LIKE '%National Tours%' OR body LIKE '%National Tours%'
     OR title LIKE '%Gulistan Travel%' OR excerpt LIKE '%Gulistan Travel%' OR body LIKE '%Gulistan Travel%';
