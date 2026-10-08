-- Salesmen use "Stock & prices" instead of the product catalogue screen
delete from public.role_permissions where role = 'sales' and permission = 'products.view';
