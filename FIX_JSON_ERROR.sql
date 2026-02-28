-- ============================================================
-- FIX JSON ERROR IN AI ANALYSIS
-- Run this in Supabase SQL Editor to fix the JSON parsing error
-- ============================================================

-- First, let's check what's in the ai_analysis column
SELECT id, maintenance_request_id, ai_analysis 
FROM maintenance_workflows 
LIMIT 5;

-- Update all ai_analysis fields to ensure they are valid JSON
UPDATE maintenance_workflows
SET ai_analysis = jsonb_build_object(
    'category', COALESCE(ai_analysis->>'category', 'general'),
    'urgency', COALESCE(ai_analysis->>'urgency', 'medium'),
    'vendor_required', COALESCE((ai_analysis->>'vendor_required')::boolean, true),
    'estimated_cost_range', COALESCE(ai_analysis->>'estimated_cost_range', 'medium'),
    'reasoning', COALESCE(ai_analysis->>'reasoning', 'Requires professional attention'),
    'confidence_score', COALESCE((ai_analysis->>'confidence_score')::numeric, 0.85)
)
WHERE ai_analysis IS NOT NULL;

-- For any rows with null ai_analysis, set a default
UPDATE maintenance_workflows
SET ai_analysis = jsonb_build_object(
    'category', 'general',
    'urgency', 'medium', 
    'vendor_required', true,
    'estimated_cost_range', 'medium',
    'reasoning', 'Requires professional attention',
    'confidence_score', 0.85
)
WHERE ai_analysis IS NULL OR ai_analysis::text = '{}';

-- Verify the fix
SELECT id, ai_analysis, jsonb_pretty(ai_analysis) as pretty_json
FROM maintenance_workflows
LIMIT 5;