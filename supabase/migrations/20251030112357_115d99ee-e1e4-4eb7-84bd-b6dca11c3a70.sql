-- Create storage bucket for catch images
INSERT INTO storage.buckets (id, name, public)
VALUES ('catches', 'catches', true);

-- Storage policies for catch images
CREATE POLICY "Catch images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catches');

CREATE POLICY "Authenticated users can upload catch images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'catches' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update their own catch images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'catches' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their own catch images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'catches' AND
    auth.uid() IS NOT NULL
  );