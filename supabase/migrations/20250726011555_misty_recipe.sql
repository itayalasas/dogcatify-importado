/*
  # Add promotion tracking functions

  1. Functions
    - increment_promotion_views: Increment view count for a promotion
    - increment_promotion_clicks: Increment click count for a promotion

  2. Security
    - Functions are accessible to authenticated users
*/

-- Function to increment promotion views
CREATE OR REPLACE FUNCTION increment_promotion_views(promotion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE promotions 
  SET views = COALESCE(views, 0) + 1
  WHERE id = promotion_id;
END;
$$;

-- Function to increment promotion clicks
CREATE OR REPLACE FUNCTION increment_promotion_clicks(promotion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE promotions 
  SET clicks = COALESCE(clicks, 0) + 1
  WHERE id = promotion_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_promotion_views(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_promotion_clicks(uuid) TO authenticated;</parameter>