-- Coupons table for discount codes
-- Migration: 20261127000000_create_coupons

-- 1. Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON public.coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_expires_at ON public.coupons(expires_at);

-- 3. Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies - Public can read active coupons for validation
DROP POLICY IF EXISTS "public_read_active_coupons" ON public.coupons;
CREATE POLICY "public_read_active_coupons"
ON public.coupons
FOR SELECT
TO public
USING (
  is_active = TRUE
  AND (expires_at IS NULL OR expires_at > NOW())
  AND current_uses < max_uses
);

-- 5. Admin full access (using service_role via is_admin())
DROP POLICY IF EXISTS "admin_manage_coupons" ON public.coupons;
CREATE POLICY "admin_manage_coupons"
ON public.coupons
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 6. Updated at trigger
DROP TRIGGER IF EXISTS set_coupons_updated_at ON public.coupons;
CREATE TRIGGER set_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 7. Function to validate and apply coupon (for checkout)
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  discount_percent INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon RECORD;
BEGIN
  -- Normalize code to uppercase for lookup
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE code = UPPER(p_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Cupón no encontrado';
  END IF;

  IF NOT v_coupon.is_active THEN
    RETURN QUERY SELECT FALSE, 0, 'Cupón inactivo';
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, 0, 'Cupón expirado';
  END IF;

  IF v_coupon.current_uses >= v_coupon.max_uses THEN
    RETURN QUERY SELECT FALSE, 0, 'Cupón agotado (límite de usos alcanzado)';
  END IF;

  RETURN QUERY SELECT TRUE, v_coupon.discount_percent, 'Cupón válido';
END;
$$;

-- 8. Function to increment coupon usage (called after successful payment)
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.coupons
  SET current_uses = current_uses + 1,
      updated_at = NOW()
  WHERE code = UPPER(p_code);
END;
$$;

-- 9. Grant execute on functions
GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(TEXT) TO authenticated;

COMMENT ON TABLE public.coupons IS 'Códigos de descuento para membresías y cursos. Validación pública, gestión solo admin.';
COMMENT ON COLUMN public.coupons.code IS 'Código único en mayúsculas (ej: APERTURA20)';
COMMENT ON COLUMN public.coupons.discount_percent IS 'Porcentaje de descuento (1-100)';
COMMENT ON COLUMN public.coupons.max_uses IS 'Máximo número de usos permitidos';
COMMENT ON COLUMN public.coupons.current_uses IS 'Contador de usos actuales';
COMMENT ON COLUMN public.coupons.expires_at IS 'Fecha de expiración opcional';
COMMENT ON COLUMN public.coupons.is_active IS 'Activar/desactivar cupón sin eliminarlo';