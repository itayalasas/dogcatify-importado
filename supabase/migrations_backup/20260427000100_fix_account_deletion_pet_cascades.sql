-- Keep account deletion from being blocked by pet-owned data.
-- These relationships represent data owned by the user/pet and should be removed
-- when the profile or pet is deleted.

BEGIN;

ALTER TABLE public.pet_albums
  DROP CONSTRAINT IF EXISTS pet_albums_user_id_fkey;

ALTER TABLE public.pet_albums
  ADD CONSTRAINT pet_albums_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.pet_albums
  DROP CONSTRAINT IF EXISTS pet_albums_pet_id_fkey;

ALTER TABLE public.pet_albums
  ADD CONSTRAINT pet_albums_pet_id_fkey
  FOREIGN KEY (pet_id)
  REFERENCES public.pets(id)
  ON DELETE CASCADE;

ALTER TABLE public.pet_behavior
  DROP CONSTRAINT IF EXISTS pet_behavior_user_id_fkey;

ALTER TABLE public.pet_behavior
  ADD CONSTRAINT pet_behavior_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.pet_behavior
  DROP CONSTRAINT IF EXISTS pet_behavior_pet_id_fkey;

ALTER TABLE public.pet_behavior
  ADD CONSTRAINT pet_behavior_pet_id_fkey
  FOREIGN KEY (pet_id)
  REFERENCES public.pets(id)
  ON DELETE CASCADE;

ALTER TABLE public.pet_health
  DROP CONSTRAINT IF EXISTS pet_health_user_id_fkey;

ALTER TABLE public.pet_health
  ADD CONSTRAINT pet_health_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.pet_health
  DROP CONSTRAINT IF EXISTS pet_health_pet_id_fkey;

ALTER TABLE public.pet_health
  ADD CONSTRAINT pet_health_pet_id_fkey
  FOREIGN KEY (pet_id)
  REFERENCES public.pets(id)
  ON DELETE CASCADE;

ALTER TABLE public.pets
  DROP CONSTRAINT IF EXISTS pets_owner_id_fkey;

