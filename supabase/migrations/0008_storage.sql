-- =====================================================================
-- 0008 STORAGE BUCKETS & POLICIES
--   products   public   product photos (portfolio)
--   site       public   website hero/about imagery, logo
--   attendance private  check-in/out photographs (signed URLs only)
--   staff      private  employee profile photos
--   documents  private  receipts/, payments/, agreements/, deliveries/
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('site', 'site', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('attendance', 'attendance', false, 3145728, array['image/jpeg', 'image/webp']),
  ('staff', 'staff', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('documents', 'documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "products images: staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'products' and (app.has_perm('products.manage') or app.has_perm('website.manage')));
create policy "products images: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'products' and (app.has_perm('products.manage') or app.has_perm('website.manage')));

create policy "site images: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'site' and (app.has_perm('website.manage') or app.has_perm('settings.manage')));
create policy "site images: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'site' and (app.has_perm('website.manage') or app.has_perm('settings.manage')));

-- Attendance evidence: write-once by markers, readable only with the photos permission.
-- No update or delete policy: nobody can alter a photo through the API.
create policy "attendance photos: capture" on storage.objects for insert to authenticated
  with check (bucket_id = 'attendance' and app.has_perm('attendance.mark'));
create policy "attendance photos: view" on storage.objects for select to authenticated
  using (bucket_id = 'attendance' and app.has_perm('attendance.photos'));

create policy "staff photos: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'staff' and app.has_perm('employees.manage'));
create policy "staff photos: view" on storage.objects for select to authenticated
  using (bucket_id = 'staff' and (app.has_perm('employees.view') or app.has_perm('attendance.mark')));

create policy "documents: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (
    ((storage.foldername(name))[1] = 'receipts' and app.has_perm('expenses.create'))
    or ((storage.foldername(name))[1] = 'payments' and (app.has_perm('payments.create') or app.has_perm('sales.collect')))
    or ((storage.foldername(name))[1] = 'agreements' and app.has_perm('investors.manage'))
    or ((storage.foldername(name))[1] = 'deliveries' and (app.has_perm('deliveries.manage') or app.has_perm('deliveries.own')))
  ));
create policy "documents: view" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (
    ((storage.foldername(name))[1] = 'receipts' and app.has_perm('expenses.view'))
    or ((storage.foldername(name))[1] = 'payments' and (app.has_perm('payments.view') or app.has_perm('accounts.view')))
    or ((storage.foldername(name))[1] = 'agreements' and app.has_perm('investors.view'))
    or ((storage.foldername(name))[1] = 'deliveries' and (app.has_perm('deliveries.view') or app.has_perm('deliveries.own')))
  ));
