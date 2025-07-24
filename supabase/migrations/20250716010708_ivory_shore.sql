/*
  # Fix partner verification policies

  1. Changes
    - Add policy to allow authenticated users to view their own partner profiles
    - Add policy to allow admin to view all partner profiles
    - Add policy to allow admin to update partner verification status
*/

-- Allow users to view their own partner profiles
CREATE POLICY "Users can view their own partner profiles"
  ON partners
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow admin to view all partner profiles
CREATE POLICY "Admin can view all partner profiles"
  ON partners
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@dogcatify.com');

-- Allow admin to update partner verification status
CREATE POLICY "Admin can update partner verification status"
  ON partners
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@dogcatify.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@dogcatify.com');