-- Links a booking to the traveller's account when it was sent while signed in (account id from the accounts service).
ALTER TABLE bookings ADD COLUMN account_id text;
CREATE INDEX IF NOT EXISTS bookings_account_idx ON bookings (account_id);