ALTER TABLE public.pets
  ADD CONSTRAINT pets_owner_id_fkey
  FOREIGN KEY (owner_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_user_id_fkey;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_pet_id_fkey;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_pet_id_fkey
  FOREIGN KEY (pet_id)
  REFERENCES public.pets(id)
  ON DELETE CASCADE;

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_post_id_fkey;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_post_id_fkey
  FOREIGN KEY (post_id)
  REFERENCES public.posts(id)
  ON DELETE CASCADE;

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_user_id_fkey;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_parent_id_fkey;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_parent_id_fkey
  FOREIGN KEY (parent_id)
  REFERENCES public.comments(id)
  ON DELETE CASCADE;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_pet_id_fkey;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_pet_id_fkey
  FOREIGN KEY (pet_id)
  REFERENCES public.pets(id)
  ON DELETE CASCADE;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.user_carts
  DROP CONSTRAINT IF EXISTS user_carts_user_id_fkey;

ALTER TABLE public.user_carts
  ADD CONSTRAINT user_carts_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.places
  DROP CONSTRAINT IF EXISTS fk_places_created_by;

ALTER TABLE public.places
  ADD CONSTRAINT fk_places_created_by
  FOREIGN KEY (created_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.promotion_billing
  DROP CONSTRAINT IF EXISTS promotion_billing_created_by_fkey;

ALTER TABLE public.promotion_billing
  ADD CONSTRAINT promotion_billing_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_created_by_fkey;

ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.subscription_settings
  DROP CONSTRAINT IF EXISTS subscription_settings_updated_by_fkey;

ALTER TABLE public.subscription_settings
  ADD CONSTRAINT subscription_settings_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.promotion_approval_requests
  DROP CONSTRAINT IF EXISTS promotion_approval_requests_requested_by_fkey;

ALTER TABLE public.promotion_approval_requests
  ADD CONSTRAINT promotion_approval_requests_requested_by_fkey
  FOREIGN KEY (requested_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.delete_user_completely(user_id_to_delete uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_user_id uuid;
  result json;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF current_user_id != user_id_to_delete THEN
    RAISE EXCEPTION 'No tienes permisos para eliminar esta cuenta';
  END IF;

  IF EXISTS (SELECT 1 FROM partners WHERE user_id = user_id_to_delete) THEN
    RAISE EXCEPTION 'La cuenta tiene negocios asociados. Primero debes transferir o eliminar esos negocios.';
  END IF;

  DELETE FROM comments
  WHERE post_id IN (
    SELECT posts.id
    FROM posts
    WHERE posts.user_id = user_id_to_delete
       OR posts.pet_id IN (SELECT pets.id FROM pets WHERE pets.owner_id = user_id_to_delete)
       OR posts.album_id IN (SELECT pet_albums.id FROM pet_albums WHERE pet_albums.user_id = user_id_to_delete)
  );

  DELETE FROM comments
  WHERE user_id = user_id_to_delete;

  DELETE FROM posts
  WHERE user_id = user_id_to_delete
     OR pet_id IN (SELECT pets.id FROM pets WHERE pets.owner_id = user_id_to_delete)
     OR album_id IN (SELECT pet_albums.id FROM pet_albums WHERE pet_albums.user_id = user_id_to_delete);

  DELETE FROM adoption_messages
  WHERE sender_id = user_id_to_delete;

  DELETE FROM adoption_chats
  WHERE customer_id = user_id_to_delete;

  DELETE FROM chat_messages
  WHERE sender_id = user_id_to_delete;

  DELETE FROM chat_conversations
  WHERE user_id = user_id_to_delete;

  DELETE FROM service_reviews
  WHERE customer_id = user_id_to_delete
     OR pet_id IN (SELECT pets.id FROM pets WHERE pets.owner_id = user_id_to_delete);

  DELETE FROM orders
  WHERE customer_id = user_id_to_delete
     OR pet_id IN (SELECT pets.id FROM pets WHERE pets.owner_id = user_id_to_delete);

  DELETE FROM bookings
  WHERE customer_id = user_id_to_delete
     OR pet_id IN (SELECT pets.id FROM pets WHERE pets.owner_id = user_id_to_delete);

  DELETE FROM user_carts
  WHERE user_id = user_id_to_delete;

  DELETE FROM email_confirmations
  WHERE user_id = user_id_to_delete;

  DELETE FROM medical_history_tokens
  WHERE created_by = user_id_to_delete
     OR pet_id IN (SELECT pets.id FROM pets WHERE pets.owner_id = user_id_to_delete);

  DELETE FROM medical_alerts
  WHERE user_id = user_id_to_delete
     OR pet_id IN (SELECT pets.id FROM pets WHERE pets.owner_id = user_id_to_delete);

  DELETE FROM pet_behavior
  WHERE user_id = user_id_to_delete
     OR pet_id IN (SELECT pets.id FROM pets WHERE pets.owner_id = user_id_to_delete);

  DELETE FROM pet_health
  WHERE user_id = user_id_to_delete
     OR pet_id IN (SELECT pets.id FROM pets WHERE pets.owner_id = user_id_to_delete);

  DELETE FROM pet_albums
  WHERE user_id = user_id_to_delete
     OR pet_id IN (SELECT pets.id FROM pets WHERE pets.owner_id = user_id_to_delete);

  DELETE FROM pets
  WHERE owner_id = user_id_to_delete;

  DELETE FROM profiles
  WHERE id = user_id_to_delete;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id_to_delete) THEN
    RAISE EXCEPTION 'No se pudo eliminar el perfil del usuario';
  END IF;

  result := json_build_object(
    'success', true,
    'message', 'Usuario eliminado completamente',
    'user_id', user_id_to_delete
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'user_id', user_id_to_delete
    );
    RETURN result;
END;
$$;

GRANT ALL ON FUNCTION public.delete_user_completely(uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_user_completely(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_user_completely(uuid) TO service_role;

COMMIT;
