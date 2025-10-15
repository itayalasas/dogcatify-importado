/*
  # Estructura completa de base de datos para DogCatiFy

  1. Tablas Principales
    - `profiles` - Perfiles de usuarios
    - `pets` - Mascotas de los usuarios
    - `partners` - Socios/proveedores de servicios
    - `partner_services` - Servicios ofrecidos por partners
    - `partner_products` - Productos vendidos por partners
    - `business_schedule` - Horarios de negocios
    - `bookings` - Reservas de servicios
    - `orders` - Órdenes de pago
    - `admin_settings` - Configuración del admin

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas restrictivas por defecto
*/

-- Tabla de perfiles de usuarios
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text,
  phone text,
  photo_url text,
  bio text,
  location text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de mascotas
CREATE TABLE IF NOT EXISTS pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  species text NOT NULL CHECK (species IN ('dog', 'cat', 'other')),
  breed text,
  gender text CHECK (gender IN ('male', 'female', 'unknown')),
  birth_date date,
  photo_url text,
  weight numeric,
  microchip_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de partners/proveedores
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  business_name text NOT NULL,
  business_type text NOT NULL CHECK (business_type IN ('veterinary', 'grooming', 'walking', 'boarding', 'shop', 'shelter', 'other')),
  description text,
  logo text,
  phone text,
  email text,
  address text,
  location_lat numeric,
  location_lng numeric,
  commission_percentage numeric DEFAULT 5.0,
  mercadopago_connected boolean DEFAULT false,
  mercadopago_config jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de servicios de partners
CREATE TABLE IF NOT EXISTS partner_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  price numeric DEFAULT 0 NOT NULL,
  duration integer DEFAULT 60,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de productos de partners
CREATE TABLE IF NOT EXISTS partner_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  price numeric DEFAULT 0 NOT NULL,
  stock integer DEFAULT 0,
  images text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de horarios de negocios
CREATE TABLE IF NOT EXISTS business_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time text NOT NULL,
  end_time text NOT NULL,
  slot_duration integer DEFAULT 60,
  max_slots integer DEFAULT 10,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de reservas
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  service_id uuid NOT NULL,
  service_name text NOT NULL,
  service_duration integer DEFAULT 60,
  partner_name text NOT NULL,
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  pet_id uuid NOT NULL,
  pet_name text NOT NULL,
  date timestamptz NOT NULL,
  time text NOT NULL,
  end_time text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'pending_payment', 'confirmed', 'cancelled', 'completed')),
  total_amount numeric DEFAULT 0,
  commission_amount numeric DEFAULT 0,
  partner_amount numeric DEFAULT 0,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  payment_method text,
  payment_transaction_id text,
  payment_confirmed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de órdenes
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  service_id uuid,
  pet_id uuid,
  appointment_date timestamptz,
  appointment_time text,
  booking_notes text,
  items jsonb DEFAULT '[]'::jsonb,
  total_amount numeric DEFAULT 0 NOT NULL,
  commission_amount numeric DEFAULT 0,
  partner_amount numeric DEFAULT 0,
  shipping_address text,
  payment_method text DEFAULT 'mercadopago',
  payment_preference_id text,
  payment_id text,
  payment_status text DEFAULT 'pending',
  payment_data jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'confirmed', 'cancelled', 'refunded', 'completed')),
  order_type text DEFAULT 'product_purchase' CHECK (order_type IN ('product_purchase', 'service_booking')),
  partner_breakdown jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de configuración de admin
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Usuarios pueden ver todos los perfiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Políticas para pets
CREATE POLICY "Usuarios pueden ver sus propias mascotas"
  ON pets FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Usuarios pueden crear mascotas"
  ON pets FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Usuarios pueden actualizar sus mascotas"
  ON pets FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Usuarios pueden eliminar sus mascotas"
  ON pets FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Políticas para partners
CREATE POLICY "Todos pueden ver partners activos"
  ON partners FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Usuarios pueden crear su partner"
  ON partners FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Partners pueden actualizar su información"
  ON partners FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Políticas para partner_services
CREATE POLICY "Todos pueden ver servicios activos"
  ON partner_services FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Partners pueden gestionar sus servicios"
  ON partner_services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = partner_services.partner_id 
      AND partners.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = partner_services.partner_id 
      AND partners.user_id = auth.uid()
    )
  );

-- Políticas para partner_products
CREATE POLICY "Todos pueden ver productos activos"
  ON partner_products FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Partners pueden gestionar sus productos"
  ON partner_products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = partner_products.partner_id 
      AND partners.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = partner_products.partner_id 
      AND partners.user_id = auth.uid()
    )
  );

-- Políticas para business_schedule
CREATE POLICY "Todos pueden ver horarios activos"
  ON business_schedule FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Partners pueden gestionar sus horarios"
  ON business_schedule FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = business_schedule.partner_id 
      AND partners.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = business_schedule.partner_id 
      AND partners.user_id = auth.uid()
    )
  );

-- Políticas para bookings
CREATE POLICY "Usuarios pueden ver sus reservas"
  ON bookings FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Partners pueden ver sus reservas"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = bookings.partner_id 
      AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuarios pueden crear reservas"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Sistema puede actualizar reservas"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para orders
CREATE POLICY "Usuarios pueden ver sus órdenes"
  ON orders FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Partners pueden ver sus órdenes"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = orders.partner_id 
      AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuarios pueden crear órdenes"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Sistema puede actualizar órdenes"
  ON orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para admin_settings
CREATE POLICY "Todos pueden leer configuración de admin"
  ON admin_settings FOR SELECT
  TO authenticated
  USING (true);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_pets_owner ON pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_partners_user ON partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_active ON partners(is_active);
CREATE INDEX IF NOT EXISTS idx_partner_services_partner ON partner_services(partner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_partner_products_partner ON partner_products(partner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_business_schedule_partner ON business_schedule(partner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bookings_partner_date ON bookings(partner_id, date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON orders(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_id);
