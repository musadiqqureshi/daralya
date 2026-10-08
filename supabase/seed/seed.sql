-- =====================================================================
-- Starter data for Dar Al-Aaliya Dates (run once with `npm run db:seed`).
-- Products come from the company's current paper invoice. Prices are left
-- at 0 for the owner to fill in; photos are free-licence stock images that
-- can be replaced in ERP → Products / Website Management.
-- =====================================================================

insert into public.storages (name_en, name_ar, location)
select v.* from (values
  ('Cold Storage 1', 'المستودع المبرد ١', 'Al-Awali, Madinah'),
  ('Cold Storage 2', 'المستودع المبرد ٢', 'Al-Awali, Madinah')
) v(name_en, name_ar, location)
where not exists (select 1 from public.storages);

insert into public.money_accounts (name_en, name_ar, kind)
select v.name_en, v.name_ar, v.kind::public.money_kind from (values
  ('Main cash box', 'الصندوق الرئيسي', 'cash'),
  ('Company bank account', 'الحساب البنكي للشركة', 'bank')
) v(name_en, name_ar, kind)
where not exists (select 1 from public.money_accounts);

insert into public.customers (name, name_ar, notes)
select 'Walk-in customer', 'عميل نقدي', 'Use for counter sales without a customer account'
where not exists (select 1 from public.customers);

update public.settings set
  whatsapp = '+966578004821',
  phone = '0550845703',
  address_en = 'Al-Awali, Madinah, Saudi Arabia',
  address_ar = 'العوالي، المدينة المنورة، المملكة العربية السعودية',
  maps_url = 'https://maps.google.com/?q=Al+Awali+Madinah',
  tagline_en = 'For sale: all kinds of premium dates & nuts — wholesale and retail'
where id = 1;

insert into public.invoice_qr_codes (label_en, label_ar, url, position, sort_order)
select v.* from (values
  ('WhatsApp', 'واتساب', 'https://wa.me/966578004821', 'footer', 1),
  ('Location', 'الموقع', 'https://maps.google.com/?q=Al+Awali+Madinah', 'footer', 2)
) v(label_en, label_ar, url, position, sort_order)
where not exists (select 1 from public.invoice_qr_codes);

-- ---------------------------------------------------------------------
-- Product catalogue (from the paper invoice)
-- ---------------------------------------------------------------------
with src (slug, name_en, name_ar, name_ur, variety, grade, featured, sort_order, image, desc_en, desc_ar) as (values
  ('ajwa-aaliya', 'Ajwa Aaliya', 'عجوة العالية', 'عجوہ عالیہ', 'Ajwa', 'Premium', true, 1, 'photo-1777891258039-970dd7e6e14c',
   'Our house selection of Ajwa — soft, dark dates with fine wrinkled skin and a gentle, rounded sweetness.',
   'مختارات الدار من العجوة — تمر طري داكن بقشرة ناعمة متجعدة وحلاوة هادئة.'),
  ('ajwa-madina', 'Ajwa Madina', 'عجوة المدينة', 'عجوہ مدینہ', 'Ajwa', 'Select', true, 2, 'photo-1629738601425-494c3d6ba3e2',
   'Ajwa dates associated with Madinah, dark and soft with a mild sweetness.',
   'عجوة المدينة، تمر داكن طري بحلاوة معتدلة.'),
  ('ajwa', 'Ajwa', 'عجوة', 'عجوہ', 'Ajwa', 'Standard', false, 3, 'photo-1776669234669-52d5c29a5b94',
   'Classic Ajwa dates for everyday enjoyment and gifting.',
   'عجوة كلاسيكية للاستهلاك اليومي والإهداء.'),
  ('anbar', 'Amber', 'عنبرة', 'عنبر', 'Amber', 'Premium', true, 4, 'photo-1770617476915-7269d29d27dc',
   'Large, meaty dates with a soft texture — a favourite for serving guests.',
   'تمر كبير ممتلئ بقوام طري — مفضل لتقديمه للضيوف.'),
  ('majdool', 'Majdool', 'مجدول', 'مجدول', 'Majdool', 'Large', true, 5, 'photo-1777891258071-45b4cee69360',
   'Large, glossy dates with a rich, caramel-like sweetness.',
   'تمر كبير لامع بحلاوة غنية تشبه الكراميل.'),
  ('safawi', 'Safawi Qalmi', 'صفاوي قلمي', 'صفاوی قلمی', 'Safawi', 'Select', true, 6, 'photo-1776669234669-52d5c29a5b94',
   'Dark, elongated dates with a soft bite and balanced sweetness.',
   'تمر داكن مستطيل بقوام طري وحلاوة متوازنة.'),
  ('sugai', 'Sugai', 'صقعي', 'صقعی', 'Sugai', 'Select', true, 7, 'photo-1774857247287-d68599847107',
   'Two-toned dates — crisp golden tips and a soft amber body.',
   'تمر ثنائي اللون — طرف ذهبي مقرمش وجسم كهرماني طري.'),
  ('mabroom', 'Mabroom', 'مبروم', 'مبروم', 'Mabroom', 'Select', true, 8, 'photo-1773038831316-a2f5e52a56e4',
   'Slender, firm dates with a chewy texture and light sweetness.',
   'تمر نحيف متماسك بقوام مطاطي وحلاوة خفيفة.'),
  ('mashrooq', 'Mashrooq', 'مشروق', 'مشروق', 'Mashrooq', null, false, 9, 'photo-1771231591559-d19c89ad118a',
   'A traditional variety with a tender texture.', 'صنف تقليدي بقوام طري.'),
  ('sukkari', 'Sukari', 'سكري', 'سکری', 'Sukari', 'Premium', true, 10, 'photo-1775453585199-7605c46d6da1',
   'Golden, honey-sweet dates that melt softly — among the most popular varieties.',
   'تمر ذهبي بحلاوة العسل يذوب بنعومة — من أكثر الأصناف طلباً.'),
  ('shalabi', 'Shalbi', 'شلبي', 'شلبی', 'Shalbi', null, false, 11, 'photo-1771231591559-d19c89ad118a',
   'Slim, firm dates with a pleasant, light sweetness.', 'تمر نحيف متماسك بحلاوة خفيفة لطيفة.'),
  ('rabeeya', 'Rabeeya', 'ربيعة', 'ربیعہ', 'Rabeeya', null, false, 12, 'photo-1770617476915-7269d29d27dc',
   'Dark, soft dates with a deep flavour.', 'تمر داكن طري بنكهة عميقة.'),
  ('barni', 'Barni', 'برني', 'برنی', 'Barni', null, false, 13, 'photo-1777891258039-970dd7e6e14c',
   'Round, plump dates with a soft texture.', 'تمر مستدير ممتلئ بقوام طري.'),
  ('sukhul', 'Sukhul', 'سخل', 'سخل', 'Sukhul', null, false, 14, 'photo-1774857247287-d68599847107',
   'A traditional variety for everyday use.', 'صنف تقليدي للاستخدام اليومي.'),
  ('dates-with-almond', 'Dates with Almond', 'تمور باللوز', 'بادام والی کھجور', 'Stuffed dates', null, false, 15, 'photo-1777891258039-54963151d2d0',
   'Dates filled with almonds — ready to serve.', 'تمور محشوة باللوز — جاهزة للتقديم.'),
  ('date-sweets', 'Chocolate & Sweets', 'حلويات', 'کھجور کی مٹھائی', 'Sweets', null, false, 16, 'photo-1777891258039-54963151d2d0',
   'Date-based sweets and chocolate-coated dates.', 'حلويات بالتمر وتمور مغطاة بالشوكولاتة.')
)
insert into public.products (slug, name_en, name_ar, name_ur, variety, grade, unit, weight_kg, is_published, is_featured,
  public_availability, packaging_en, packaging_ar, description_en, description_ar, sort_order, specs)
