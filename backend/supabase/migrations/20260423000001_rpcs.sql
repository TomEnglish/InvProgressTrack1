-- RPCs for ProgressTracker Rollups

CREATE OR REPLACE FUNCTION get_project_metrics(p_id uuid)
RETURNS TABLE (
  total_budget numeric,
  total_earned numeric,
  total_actual numeric,
  cpi numeric,
  spi numeric,
  sv numeric,
  percent_complete numeric,
  total_items integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(budget_hrs), 0) as total_budget,
    COALESCE(SUM(earned_hrs), 0) as total_earned,
    COALESCE(SUM(actual_hrs), 0) as total_actual,
    CASE WHEN SUM(actual_hrs) = 0 THEN 0 ELSE ROUND(SUM(earned_hrs) / SUM(actual_hrs), 2) END as cpi,
    CASE WHEN SUM(budget_hrs) = 0 THEN 0 ELSE ROUND(SUM(earned_hrs) / SUM(budget_hrs), 2) END as spi,
    COALESCE(SUM(earned_hrs), 0) - COALESCE(SUM(budget_hrs), 0) as sv,
    CASE WHEN SUM(budget_hrs) = 0 THEN 0 ELSE ROUND((SUM(earned_hrs) / SUM(budget_hrs)) * 100, 2) END as percent_complete,
    COUNT(*)::integer as total_items
  FROM progress_items
  WHERE project_id = p_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_discipline_metrics(p_id uuid)
RETURNS TABLE (
  discipline_id uuid,
  discipline_name text,
  total_budget numeric,
  total_earned numeric,
  total_actual numeric,
  percent_complete numeric,
  total_items integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    COALESCE(SUM(p.budget_hrs), 0) as total_budget,
    COALESCE(SUM(p.earned_hrs), 0) as total_earned,
    COALESCE(SUM(p.actual_hrs), 0) as total_actual,
    CASE WHEN SUM(p.budget_hrs) = 0 THEN 0 ELSE ROUND((SUM(p.earned_hrs) / SUM(p.budget_hrs)) * 100, 2) END as percent_complete,
    COUNT(p.id)::integer as total_items
  FROM disciplines d
  LEFT JOIN progress_items p ON p.discipline_id = d.id
  WHERE d.project_id = p_id
  GROUP BY d.id, d.name
  ORDER BY percent_complete DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_period_snapshot(p_id uuid, p_label text)
RETURNS void AS $$
DECLARE
  v_budget numeric;
  v_earned numeric;
  v_actual numeric;
  v_cpi numeric;
  v_spi numeric;
BEGIN
  SELECT 
    total_budget, total_earned, total_actual, cpi, spi
  INTO
    v_budget, v_earned, v_actual, v_cpi, v_spi
  FROM get_project_metrics(p_id);

  INSERT INTO period_snapshots (project_id, snapshot_date, label, total_budget, total_earned, total_actual, cpi, spi)
  VALUES (p_id, CURRENT_DATE, p_label, v_budget, v_earned, v_actual, v_cpi, v_spi);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
