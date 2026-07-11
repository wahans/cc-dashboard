alter table sync_log
add column if not exists details jsonb;

update amex_offers
set active = false
where lower(regexp_replace(merchant, '[^a-zA-Z0-9]', '', 'g')) = 'membershiprewardsbonuspointsoffer';
