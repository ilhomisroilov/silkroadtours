-- Uzbek spelling back to oʻ, gʻ, sh, ch (owner, 2026-11-28). A few sample rows (reviews, leads, lead notes)
-- were seeded in the new alphabet (ö, ğ, ş, ç); Uzbek itself has no other use of these letters, so the
-- mapping back is exact. Only Uzbek rows are touched.
UPDATE reviews SET
  title = replace(replace(replace(replace(replace(replace(replace(replace(title, 'ö', 'oʻ'), 'ğ', 'gʻ'), 'ş', 'sh'), 'ç', 'ch'), 'Ö', 'Oʻ'), 'Ğ', 'Gʻ'), 'Ş', 'Sh'), 'Ç', 'Ch'),
  body = replace(replace(replace(replace(replace(replace(replace(replace(body, 'ö', 'oʻ'), 'ğ', 'gʻ'), 'ş', 'sh'), 'ç', 'ch'), 'Ö', 'Oʻ'), 'Ğ', 'Gʻ'), 'Ş', 'Sh'), 'Ç', 'Ch')
  WHERE language = 'uz';
UPDATE leads SET
  title = replace(replace(replace(replace(replace(replace(replace(replace(title, 'ö', 'oʻ'), 'ğ', 'gʻ'), 'ş', 'sh'), 'ç', 'ch'), 'Ö', 'Oʻ'), 'Ğ', 'Gʻ'), 'Ş', 'Sh'), 'Ç', 'Ch'),
  interests = replace(replace(replace(replace(replace(replace(replace(replace(interests, 'ö', 'oʻ'), 'ğ', 'gʻ'), 'ş', 'sh'), 'ç', 'ch'), 'Ö', 'Oʻ'), 'Ğ', 'Gʻ'), 'Ş', 'Sh'), 'Ç', 'Ch')
  WHERE locale = 'uz';
UPDATE lead_activities SET
  text = replace(replace(replace(replace(replace(replace(replace(replace(text, 'ö', 'oʻ'), 'ğ', 'gʻ'), 'ş', 'sh'), 'ç', 'ch'), 'Ö', 'Oʻ'), 'Ğ', 'Gʻ'), 'Ş', 'Sh'), 'Ç', 'Ch')
  WHERE lead_id IN (SELECT id FROM leads WHERE locale = 'uz');
