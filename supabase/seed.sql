-- HANGOUT Modern Cafe Digital Platform
-- Batch 01 Seed Data: Demonstration Cafe, Tables, Categories, Menu Items, Variants, and Addons

-- 1. Insert Cafe Settings (Singleton Global Store)
INSERT INTO public.cafe_settings (
    id,
    cafe_name,
    tagline,
    phone,
    email,
    address,
    opening_hours,
    dining_enabled,
    takeaway_enabled,
    gst_enabled,
    gst_percentage,
    gst_number,
    currency_symbol,
    currency_code,
    takeaway_notice
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'HANGOUT',
    'Specialty Coffee, Sourdough Bakes & Modern Cafe Culture',
    '+91 98765 43210',
    'hello@hangoutcafe.com',
    'Plot 42, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    '{
        "monday_to_friday": "08:00 AM - 11:00 PM",
        "saturday_sunday": "08:00 AM - 12:00 Midnight"
    }'::jsonb,
    true,
    true,
    true,
    5.00,
    '29AAAAA0000A1Z5',
    '₹',
    'INR',
    'Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end.'
) ON CONFLICT (id) DO UPDATE SET
    takeaway_notice = EXCLUDED.takeaway_notice,
    updated_at = NOW();

-- 2. Insert Core Staff Roles
INSERT INTO public.roles (id, name, description, permissions) VALUES
    ('admin', 'Super Administrator', 'Full system access, menu control, billing and cafe settings', '["all"]'::jsonb),
    ('manager', 'Cafe Manager', 'Operational oversight, inventory management, reports and staff controls', '["manage_orders", "view_reports", "manage_tables", "manage_menu"]'::jsonb),
    ('waiter', 'Service Crew / Waiter', 'Table ordering, table status, customer assistance, order delivery', '["take_orders", "update_order_status", "view_tables"]'::jsonb),
    ('kitchen', 'Kitchen Head / KDS', 'Kitchen display system, cooking queue, item preparation time', '["view_kds", "mark_ready", "mark_cooking"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Cafe Tables with QR Identifiers
INSERT INTO public.cafe_tables (id, table_number, qr_code_identifier, seating_capacity, section, status, is_active) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'T-01', 'hangout-qr-table-t01', 2, 'Window Bar', 'available', true),
    ('b0000000-0000-0000-0000-000000000002', 'T-02', 'hangout-qr-table-t02', 4, 'Main Indoor', 'available', true),
    ('b0000000-0000-0000-0000-000000000003', 'T-03', 'hangout-qr-table-t03', 4, 'Main Indoor', 'available', true),
    ('b0000000-0000-0000-0000-000000000004', 'T-04', 'hangout-qr-table-t04', 6, 'Sunny Patio', 'available', true),
    ('b0000000-0000-0000-0000-000000000005', 'T-05', 'hangout-qr-table-t05', 2, 'Sunny Patio', 'available', true),
    ('b0000000-0000-0000-0000-000000000006', 'T-06', 'hangout-qr-table-t06', 4, 'Mezzanine Lounge', 'available', true),
    ('b0000000-0000-0000-0000-000000000007', 'T-07', 'hangout-qr-table-t07', 8, 'Community Table', 'available', true),
    ('b0000000-0000-0000-0000-000000000008', 'T-08', 'hangout-qr-table-t08', 2, 'Espresso Bar', 'available', true)
ON CONFLICT (table_number) DO UPDATE SET
    qr_code_identifier = EXCLUDED.qr_code_identifier;

-- 4. Insert Menu Categories
INSERT INTO public.menu_categories (id, name, slug, description, display_order, icon_name, image_url, is_active) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Artisanal Coffee', 'artisanal-coffee', 'Single origin beans, hand-pulled espresso & slow pour-overs', 1, 'Coffee', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000002', 'Refreshers & Matcha', 'refreshers-matcha', 'Ceremonial Uji matcha, cold brew tonics and botanical fizz', 2, 'Sparkles', 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000003', 'Sourdough & Melts', 'sourdough-melts', 'Slow-fermented country sourdough, house pestos and melted artisanal cheeses', 3, 'Utensils', 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000004', 'Gourmet Burgers', 'gourmet-burgers', 'Brioche buns, smashed patties, house pickles & truffle glaze', 4, 'Flame', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000005', 'Pastas & Bowls', 'pastas-bowls', 'Fresh rolled pastas, rich emulsions and vibrant nutrient bowls', 5, 'Bowl', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000006', 'Bakery & Sweets', 'bakery-sweets', 'Burnt cheesecakes, cinnamon morning buns and molten brownies', 6, 'Cake', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    display_order = EXCLUDED.display_order;

