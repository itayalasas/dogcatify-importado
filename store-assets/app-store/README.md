# Capturas para App Store Connect

Compuestas a partir de **capturas reales de la app** (provistas por el usuario desde
`C:\Users\pedro\OneDrive\Imágenes\DogCatiFy`, resolución original 1242×2688 — iPhone 6.5")
insertadas en un marco de teléfono con título/bajada de marca sobre fondo con los colores
de DogCatiFy (`#2D6A6F`) y el logo (`assets/images/logo-transp.png`).

- `iphone-6.9/` — 1320×2868 px (bucket "6.9 pulgadas", cubre iPhone 16/15 Pro Max y similares).
- `ipad-13/` — 2064×2752 px (bucket "iPad 13 pulgadas", mismas pantallas de iPhone centradas
  en el canvas más grande — la app no tiene layout propio de iPad).

8 capturas por tamaño, en orden sugerido de carga:

1. `01-tienda` — catálogo de productos (pantalla real: Tienda)
2. `02-pagos` — checkout con modal de Mercado Pago (pantalla real: Mi Carrito)
3. `03-lugares` — detalle de un lugar pet-friendly (pantalla real: Lugares Pet-Friendly)
4. `04-seguimiento` — seguimiento de pedido paso a paso (pantalla real: Detalle del Pedido)
5. `05-pedidos` — historial de pedidos (pantalla real: Mis Pedidos)
6. `06-negocios` — selector de negocios del aliado (pantalla real: Seleccionar Negocio)
7. `07-dashboard` — métricas del negocio (pantalla real: Dashboard del aliado)
8. `08-inventario` — gestión de inventario (pantalla real: Gestionar Productos)

**Excluida a propósito**: la captura de "Configuración de Mercado Pago" (`0x0ss (9).png`
en la carpeta original) muestra el Public Key y Access Token de producción del aliado,
aunque parcialmente enmascarados por la propia UI — no se usó para no publicar nada de
esas credenciales, ni siquiera truncadas, en el listado público de la App Store.

Notas:
- Si App Store Connect pide además el bucket "6.5 pulgadas" (1284×2778 / 1242×2688 — que
  coincide con la resolución original de las capturas reales) o "6.7 pulgadas" (1290×2796),
  avisar para regenerar con `generate-real.js` cambiando `TARGETS` — el script queda en el
  scratchpad de la sesión, no en el repo.
- Las "vistas previas" (hasta 3, arriba de las capturas) son **videos**, no imágenes — esto
  no las cubre; son un encargo aparte si se quieren.
