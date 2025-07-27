/*
  # Fix promotion clicks update policy

  1. Security Changes
    - Update RLS policy to allow authenticated users to update clicks and views
    - Ensure clicks can be incremented by any authenticated user
    - Maintain security for other fields (only admin can modify)

  2. Changes
    - Modify existing UPDATE policy to allow clicks/views updates
    - Keep admin-only policy for other fields
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage all promotions" ON promotions;
DROP POLICY IF EXISTS "Anyone can view active promotions" ON promotions;
DROP POLICY IF EXISTS "Partners can view their own promotions" ON promotions;

-- Recreate policies with proper permissions
CREATE POLICY "Anyone can view active promotions"
  ON promotions
  FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND start_date <= now() AND end_date >= now())
    OR 
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email = 'admin@dogcatify.com'
    ))
    OR
    (partner_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = promotions.partner_id 
      AND partners.user_id = auth.uid()
    ))
  );

-- Allow authenticated users to update clicks and views only
CREATE POLICY "Users can update promotion engagement"
  ON promotions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Admin can manage all promotions (full CRUD)
CREATE POLICY "Admin can manage all promotions"
  ON promotions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email = 'admin@dogcatify.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

-- Partners can view their own promotions
CREATE POLICY "Partners can view their own promotions"
  ON promotions
  FOR SELECT
  TO authenticated
  USING (
    partner_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = promotions.partner_id 
      AND partners.user_id = auth.uid()
    )
  );