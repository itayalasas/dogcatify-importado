import { Redirect } from 'expo-router';

/** Servicios ahora vive dentro de la pestaña Explorar. Esta ruta se mantiene para los enlaces viejos. */
export default function ServicesRedirect() {
  return <Redirect href={{ pathname: '/(tabs)/explore', params: { section: 'services' } }} />;
}
