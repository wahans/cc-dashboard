-- Enable RLS on all public tables
-- Service role key bypasses RLS, so all server-side access continues to work unchanged.
-- This blocks direct PostgREST access via the anon key.

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amex_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amex_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrolled_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
