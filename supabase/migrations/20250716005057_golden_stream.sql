/*
# Fix Partners RLS Policies

1. Security
  - Disable RLS temporarily to fix permissions
  - Add policy for admins to view all partners
  - Add policy for admins to update partner verification status
*/

-- Temporarily disable RLS to fix permissions
ALTER TABLE partners DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Add policy for admins to view all partners
CREATE POLICY "Admins can view all partners" 
ON partners
FOR SELECT 
TO authenticated
USING (
  auth.email() = 'admin@dogcatify.com' OR 
  (is_verified = true) OR 
  (auth.uid() = user_id)
);

-- Add policy for admins to update partner verification status
CREATE POLICY "Admins can update partner verification status" 
ON partners
FOR UPDATE 
TO authenticated
USING (
  auth.email() = 'admin@dogcatify.com' OR 
  (auth.uid() = user_id)
)
WITH CHECK (
  auth.email() = 'admin@dogcatify.com' OR 
  (auth.uid() = user_id)
);