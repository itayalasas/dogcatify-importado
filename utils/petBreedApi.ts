import { envConfig } from './envConfig';

type PetSpecies = 'dog' | 'cat';

export async function fetchPetBreedData(
  action: 'list' | 'search',
  species: PetSpecies,
  name?: string,
): Promise<any> {
  if (!envConfig.isInitialized()) await envConfig.initialize();

  const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL')?.replace(/\/+$/, '');
  const anonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('PUBLIC_CONFIG_UNAVAILABLE');

  const query = new URLSearchParams({ action, species });
  if (name) query.set('name', name);

  const response = await fetch(`${supabaseUrl}/functions/v1/pet-breeds?${query.toString()}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (!response.ok) throw new Error(`PET_BREEDS_API_${response.status}`);
  return response.json();
}
