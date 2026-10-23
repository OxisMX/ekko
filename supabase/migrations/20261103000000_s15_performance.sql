-- S15 performance (measured in docs/ekko_rendimiento.md, dataset of scripts/perf/seed-scale.sql).

-- get_merchant_detail reads the stamps of one card by cycle_id; with ~630 k stamps and no index that
-- was a parallel seq scan (p50 29 ms, growing linearly with the table). Also serves the FK to card_cycles.
create index stamps_cycle_idx on public.stamps (cycle_id);
