/*
  # Create comments table

  1. New Tables
    - `comments`
      - `id` (uuid, primary key)
      - `post_id` (uuid, references posts)
      - `user_id` (uuid, references profiles)
      - `content` (text)
      - `parent_id` (uuid, references comments)
      - `likes` (text[])
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `comments` table
    - Add policy for authenticated users to manage their comments
*/

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES comments(id),
  likes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view comments"
  ON comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own comments"
  ON comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);