-- 5. Insert Menu Items
-- Artisanal Coffee
INSERT INTO public.menu_items (id, category_id, name, slug, description, base_price, image_url, is_veg, is_available, is_featured, is_today_special, preparation_time_mins, calories, allergens, display_order) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Iced Spanish Latte', 'iced-spanish-latte', 'Double shot specialty espresso condensed milk swirl topped with velvety cold milk over clear artisan ice cubes.', 240.00, 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', true, true, true, false, 5, 210, ARRAY['Dairy'], 1),
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Vanilla Bean Cold Foam Cold Brew', 'vanilla-bean-cold-foam-cold-brew', '20-hour steeped Ethiopian cold brew topped with whipped Madagascar vanilla bean sweet cream foam.', 260.00, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80', true, true, true, true, 5, 140, ARRAY['Dairy'], 2),
    ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Velvet Cortado', 'velvet-cortado', 'Equal parts rich ristretto espresso and warm silky textured micro-foam served in an authentic Gibraltar glass.', 190.00, 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', true, true, false, false, 6, 80, ARRAY['Dairy'], 3),
    ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Classic Flat White', 'classic-flat-white', 'Smooth double ristretto topped with glossy micro-foam, delicate latte art finish.', 210.00, 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80', true, true, false, false, 6, 120, ARRAY['Dairy'], 4);

-- Refreshers & Matcha
INSERT INTO public.menu_items (id, category_id, name, slug, description, base_price, image_url, is_veg, is_available, is_featured, is_today_special, preparation_time_mins, calories, allergens, display_order) VALUES
    ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'Ceremonial Uji Iced Matcha Latte', 'ceremonial-uji-iced-matcha-latte', 'First-harvest Kyoto Uji stone-ground ceremonial matcha whisked with pure water and layered over chilled oat or coconut milk.', 290.00, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80', true, true, true, true, 7, 130, ARRAY[]::TEXT[], 1),
    ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'Peach Blossom Sparkling Tonic', 'peach-blossom-sparkling-tonic', 'Infused white peach purée, cold-pressed jasmine tea, tonic bubbles, crushed mint and edible pansies.', 230.00, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', true, true, false, false, 5, 95, ARRAY[]::TEXT[], 2);

-- Sourdough & Melts
INSERT INTO public.menu_items (id, category_id, name, slug, description, base_price, image_url, is_veg, is_available, is_featured, is_today_special, preparation_time_mins, calories, allergens, display_order) VALUES
    ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'Truffle Mushroom & Whipped Ricotta Toast', 'truffle-mushroom-ricotta-toast', 'Thick cut toasted country sourdough, whipped lemon ricotta, sautéed balsamic thyme shimeji & button mushrooms with white truffle oil.', 340.00, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80', true, true, true, true, 12, 380, ARRAY['Gluten', 'Dairy'], 1),
    ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000003', 'Avocado & Chili Crunch Toast', 'avocado-chili-crunch-toast', 'Hass avocado mash, spicy artisanal crisp chili oil, toasted pumpkin seeds, cherry tomatoes and micro greens on sourdough.', 320.00, 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?auto=format&fit=crop&w=600&q=80', true, true, false, false, 10, 310, ARRAY['Gluten'], 2),
    ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000003', 'Smoked Cheddar & Jalapeno Sourdough Melt', 'smoked-cheddar-jalapeno-melt', 'Aged English smoked cheddar, mozzarella stretch, charred pickled jalapenos, caramelized onions and spicy Dijon.', 310.00, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80', true, true, false, false, 12, 490, ARRAY['Gluten', 'Dairy'], 3);

-- Gourmet Burgers
INSERT INTO public.menu_items (id, category_id, name, slug, description, base_price, image_url, is_veg, is_available, is_featured, is_today_special, preparation_time_mins, calories, allergens, display_order) VALUES
    ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004', 'The Hangout Signature Smash Burger', 'hangout-signature-smash-burger', 'Double crispy smashed spiced beef/tenderloin patties, molten double American cheese, dill pickles, grilled sweet onions and secret Hangout burger sauce on toasted brioche.', 420.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', false, true, true, true, 16, 680, ARRAY['Gluten', 'Dairy'], 1),
    ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000004', 'Korean Gochujang Crispy Chicken Burger', 'korean-gochujang-crispy-chicken', '24-hour buttermilk soaked crispy fried chicken thigh coated in sweet and spicy gochujang glaze, kimchi sesame slaw, kewpie mayo.', 390.00, 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=600&q=80', false, true, true, false, 15, 620, ARRAY['Gluten', 'Dairy', 'Sesame'], 2),
    ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000004', 'Crispy Portobello & Halloumi Burger', 'crispy-portobello-halloumi-burger', 'Panko-crusted giant Portobello mushroom cap, griddled Cypriot halloumi, roasted garlic emulsion, baby arugula and tomato relish.', 380.00, 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', true, true, false, false, 15, 540, ARRAY['Gluten', 'Dairy'], 3);

