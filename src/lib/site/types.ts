export type PublicProduct = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  variety: string;
  grade: string | null;
  unit: string;
  weight_kg: number;
  packaging_en: string | null;
  packaging_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  specs: { label_en: string; label_ar: string; value_en: string; value_ar: string }[];
  public_availability: "available" | "limited" | "seasonal" | "on_request";
  is_featured: boolean;
  sort_order: number;
  images: { src: string; alt_en: string | null; alt_ar: string | null }[];
};

export type PublicCompany = {
  company_name_en: string;
  company_name_ar: string;
  tagline_en: string | null;
  tagline_ar: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address_en: string | null;
  address_ar: string | null;
  maps_url: string | null;
  logo_path: string | null;
};