select slug, name_en, name_ar, name_ur, variety, grade, 'kg', 1, true, featured, 'on_request',
  'Loose by the kilo, boxes and cartons', 'سائب بالكيلو، علب وكراتين', desc_en, desc_ar, sort_order,
  jsonb_build_array(
    jsonb_build_object('label_en', 'Variety', 'label_ar', 'الصنف', 'value_en', variety, 'value_ar', name_ar),
    jsonb_build_object('label_en', 'Sold by', 'label_ar', 'البيع', 'value_en', 'Kilogram / carton', 'value_ar', 'بالكيلو / بالكرتون'))
from src
where not exists (select 1 from public.products p where p.slug = src.slug);

insert into public.product_images (product_id, src, alt_en, alt_ar)
select p.id, 'https://images.unsplash.com/' || s.image || '?auto=format&fit=crop&w=1200&q=75', p.name_en || ' dates', 'تمر ' || p.name_ar
from public.products p
join (values
  ('ajwa-aaliya', 'photo-1777891258039-970dd7e6e14c'), ('ajwa-madina', 'photo-1629738601425-494c3d6ba3e2'),
  ('ajwa', 'photo-1776669234669-52d5c29a5b94'), ('anbar', 'photo-1770617476915-7269d29d27dc'),
  ('majdool', 'photo-1777891258071-45b4cee69360'), ('safawi', 'photo-1776669234669-52d5c29a5b94'),
  ('sugai', 'photo-1774857247287-d68599847107'), ('mabroom', 'photo-1773038831316-a2f5e52a56e4'),
  ('mashrooq', 'photo-1771231591559-d19c89ad118a'), ('sukkari', 'photo-1775453585199-7605c46d6da1'),
  ('shalabi', 'photo-1771231591559-d19c89ad118a'), ('rabeeya', 'photo-1770617476915-7269d29d27dc'),
  ('barni', 'photo-1777891258039-970dd7e6e14c'), ('sukhul', 'photo-1774857247287-d68599847107'),
  ('dates-with-almond', 'photo-1777891258039-54963151d2d0'), ('date-sweets', 'photo-1777891258039-54963151d2d0')
) s(slug, image) on s.slug = p.slug
where not exists (select 1 from public.product_images pi where pi.product_id = p.id);