-- Pastas & Bowls
INSERT INTO public.menu_items (id, category_id, name, slug, description, base_price, image_url, is_veg, is_available, is_featured, is_today_special, preparation_time_mins, calories, allergens, display_order) VALUES
    ('d0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000005', 'Wild Forest Truffle Tagliatelle', 'wild-forest-truffle-tagliatelle', 'Handmade egg tagliatelle tossed in cremini mushroom emulsion, 24-month Parmigiano Reggiano, cracked black pepper and summer black truffle paste.', 440.00, 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80', true, true, true, false, 18, 590, ARRAY['Gluten', 'Dairy', 'Egg'], 1),
    ('d0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000005', 'Pesto Burrata Rigatoni', 'pesto-burrata-rigatoni', 'Bronze-cut rigatoni tossed in house Genovese basil pine-nut pesto, roasted cherry tomatoes, topped with a whole fresh creamy burrata ball.', 460.00, 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=600&q=80', true, true, true, true, 16, 610, ARRAY['Gluten', 'Dairy', 'Nuts'], 2);

-- Bakery & Sweets
INSERT INTO public.menu_items (id, category_id, name, slug, description, base_price, image_url, is_veg, is_available, is_featured, is_today_special, preparation_time_mins, calories, allergens, display_order) VALUES
    ('d0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000006', 'San Sebastian Basque Burnt Cheesecake', 'basque-burnt-cheesecake', 'Caramelized scorched exterior with an ultra-creamy, molten center baked fresh every morning with Madagascar vanilla.', 280.00, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80', true, true, true, false, 3, 410, ARRAY['Dairy', 'Egg'], 1),
    ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000006', 'Warm Cinnamon Brioche Scroll', 'warm-cinnamon-brioche-scroll', 'Layered buttery brioche dough swirled with Ceylon cinnamon sugar and glazed with cream cheese vanilla drizzle.', 210.00, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', true, true, false, false, 3, 360, ARRAY['Gluten', 'Dairy'], 2);

-- 6. Insert Variants (Sizes, Milk choices, Roast)
-- Coffee Size Variants
INSERT INTO public.menu_item_variants (menu_item_id, variant_group, name, price_delta, is_default, is_available, display_order) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'Size', 'Regular (250ml)', 0.00, true, true, 1),
    ('d0000000-0000-0000-0000-000000000001', 'Size', 'Large (400ml)', 50.00, false, true, 2),
    ('d0000000-0000-0000-0000-000000000002', 'Size', 'Regular (300ml)', 0.00, true, true, 1),
    ('d0000000-0000-0000-0000-000000000002', 'Size', 'Grande (450ml)', 60.00, false, true, 2),
    ('d0000000-0000-0000-0000-000000000004', 'Size', 'Regular (200ml)', 0.00, true, true, 1),
    ('d0000000-0000-0000-0000-000000000004', 'Size', 'Double Mug (350ml)', 45.00, false, true, 2),
    ('d0000000-0000-0000-0000-000000000005', 'Milk Base', 'Organic Oat Milk', 0.00, true, true, 1),
    ('d0000000-0000-0000-0000-000000000005', 'Milk Base', 'Almond Milk', 30.00, false, true, 2),
    ('d0000000-0000-0000-0000-000000000005', 'Milk Base', 'Whole Farm Milk', 0.00, false, true, 3),
    ('d0000000-0000-0000-0000-000000000010', 'Patty Style', 'Medium Juicy', 0.00, true, true, 1),
    ('d0000000-0000-0000-0000-000000000010', 'Patty Style', 'Well Done Crisp', 0.00, false, true, 2);

-- 7. Insert Addons (Espresso Shots, Cheeses, Syrups, Dips)
INSERT INTO public.menu_item_addons (menu_item_id, category_id, name, price, is_veg, is_available, display_order) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Extra Espresso Shot', 40.00, true, true, 1),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Artisan Caramel Drizzle', 35.00, true, true, 2),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Madagascar Vanilla Syrup', 30.00, true, true, 3),
    ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004', 'Extra Smashed Patty', 120.00, false, true, 1),
    ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004', 'Extra Aged Cheddar Slice', 45.00, true, true, 2),
    ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004', 'Black Truffle Aioli Dip', 50.00, true, true, 3),
    ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000004', 'Extra Gochujang Glaze', 30.00, true, true, 1),
    ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000004', 'Spicy Kimchi Side', 55.00, true, true, 2),
    ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'Organic Poached Egg', 40.00, false, true, 1),
    ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'Extra Whipped Ricotta Scoop', 60.00, true, true, 2),
    ('d0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000005', 'Fresh Italian Burrata (100g)', 140.00, true, true, 1),
    ('d0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000005', 'Garlic Herb Brioche Toast', 60.00, true, true, 2);

-- 8. Seed Demo Customer Account
INSERT INTO public.customers (
    id,
    full_name,
    mobile_number,
    email,
    total_orders,
    total_spent
) VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'Aarav Sharma',
    '9876543210',
    'aarav.sharma@example.com',
    3,
    1840.00
) ON CONFLICT (id) DO NOTHING;

