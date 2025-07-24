/*
  # Create posts table

  1. New Tables
    - `posts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `pet_id` (uuid, references pets)
      - `content` (text)
      - `image_url` (text)
      - `album_images` (text[])
      - `likes` (text[])
      - `type` (text)
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `posts` table
    - Add policy for authenticated users to manage their posts
*/

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  pet_id UUID REFERENCES pets(id) NOT NULL,
  content TEXT,
  image_url TEXT,
  album_images TEXT[] DEFAULT '{}',
  likes TEXT[] DEFAULT '{}',
  type TEXT DEFAULT 'single',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view posts"
  ON posts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own posts"
  ON posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);