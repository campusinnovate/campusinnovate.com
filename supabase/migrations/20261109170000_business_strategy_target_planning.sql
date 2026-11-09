alter table public.business_strategies
  add column baseline_value numeric,
  add column metric_direction text not null default 'increase' check (metric_direction in ('increase', 'decrease')),
  add column target_basis text not null default 'historical' check (target_basis in ('historical', 'pipeline', 'capacity', 'commitment', 'experiment', 'other')),
  add column target_rationale text,
  add column leading_indicator text,
  add column guardrail_value numeric,
  add column assumptions text,
  add column review_cadence text not null default 'monthly' check (review_cadence in ('weekly', 'monthly', 'quarterly')),
  add column checkpoints jsonb not null default '[]'::jsonb check (jsonb_typeof(checkpoints) = 'array');

alter table public.business_strategies
  add constraint business_strategies_baseline_nonnegative check (baseline_value is null or baseline_value >= 0),
  add constraint business_strategies_guardrail_nonnegative check (guardrail_value is null or guardrail_value >= 0);
