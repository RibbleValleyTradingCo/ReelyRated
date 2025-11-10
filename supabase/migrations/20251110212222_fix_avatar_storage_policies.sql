-- Fix avatar storage bucket policies to prevent unauthorized access
-- Issue: Users could delete or update other users' avatars
-- Fix: Add ownership check using storage.foldername() function

-- Drop existing insecure policies
DROP POLICY IF EXISTS "Users can update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their avatars" ON storage.objects;

-- Create secure policies with ownership checks
-- Users can only update avatars in their own folder (user_id matches folder name)
CREATE POLICY "Users can update only their own avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only delete avatars in their own folder (user_id matches folder name)
CREATE POLICY "Users can delete only their own avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verification: Test that policies work correctly
-- Example path structure: avatars/{user_id}/{filename}
-- storage.foldername('avatars/uuid-here/photo.jpg') returns ['uuid-here', 'photo.jpg']
-- We check if [1] (first folder) equals the authenticated user's ID

COMMENT ON POLICY "Users can update only their own avatars" ON storage.objects IS
  'Prevents users from updating avatars that do not belong to them by checking folder ownership';

COMMENT ON POLICY "Users can delete only their own avatars" ON storage.objects IS
  'Prevents users from deleting avatars that do not belong to them by checking folder ownership';
