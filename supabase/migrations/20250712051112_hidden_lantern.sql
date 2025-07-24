/*
  # Storage Policies for dogcatify bucket

  1. New Policies
    - Enable public read access to the dogcatify bucket
    - Allow authenticated users to upload files to the dogcatify bucket
    - Allow users to update and delete their own files
*/

-- Create the dogcatify bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('dogcatify', 'dogcatify', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to all files in the dogcatify bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'dogcatify');

-- Allow authenticated users to upload files to the dogcatify bucket
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dogcatify');

-- Allow users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'dogcatify' AND owner = auth.uid());

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'dogcatify' AND owner = auth.uid());