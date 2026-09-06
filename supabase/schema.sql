-- ==============================================================================
-- MERCACONSUMO - ESQUEMA SQL MAESTRO Y ACTUALIZADO PARA SUPABASE (100% RE-EJECUTABLE)
-- Copia y pega este contenido en: Supabase Dashboard > SQL Editor > Run
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. TABLA DE AJUSTES GLOBALES (API KEY SEGURA Y ADMIN)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read app_settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app_settings"
    ON public.app_settings FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can upsert app_settings" ON public.app_settings;
CREATE POLICY "Authenticated users can upsert app_settings"
    ON public.app_settings FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. PERFILES DE USUARIO Y SUSCRIPCIONES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    currency_code VARCHAR(3) DEFAULT 'COP' NOT NULL,
    timezone TEXT DEFAULT 'America/Bogota' NOT NULL,
    plan TEXT DEFAULT 'trial' NOT NULL,
    trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '3 days') NOT NULL,
    scans_this_week INT DEFAULT 0 NOT NULL,
    week_start_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar columnas si la tabla ya existía previamente
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '3 days'),
ADD COLUMN IF NOT EXISTS scans_this_week INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS week_start_date DATE DEFAULT CURRENT_DATE;

-- Trigger automático para crear perfil cuando un usuario se registra en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        full_name, 
        currency_code, 
        timezone, 
        plan, 
        trial_ends_at, 
        scans_this_week, 
        week_start_date
    )
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        'COP',
        'America/Bogota',
        'trial',
        (now() + INTERVAL '3 days'),
        0,
        CURRENT_DATE
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Poblar perfiles para usuarios existentes si no tienen perfil
INSERT INTO public.profiles (id, full_name, currency_code, timezone, plan, trial_ends_at)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 'COP', 'America/Bogota', 'trial', (created_at + INTERVAL '3 days')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. PERFILES FAMILIARES DEL HOGAR (ESTILO NETFLIX - PLAN PRO)
CREATE TABLE IF NOT EXISTS public.family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '🥑',
    avatar_url TEXT,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. CATEGORÍAS
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    color TEXT DEFAULT '#10B981',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. ESTABLECIMIENTOS / SUPERMERCADOS
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    platform TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. PRODUCTOS DEL CATÁLOGO
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    brand TEXT,
    base_unit VARCHAR(20) DEFAULT 'unidad' NOT NULL,
    min_stock_alert NUMERIC(10, 2) DEFAULT 1 NOT NULL CHECK (min_stock_alert >= 0),
    is_favorite BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. COMPRAS (CABECERA)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    purchase_date DATE DEFAULT CURRENT_DATE NOT NULL,
    total_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (total_amount >= 0),
    payment_method TEXT,
    source VARCHAR(20) DEFAULT 'manual' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. DETALLE DE COMPRAS
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity NUMERIC(10, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
    package_size NUMERIC(10, 3),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. INVENTARIO ACTUAL
CREATE TABLE IF NOT EXISTS public.inventory (
    product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    current_stock NUMERIC(10, 3) DEFAULT 0 NOT NULL CHECK (current_stock >= 0),
    unit VARCHAR(20) NOT NULL,
    last_purchased_at DATE,
    last_depleted_at DATE,
    status VARCHAR(20) DEFAULT 'in_stock' NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. CONSUMOS
CREATE TABLE IF NOT EXISTS public.consumptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity NUMERIC(10, 3) NOT NULL CHECK (quantity >= 0),
    unit VARCHAR(20) NOT NULL,
    consumption_date DATE DEFAULT CURRENT_DATE NOT NULL,
    is_depletion_event BOOLEAN DEFAULT false NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. CICLOS DE CONSUMO (PREDICCIÓN)
CREATE TABLE IF NOT EXISTS public.consumption_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_quantity NUMERIC(10, 3) NOT NULL CHECK (total_quantity > 0),
    unit VARCHAR(20) NOT NULL,
    duration_days NUMERIC(8, 2) NOT NULL CHECK (duration_days > 0),
    daily_consumption_rate NUMERIC(10, 4) NOT NULL CHECK (daily_consumption_rate >= 0),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_date ON public.purchases(user_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON public.purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user ON public.inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_consumptions_product ON public.consumptions(product_id, consumption_date DESC);
CREATE INDEX IF NOT EXISTS idx_consumption_cycles_product ON public.consumption_cycles(product_id, end_date DESC);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members(user_id);

-- 14. ROW LEVEL SECURITY (RLS) - AISLAMIENTO TOTAL ENTRE USUARIOS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumption_cycles ENABLE ROW LEVEL SECURITY;

-- Políticas Profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Políticas Family Members
DROP POLICY IF EXISTS "Users can manage own family members" ON public.family_members;
CREATE POLICY "Users can manage own family members" ON public.family_members 
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas Categories (Globales y Propias)
DROP POLICY IF EXISTS "Users can view global and own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can view global and own categories" ON public.categories FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- Políticas Stores
DROP POLICY IF EXISTS "Users can manage own stores" ON public.stores;
CREATE POLICY "Users can manage own stores" ON public.stores FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas Products
DROP POLICY IF EXISTS "Users can manage own products" ON public.products;
CREATE POLICY "Users can manage own products" ON public.products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas Purchases & Purchase Items
DROP POLICY IF EXISTS "Users can manage own purchases" ON public.purchases;
CREATE POLICY "Users can manage own purchases" ON public.purchases FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own purchase items" ON public.purchase_items;
CREATE POLICY "Users can manage own purchase items" ON public.purchase_items FOR ALL 
USING (
    EXISTS (SELECT 1 FROM public.purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.user_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.user_id = auth.uid())
);

-- Políticas Inventory
DROP POLICY IF EXISTS "Users can manage own inventory" ON public.inventory;
CREATE POLICY "Users can manage own inventory" ON public.inventory FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas Consumptions & Cycles
DROP POLICY IF EXISTS "Users can manage own consumptions" ON public.consumptions;
CREATE POLICY "Users can manage own consumptions" ON public.consumptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own consumption cycles" ON public.consumption_cycles;
CREATE POLICY "Users can manage own consumption cycles" ON public.consumption_cycles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 15. CATEGORÍAS GLOBALES INICIALES
INSERT INTO public.categories (user_id, name, icon, color) VALUES
(NULL, 'Frutas y Verduras', '🍌', '#10B981'),
(NULL, 'Lácteos y Huevos', '🥛', '#3B82F6'),
(NULL, 'Granos y Cereales', '🍚', '#F59E0B'),
(NULL, 'Carnes y Proteínas', '🥩', '#EF4444'),
(NULL, 'Aseo del Hogar', '🧹', '#8B5CF6'),
(NULL, 'Cuidado Personal', '🧴', '#EC4899'),
(NULL, 'Bebidas y Snacks', '🥤', '#6366F1'),
(NULL, 'Despensa y Condimentos', '🧂', '#64748B')
ON CONFLICT DO NOTHING;
