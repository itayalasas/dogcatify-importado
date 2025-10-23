/*
  # Create Application Configuration Table

  1. New Tables
    - `app_config`
      - `id` (uuid, primary key)
      - `key` (text, unique) - Configuration key name
      - `value` (jsonb) - Configuration value (supports any JSON type)
      - `description` (text) - Human-readable description
      - `is_public` (boolean) - Whether config is public or requires auth
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `app_config` table
    - Public configs readable by anyone (is_public = true)
    - Private configs only readable by authenticated users
    - All authenticated users can read configs
    - Anyone can insert/update/delete for now (can be restricted later)

  3. Initial Configuration
    - Seed common configuration values
*/

-- Create app_config table
CREATE TABLE IF NOT EXISTS app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Public configs can be read by anyone
CREATE POLICY "Anyone can read public configs"
  ON app_config
  FOR SELECT
  USING (is_public = true);

-- Authenticated users can read all configs
CREATE POLICY "Authenticated users can read all configs"
  ON app_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can manage configs (you can restrict this later)
CREATE POLICY "Authenticated users can insert configs"
  ON app_config
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update configs"
  ON app_config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete configs"
  ON app_config
  FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_app_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_app_config_updated_at ON app_config;

CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_app_config_updated_at();

-- Seed initial configurations
INSERT INTO app_config (key, value, description, is_public) VALUES
  ('email_api_url', '"https://qhxnubuxjtlsvqgxhpfl.supabase.co/functions/v1/send-email"', 'Email API endpoint URL', false),
  ('email_api_key', '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoeG51YnV4anRsc3ZxZ3hocGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk4MTc3NzMsImV4cCI6MjA0NTM5Mzc3M30.GFXrZGHzevh21eIEy-gq6VZxq58wBgwsz_iRVS6m9iU"', 'Email API authentication key', false),
  ('mercadopago_public_key', '""', 'MercadoPago public key for payments', false),
  ('app_name', '"DogCatify"', 'Application name', true),
  ('support_email', '"support@dogcatify.com"', 'Support email address', true),
  ('max_file_upload_size', '10485760', 'Maximum file upload size in bytes (10MB)', true),
  ('enable_notifications', 'true', 'Enable push notifications feature', true)
ON CONFLICT (key) DO NOTHING;