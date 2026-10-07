import { Redirect } from 'expo-router';

/** Lugares ahora vive dentro de la pestaña Explorar. Esta ruta se mantiene para los enlaces viejos. */
export default function PlacesRedirect() {
  return <Redirect href={{ pathname: '/(tabs)/explore', params: { section: 'places' } }} />;
}
