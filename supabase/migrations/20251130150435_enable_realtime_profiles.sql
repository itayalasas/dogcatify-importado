/*
  # Enable Realtime for profiles table

  1. Changes
    - Enable realtime replication for the profiles table
    - This allows Supabase Realtime to broadcast changes (INSERT, UPDATE, DELETE) to subscribed clients

  2. Purpose
    - Enable real-time updates for Dotty assistant visibility toggle
    - Allow instant UI updates when users change their Dotty preferences
*/

-- Enable realtime for profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
