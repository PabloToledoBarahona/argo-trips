# Guía de Integración - MS04 TRIPS

**Versión:** 1.2.0
**Última Actualización:** Enero 2026
**Audiencia:** Equipos de Frontend Web y Móvil

---

> ⚠️ **AVISO IMPORTANTE - BLOQUEO PARCIAL**
>
> El microservicio **MS07-PAYMENTS aún no ha sido desarrollado**. Esto significa que:
> - El endpoint `PATCH /trips/:id/complete` **fallará** al intentar crear la intención de pago
> - La transición a estado `PAID` no es posible actualmente
> - El equipo de frontend puede integrar ~80% del flujo (crear trip, aceptar, verificar PIN, iniciar, cancelar)
> - El flujo de **completar viaje y pago** estará disponible cuando MS07-PAYMENTS sea desplegado
>
> **Estados disponibles para integración:** `REQUESTED`, `OFFERED`, `ASSIGNED`, `PICKUP_STARTED`, `IN_PROGRESS`, `CANCELED`
>
> **Estados bloqueados:** `COMPLETED` (parcial), `PAID`

---

## Tabla de Contenidos

1. [Descripción del Microservicio](#1-descripción-del-microservicio)
2. [Arquitectura e Integraciones](#2-arquitectura-e-integraciones)
3. [Configuración General](#3-configuración-general)
4. [Flujo del Ciclo de Vida de un Trip](#4-flujo-del-ciclo-de-vida-de-un-trip)
5. [Endpoints Disponibles](#5-endpoints-disponibles)
6. [Manejo de Errores](#6-manejo-de-errores)
7. [Consideraciones de Implementación](#7-consideraciones-de-implementación)
8. [Apéndices](#8-apéndices)

---

## 1. Descripción del Microservicio

### 1.1 ¿Qué es MS04-TRIPS?

MS04-TRIPS es el microservicio central responsable de gestionar el ciclo de vida completo de los viajes en la plataforma Argo. Actúa como orquestador principal entre el pasajero, el conductor y los diferentes servicios de backend necesarios para completar un viaje.

### 1.2 Responsabilidades del Servicio

El microservicio MS04-TRIPS es responsable de:

- **Creación de solicitudes de viaje**: Registrar nuevas solicitudes de viaje con cotización de precio en tiempo real
- **Asignación de conductores**: Gestionar la aceptación de viajes por parte de conductores disponibles
- **Verificación de seguridad**: Validar códigos PIN antes del inicio del viaje
- **Seguimiento del viaje**: Controlar las transiciones de estado durante el viaje
- **Finalización y pago**: Calcular el precio final y generar intenciones de pago
- **Cancelaciones**: Gestionar cancelaciones desde cualquier estado del viaje

### 1.3 Funcionalidades Ofrecidas al Frontend

El servicio expone las siguientes funcionalidades consumibles desde aplicaciones web y móviles:

1. **Solicitar un viaje** con cálculo de precio estimado
2. **Aceptar un viaje** (conductor)
3. **Verificar PIN** del pasajero
4. **Iniciar viaje** (conductor)
5. **Completar viaje** con cálculo de precio final
6. **Cancelar viaje** en cualquier estado

---

## 2. Arquitectura e Integraciones

### 2.1 Microservicios con los que Interactúa

MS04-TRIPS se integra automáticamente con los siguientes microservicios (transparente para el frontend):

| Microservicio | Propósito | Interacción |
|--------------|-----------|-------------|
| **MS02-AUTH** | Autenticación | Emisión/refresh de JWT (el Gateway valida tokens) |
| **MS06-PRICING** | Tarifas Dinámicas | Cálculo de precios estimados y finales |
| **MS10-GEO** | Geoespacial | Geocodificación, rutas y indexación H3 |
| **MS03-DRIVER-SESSIONS** | Sesiones de Conductores | Validación de disponibilidad y estado de conductores |
| **MS07-PAYMENTS** | Pagos | Creación de intenciones de pago |

**Nota Importante**: El frontend no necesita llamar directamente a estos servicios. MS04-TRIPS orquesta todas las llamadas necesarias y el Gateway aplica JWT/CORS/rate limiting.

### 2.2 Diagrama de Integración

```
[App Web/Móvil]
      |
      | HTTPS
      v
[ALB Compartido] -> [Gateway Envoy] -> [MS04-TRIPS]
                                      |---> [MS06-PRICING] (Cotizaciones)
                                      |---> [MS10-GEO] (Rutas y geocoding)
                                      |---> [MS03-DRIVER-SESSIONS] (Disponibilidad)
                                      |---> [MS07-PAYMENTS] (Intenciones de pago)
                                      |
                                      +---> [Redis Event Bus] (Streams)
```

### 2.3 Infraestructura AWS + Redis

- **Gateway único (Envoy) detrás de ALB compartido**: todo el tráfico público entra por el ALB y se enruta por paths (`/trips/*`).
- **Service discovery con Cloud Map**: los microservicios se resuelven internamente como `argo-*.argo.local`.
- **Redis interno (Upstash)**: cache, estado temporal, locks y verificación de PIN.
- **Redis Event Bus (Streams)**: eventos asíncronos entre servicios (ej: `payment.captured`, `driver.offline`) que pueden cambiar el estado del trip sin intervención directa del frontend.

---

## 3. Configuración General

### 3.1 URL Base

Todas las llamadas deben realizarse a través del Gateway de Argo:

```
Base URL (Gateway/ALB): http://argo-shared-alb-828452645.us-east-2.elb.amazonaws.com
Prefijo de Trips: /trips
```

**URL Completa de Ejemplo:**
```
http://argo-shared-alb-828452645.us-east-2.elb.amazonaws.com/trips
```

**Nota:** En producción usar HTTPS si está habilitado. Para no hardcodear, usa el `GATEWAY_URL`/`TRIPS_URL` entregado por DevOps.

### 3.2 Autenticación

Los endpoints protegidos requieren autenticación mediante JWT (JSON Web Token).  
**Importante:** El Gateway Envoy valida el JWT; MS04-TRIPS no lo valida directamente. Si el token es inválido o falta, el Gateway responde 401.

#### Headers Requeridos

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Descripción de Headers:**

- `Authorization`: Token JWT obtenido del servicio de autenticación MS02-AUTH
- `Content-Type`: Siempre debe ser `application/json`

#### Obtención del Token

El token JWT se obtiene mediante el flujo de autenticación de MS02-AUTH (consultar documentación de MS02 para detalles). El token debe incluirse en todas las peticiones protegidas a MS04-TRIPS.

**Opcional (web):** El Gateway también puede leer el JWT desde una cookie `access_token` si la app usa sesiones basadas en cookies.

### 3.3 Formato de Respuesta

Todas las respuestas del servicio utilizan formato JSON.

**Respuesta Exitosa:**
```json
{
  "id": "uuid-del-trip",
  "status": "REQUESTED",
  ...
}
```

**Respuesta con Error:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

---

## 4. Flujo del Ciclo de Vida de un Trip

### 4.1 Estados del Trip

Un viaje pasa por los siguientes estados durante su ciclo de vida:

| Estado | Descripción | Siguiente Estado Posible | Disponible |
|--------|-------------|-------------------------|------------|
| `REQUESTED` | Viaje solicitado por el pasajero | `OFFERED`, `CANCELED` | ✅ |
| `OFFERED` | Viaje ofrecido a conductores cercanos | `ASSIGNED`, `CANCELED` | ✅ |
| `ASSIGNED` | Conductor asignado al viaje | `PICKUP_STARTED`, `CANCELED` | ✅ |
| `PICKUP_STARTED` | PIN verificado, conductor en punto de recogida | `IN_PROGRESS`, `CANCELED` | ✅ |
| `IN_PROGRESS` | Viaje en curso | `COMPLETED`, `CANCELED` | ✅ |
| `COMPLETED` | Viaje finalizado, precio calculado | `PAID` | ⚠️ Parcial* |
| `PAID` | Pago procesado exitosamente | - | ❌ Bloqueado* |
| `CANCELED` | Viaje cancelado | - | ✅ |

> *\*Estados `COMPLETED` y `PAID` dependen de MS07-PAYMENTS que aún no está desarrollado. El endpoint `/complete` fallará al intentar crear el payment intent.*

### 4.2 Diagrama de Flujo

```
[Pasajero]                    [Conductor]                 [Sistema]
    |                              |                           |
    | 1. POST /trips              |                           |
    |-------------------------------------------------------------->|
    |                              |                           |
    |<----- REQUESTED (con cotización) --------------------------|
    |                              |                           |
    |                              |        [Dispatch interno] |
    |                              |                           |
    |<-------------------------------- OFFERED -----------------|
    |                              |                           |
    |                              | 2. PATCH /trips/:id/accept|
    |                              |-------------------------->|
    |                              |                           |
    |<-------------------------------- ASSIGNED (PIN generado) -|
    |                              |                           |
    | 3. POST /trips/:id/pin/verify                           |
    |-------------------------------------------------------------->|
    |                              |                           |
    |<-------------------------------- PICKUP_STARTED ----------|
    |                              |                           |
    |                              | 4. PATCH /trips/:id/start |
    |                              |-------------------------->|
    |                              |                           |
    |<-------------------------------- IN_PROGRESS -------------|
    |                              |                           |
    |                              | 5. PATCH /trips/:id/complete
    |                              |-------------------------->|
    |                              |                           |
    |<-------------- COMPLETED (con precio final) ⚠️ BLOQUEADO -|
    |                              |                           |
```

> ⚠️ **Nota:** El paso 5 (complete) está actualmente bloqueado porque MS07-PAYMENTS no está desarrollado.

### 4.3 Flujo Detallado

**Paso 1: Solicitud de Viaje (Pasajero)** ✅
- El pasajero crea una solicitud de viaje con origen, destino y tipo de vehículo
- El sistema calcula la ruta y el precio estimado mediante MS06-PRICING y MS10-GEO
- Estado resultante: `REQUESTED`

**Paso 1.5: Oferta a Conductores (Sistema)** ✅
- El sistema identifica conductores cercanos mediante MS03-DRIVER-SESSIONS
- Se ofrece el viaje a conductores elegibles
- Estado resultante: `OFFERED`

**Paso 2: Aceptación del Viaje (Conductor)** ✅
- Un conductor disponible acepta el viaje
- El sistema valida la disponibilidad y elegibilidad del conductor
- Se genera un PIN de 4 dígitos para verificación de seguridad
- Se calcula el ETA del conductor al punto de recogida
- Estado resultante: `ASSIGNED`

**Paso 3: Verificación de PIN (Pasajero)** ✅
- El pasajero ingresa el PIN mostrado en la app del conductor
- El sistema valida el PIN contra el almacenado en Redis
- **Importante:** Al verificar exitosamente, el estado cambia automáticamente
- Estado resultante: `PICKUP_STARTED`

**Paso 4: Inicio del Viaje (Conductor)** ✅
- El conductor marca el inicio del viaje cuando el pasajero ha abordado
- Requiere que el trip esté en estado `PICKUP_STARTED` (PIN verificado)
- El sistema registra la hora de inicio
- Estado resultante: `IN_PROGRESS`

**Paso 5: Finalización del Viaje (Conductor)** ⚠️ BLOQUEADO
- El conductor completa el viaje con distancia y tiempo reales
- El sistema calcula el precio final mediante MS06-PRICING
- **⚠️ BLOQUEADO:** El sistema intenta crear una intención de pago en MS07-PAYMENTS (no desarrollado)
- Estado resultante: `COMPLETED` (fallará hasta que MS07-PAYMENTS esté disponible)

**Paso 6: Pago Procesado (Sistema)** ❌ NO DISPONIBLE
- El sistema recibe el evento `payment.captured` de MS07-PAYMENTS
- Estado resultante: `PAID`

---

## 5. Endpoints Disponibles

### 5.1 Health Check

#### GET /health

Endpoint público para verificar el estado del servicio y conectividad con base de datos.

**Método:** `GET`
**URL:** `/health`
**Autenticación:** No requerida

**Response Exitoso (200):**
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    }
  }
}
```

**Uso Recomendado:** Implementar verificaciones de conectividad antes de realizar operaciones críticas.

---

### 5.2 Crear Viaje

#### POST /trips

Crea una nueva solicitud de viaje y retorna una cotización de precio en tiempo real.

**Método:** `POST`
**URL:** `/trips`
**Autenticación:** Requerida (JWT)

#### Request Body

```typescript
{
  riderId: string;           // ID del pasajero (requerido)
  vehicleType: string;       // Tipo de vehículo: "economy" | "comfort" | "premium" | "xl" (requerido)
  city: string;              // Código de ciudad: "LPZ" | "CBB" | "SCZ" (requerido)
  paymentMethod?: string;    // "cash" | "qr" (requerido, camelCase)
  payment_method?: string;   // "cash" | "qr" (alias snake_case)
  payment_channel?: string;  // "cash" | "qr" (alias snake_case)
  originLat: number;         // Latitud origen: -90 a 90 (requerido)
  originLng: number;         // Longitud origen: -180 a 180 (requerido)
  originH3Res9: string;      // Índice H3 resolución 9 del origen (requerido)
  destLat: number;           // Latitud destino: -90 a 90 (requerido)
  destLng: number;           // Longitud destino: -180 a 180 (requerido)
  destH3Res9: string;        // Índice H3 resolución 9 del destino (requerido)
}
```

#### Ejemplo de Request

```json
{
  "riderId": "rider-12345",
  "vehicleType": "economy",
  "city": "LPZ",
  "payment_method": "cash",
  "originLat": -16.5000,
  "originLng": -68.1193,
  "originH3Res9": "89283082827ffff",
  "destLat": -16.5100,
  "destLng": -68.1293,
  "destH3Res9": "89283082837ffff"
}
```

#### Response Exitoso (201)

```typescript
{
  id: string;                // UUID del trip creado
  status: string;            // "REQUESTED"
  riderId: string;           // ID del pasajero
  vehicleType: string;       // Tipo de vehículo solicitado
  paymentMethod: string;     // "cash" | "qr"
  requestedAt: string;       // Timestamp ISO 8601
  quoteId: string;           // ID de la cotización (para referencia)
  estimateTotal: number;     // Precio total estimado
  basePrice: number;         // Tarifa base
  surgeMultiplier: number;   // Multiplicador de demanda (ej: 1.5)
  currency: string;          // Moneda: "BOB", "USD", etc.
  breakdown: {               // Desglose del precio
    distancePrice: number;   // Precio por distancia
    timePrice: number;       // Precio por tiempo
    serviceFee: number;      // Tarifa de servicio
    specialCharges: Array<{  // Cargos especiales (opcional)
      type: string;
      amount: number;
      description: string;
    }>;
  };
  distanceMeters: number;    // Distancia estimada en metros (opcional)
  durationSeconds: number;   // Duración estimada en segundos (opcional)
  degradation: string | null; // "NO_ROUTER" si hay degradación, null si no
}
```

#### Ejemplo de Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "REQUESTED",
  "riderId": "rider-12345",
  "vehicleType": "economy",
  "paymentMethod": "cash",
  "requestedAt": "2025-12-20T10:30:00.000Z",
  "quoteId": "quote-78910",
  "estimateTotal": 25.50,
  "basePrice": 10.00,
  "surgeMultiplier": 1.2,
  "currency": "BOB",
  "breakdown": {
    "distancePrice": 8.50,
    "timePrice": 5.00,
    "serviceFee": 2.00,
    "specialCharges": []
  },
  "distanceMeters": 5400,
  "durationSeconds": 720,
  "degradation": null
}
```

#### Códigos de Respuesta

| Código | Descripción |
|--------|-------------|
| `201` | Viaje creado exitosamente |
| `400` | Validación fallida (datos inválidos) |
| `401` | No autenticado (token inválido o expirado) |
| `429` | Rate limit excedido (Gateway) |
| `500` | Error interno del servidor |

#### Validaciones

- `riderId`: String no vacío
- `vehicleType`: String no vacío
- `city`: String no vacío (código de ciudad válido)
- `paymentMethod` / `payment_method` / `payment_channel`: Requerido, valores válidos: `cash`, `qr` (si se envía más de uno deben coincidir)
- `originLat`: Número entre -90 y 90
- `originLng`: Número entre -180 y 180
- `originH3Res9`: String H3 válido de resolución 9 (15 caracteres)
- `destLat`: Número entre -90 y 90
- `destLng`: Número entre -180 y 180
- `destH3Res9`: String H3 válido de resolución 9 (15 caracteres)

#### Notas Importantes

1. **Índices H3**: Los índices H3 deben ser calculados en el cliente usando la librería H3 de Uber antes de enviar la petición. Resolución requerida: 9.

2. **Degradación**: Si `degradation` es `"NO_ROUTER"`, significa que el servicio de rutas no estaba disponible y se usó una estimación simplificada. El viaje es válido pero el precio puede ser menos preciso.

3. **Tipos de Vehículo**: Los valores válidos son: `economy`, `comfort`, `premium`, `xl`, `delivery`, `moto`.

4. **Ciudades Soportadas**: Actualmente: `LPZ` (La Paz), `CBB` (Cochabamba), `SCZ` (Santa Cruz).

---

### 5.3 Aceptar Viaje (Conductor)

#### PATCH /trips/:id/accept

Permite a un conductor aceptar un viaje disponible.

**Método:** `PATCH`
**URL:** `/trips/:id/accept`
**Autenticación:** Requerida (JWT)

#### Parámetros de URL

- `id`: UUID del trip a aceptar

#### Request Body

```typescript
{
  driverId: string;  // ID del conductor que acepta (requerido)
}
```

#### Ejemplo de Request

```
PATCH /trips/550e8400-e29b-41d4-a716-446655440000/accept
```

```json
{
  "driverId": "driver-67890"
}
```

#### Response Exitoso (200)

```typescript
{
  id: string;         // UUID del trip
  status: string;     // "ASSIGNED"
  driverId: string;   // ID del conductor asignado
  assignedAt: string; // Timestamp ISO 8601 de asignación
}
```

#### Ejemplo de Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ASSIGNED",
  "driverId": "driver-67890",
  "assignedAt": "2025-12-20T10:35:00.000Z"
}
```

#### Códigos de Respuesta

| Código | Descripción |
|--------|-------------|
| `200` | Viaje aceptado exitosamente |
| `400` | Validación fallida o estado inválido |
| `401` | No autenticado |
| `404` | Trip no encontrado |
| `500` | Error interno del servidor |

#### Validaciones

- `driverId`: String no vacío
- El trip debe existir
- El trip debe estar en estado `REQUESTED`
- El conductor debe estar disponible (validado por MS03-DRIVER-SESSIONS)
- El conductor debe estar elegible para aceptar viajes

#### Errores Comunes

**Error 400 - Estado Inválido:**
```json
{
  "statusCode": 400,
  "message": "Trip is not in REQUESTED state",
  "error": "Bad Request"
}
```

**Error 400 - Conductor No Disponible:**
```json
{
  "statusCode": 400,
  "message": "Driver is not available",
  "error": "Bad Request"
}
```

---

### 5.4 Verificar PIN

#### POST /trips/:id/pin/verify

Verifica el código PIN del pasajero antes de iniciar el viaje. **Al verificar exitosamente, el estado del trip cambia automáticamente de `ASSIGNED` a `PICKUP_STARTED`.**

**Método:** `POST`
**URL:** `/trips/:id/pin/verify`
**Autenticación:** Requerida (JWT)

#### Parámetros de URL

- `id`: UUID del trip

#### Request Body

```typescript
{
  pin: string;  // Código PIN de 4-6 dígitos (requerido)
}
```

#### Ejemplo de Request

```
POST /trips/550e8400-e29b-41d4-a716-446655440000/pin/verify
```

```json
{
  "pin": "1234"
}
```

#### Response Exitoso (200)

```typescript
{
  verified: boolean;  // true si el PIN es correcto, false si no
  tripId: string;     // UUID del trip
}
```

#### Ejemplo de Response

```json
{
  "verified": true,
  "tripId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Códigos de Respuesta

| Código | Descripción |
|--------|-------------|
| `200` | Verificación procesada (puede ser true o false) |
| `400` | Validación fallida (formato de PIN inválido) |
| `401` | No autenticado |
| `404` | Trip no encontrado |
| `500` | Error interno del servidor |

#### Validaciones

- `pin`: String de 4 a 6 caracteres
- El trip debe existir
- El trip debe estar en estado `ASSIGNED`

#### Notas Importantes

1. **Respuesta Siempre 200**: Incluso si el PIN es incorrecto, la respuesta HTTP es 200. El cliente debe verificar el campo `verified` en el body.

2. **Cambio de Estado Automático**: Si `verified: true`, el trip pasa automáticamente de `ASSIGNED` a `PICKUP_STARTED`. El frontend debe actualizar la UI acordemente.

3. **Límite de Intentos**: Después de 5 intentos fallidos, el sistema bloquea las verificaciones para ese trip (error 400).

4. **Generación de PIN**: El PIN de 4 dígitos es generado automáticamente al aceptar el viaje (`accept`) y tiene un TTL de 15 minutos. El pasajero lo ve en su app y se lo comunica al conductor.

5. **Timer No-Show**: Al verificar el PIN exitosamente, se inicia un timer de 10 minutos para no-show del conductor.

---

### 5.5 Iniciar Viaje (Conductor)

#### PATCH /trips/:id/start

Marca el inicio del viaje cuando el pasajero ha abordado el vehículo.

**Método:** `PATCH`
**URL:** `/trips/:id/start`
**Autenticación:** Requerida (JWT)

#### Parámetros de URL

- `id`: UUID del trip

#### Request Body

Sin body requerido.

#### Ejemplo de Request

```
PATCH /trips/550e8400-e29b-41d4-a716-446655440000/start
```

#### Response Exitoso (200)

```typescript
{
  id: string;           // UUID del trip
  status: string;       // "IN_PROGRESS"
  inProgressAt: string; // Timestamp ISO 8601 de inicio
}
```

#### Ejemplo de Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "IN_PROGRESS",
  "inProgressAt": "2025-12-20T10:40:00.000Z"
}
```

#### Códigos de Respuesta

| Código | Descripción |
|--------|-------------|
| `200` | Viaje iniciado exitosamente |
| `400` | Estado inválido (no está en ASSIGNED) |
| `401` | No autenticado |
| `404` | Trip no encontrado |
| `500` | Error interno del servidor |

#### Validaciones

- El trip debe existir
- El trip debe estar en estado `PICKUP_STARTED` (el PIN ya fue verificado)
- El conductor autenticado debe ser el asignado al trip

#### Errores Comunes

**Error 400 - Estado Inválido (PIN no verificado):**
```json
{
  "statusCode": 400,
  "message": "Trip trip-123 must be in PICKUP_STARTED status to start, current status: ASSIGNED",
  "error": "Bad Request"
}
```

**Error 403 - Conductor No Asignado:**
```json
{
  "statusCode": 403,
  "message": "driver is not assigned to this trip",
  "error": "Forbidden"
}
```

---

### 5.6 Completar Viaje (Conductor)

> ⚠️ **ENDPOINT ACTUALMENTE BLOQUEADO**
>
> Este endpoint fallará porque intenta crear una intención de pago en MS07-PAYMENTS, que aún no está desarrollado. El error será un timeout o 500 al intentar conectar con el servicio de pagos.

#### PATCH /trips/:id/complete

Finaliza el viaje y calcula el precio final basado en distancia y tiempo reales.

**Método:** `PATCH`
**URL:** `/trips/:id/complete`
**Autenticación:** Requerida (JWT)

#### Parámetros de URL

- `id`: UUID del trip

#### Request Body

```typescript
{
  distance_m_final?: number;  // Distancia final en metros (opcional)
  duration_s_final?: number;  // Duración final en segundos (opcional)
}
```

**Nota:** Ambos campos son opcionales. Si no se proveen, se usarán los valores estimados del trip inicial.

#### Ejemplo de Request

```
PATCH /trips/550e8400-e29b-41d4-a716-446655440000/complete
```

```json
{
  "distance_m_final": 5800,
  "duration_s_final": 840
}
```

#### Response Exitoso (200)

```typescript
{
  id: string;                  // UUID del trip
  status: string;              // "COMPLETED"
  completedAt: string;         // Timestamp ISO 8601 de finalización
  distance_m_final: number;    // Distancia final en metros (opcional)
  duration_s_final: number;    // Duración final en segundos (opcional)
  totalPrice: number;          // Precio final calculado
  surgeMultiplier: number;     // Multiplicador de demanda aplicado
  currency: string;            // Moneda del precio
  taxes: Array<{               // Impuestos aplicados
    name: string;
    percentage: number;
    amount: number;
  }>;
  min_fare_applied: boolean;   // true si se aplicó tarifa mínima
  cancel_fee_applied: boolean; // true si se aplicó tarifa de cancelación
  pricing_rule_version: string;// Versión de reglas de pricing usadas
  paymentIntentId: string;     // ID de la intención de pago creada
  degradation: string | null;  // Estado de degradación del servicio
}
```

#### Ejemplo de Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "completedAt": "2025-12-20T10:54:00.000Z",
  "distance_m_final": 5800,
  "duration_s_final": 840,
  "totalPrice": 27.80,
  "surgeMultiplier": 1.2,
  "currency": "BOB",
  "taxes": [
    {
      "name": "IVA",
      "percentage": 13,
      "amount": 3.20
    }
  ],
  "min_fare_applied": false,
  "cancel_fee_applied": false,
  "pricing_rule_version": "v1.2.0",
  "paymentIntentId": "pi_1234567890abcdef",
  "degradation": null
}
```

#### Códigos de Respuesta

| Código | Descripción |
|--------|-------------|
| `200` | Viaje completado exitosamente |
| `400` | Validación fallida o estado inválido |
| `401` | No autenticado |
| `404` | Trip no encontrado |
| `500` | Error interno del servidor |

#### Validaciones

- `distance_m_final`: Número >= 0 (si se provee)
- `duration_s_final`: Número >= 0 (si se provee)
- El trip debe existir
- El trip debe estar en estado `IN_PROGRESS`

#### Notas Importantes

1. **Precio Final**: El precio final puede diferir del estimado debido a:
   - Cambios en distancia/tiempo real vs estimado
   - Aplicación de tarifa mínima
   - Cambios en el multiplicador de demanda
   - Impuestos

2. **Intención de Pago**: El `paymentIntentId` se crea automáticamente y se debe usar en el flujo de pago con MS07-PAYMENTS.

3. **Tarifa Mínima**: Si `min_fare_applied` es `true`, el precio fue ajustado a la tarifa mínima configurada.

---

### 5.7 Cancelar Viaje

#### PATCH /trips/:id/cancel

Cancela un viaje en cualquier estado válido.

**Método:** `PATCH`
**URL:** `/trips/:id/cancel`
**Autenticación:** Requerida (JWT)

#### Parámetros de URL

- `id`: UUID del trip

#### Request Body

```typescript
{
  reason: CancelReason;  // Razón de cancelación (requerido)
  side: CancelSide;      // Quién cancela (requerido)
  notes?: string;        // Notas adicionales (opcional)
}
```

**Valores Permitidos para `reason`:**
- `RIDER_CANCELLED`: Pasajero canceló
- `DRIVER_CANCELLED`: Conductor canceló
- `NO_SHOW`: Pasajero no se presentó
- `SYSTEM_TIMEOUT`: Timeout del sistema
- `REASSIGN_EXHAUSTED`: Agotados reintentos de asignación

**Valores Permitidos para `side`:**
- `rider`: Cancelación por el pasajero
- `driver`: Cancelación por el conductor
- `system`: Cancelación automática del sistema

#### Ejemplo de Request

```
PATCH /trips/550e8400-e29b-41d4-a716-446655440000/cancel
```

```json
{
  "reason": "RIDER_CANCELLED",
  "side": "rider",
  "notes": "Cambio de planes"
}
```

#### Response Exitoso (200)

```typescript
{
  id: string;              // UUID del trip
  status: string;          // "CANCELED"
  cancelAt: string;        // Timestamp ISO 8601 de cancelación
  cancelReason: string;    // Razón de cancelación
  cancelSide: string;      // Quién canceló
}
```

#### Ejemplo de Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "CANCELED",
  "cancelAt": "2025-12-20T10:38:00.000Z",
  "cancelReason": "RIDER_CANCELLED",
  "cancelSide": "rider"
}
```

#### Códigos de Respuesta

| Código | Descripción |
|--------|-------------|
| `200` | Viaje cancelado exitosamente |
| `400` | Validación fallida o estado inválido |
| `401` | No autenticado |
| `404` | Trip no encontrado |
| `500` | Error interno del servidor |

#### Validaciones

- `reason`: Debe ser uno de los valores del enum `CancelReason`
- `side`: Debe ser uno de los valores del enum `CancelSide`
- `notes`: String (opcional, máximo 500 caracteres)
- El trip debe existir
- El trip no debe estar ya en estado `COMPLETED`, `PAID` o `CANCELED`

#### Políticas de Cancelación

**Estados Cancelables:**
- `REQUESTED`: Sin penalización
- `ASSIGNED`: Puede aplicar penalización según políticas
- `IN_PROGRESS`: Puede aplicar penalización según políticas

**Estados No Cancelables:**
- `COMPLETED`: El viaje ya finalizó
- `PAID`: El viaje ya fue pagado
- `CANCELED`: El viaje ya está cancelado

#### Errores Comunes

**Error 400 - Estado No Cancelable:**
```json
{
  "statusCode": 400,
  "message": "Cannot cancel trip in COMPLETED state",
  "error": "Bad Request"
}
```

**Error 400 - Razón Inválida:**
```json
{
  "statusCode": 400,
  "message": "Invalid cancel reason",
  "error": "Bad Request"
}
```

---

## 6. Manejo de Errores

### 6.1 Estructura de Error Estándar

Todos los errores del servicio siguen la siguiente estructura:

```typescript
{
  statusCode: number;   // Código HTTP del error
  message: string;      // Mensaje descriptivo del error
  error: string;        // Tipo de error
}
```

### 6.2 Códigos de Estado HTTP

| Código | Significado | Acción Recomendada |
|--------|-------------|-------------------|
| `200` | OK | Operación exitosa |
| `201` | Created | Recurso creado exitosamente |
| `400` | Bad Request | Revisar datos enviados, validación fallida |
| `401` | Unauthorized | Token inválido o expirado, re-autenticar |
| `403` | Forbidden | No tiene permisos para esta operación |
| `404` | Not Found | Recurso no encontrado |
| `409` | Conflict | Conflicto de estado (ej: trip ya cancelado) |
| `422` | Unprocessable Entity | Validación de negocio fallida |
| `429` | Too Many Requests | Rate limit del Gateway, aplicar backoff |
| `500` | Internal Server Error | Error del servidor, reintentar |
| `503` | Service Unavailable | Servicio temporalmente no disponible |

### 6.3 Errores Comunes y Soluciones

#### Error 401 - No Autenticado

**Causa:** Token JWT inválido, expirado o no provisto. Este error lo emite el Gateway.

**Ejemplo de Error:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**Solución:**
1. Verificar que el header `Authorization` esté presente
2. Verificar formato: `Bearer <token>`
3. Obtener un nuevo token del servicio de autenticación
4. Implementar refresh automático de tokens

#### Error 429 - Rate Limit Excedido

**Causa:** El Gateway aplicó rate limiting por exceso de requests.

**Ejemplo de Error:**
```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "error": "Too Many Requests"
}
```

**Solución:**
1. Aplicar backoff exponencial
2. Respetar header `Retry-After` si está presente
3. Reducir polling o agrupar llamadas

#### Error 400 - Validación Fallida

**Causa:** Datos enviados no cumplen con las validaciones.

**Ejemplo de Error:**
```json
{
  "statusCode": 400,
  "message": [
    "originLat must be a number conforming to the specified constraints",
    "vehicleType should not be empty"
  ],
  "error": "Bad Request"
}
```

**Solución:**
1. Revisar que todos los campos requeridos estén presentes
2. Verificar tipos de datos (string, number, etc.)
3. Validar rangos de valores (lat: -90 a 90, lng: -180 a 180)
4. Implementar validación del lado del cliente antes de enviar

#### Error 404 - Trip No Encontrado

**Causa:** El ID del trip no existe en el sistema.

**Ejemplo de Error:**
```json
{
  "statusCode": 404,
  "message": "Trip not found",
  "error": "Not Found"
}
```

**Solución:**
1. Verificar que el UUID del trip sea correcto
2. Verificar que el trip no haya sido eliminado
3. Implementar manejo de trips no encontrados en la UI

#### Error 500 - Error Interno

**Causa:** Error no controlado en el servidor.

**Ejemplo de Error:**
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

**Solución:**
1. Implementar retry con backoff exponencial
2. Registrar el error para reportar al equipo de backend
3. Mostrar mensaje genérico al usuario
4. No exponer detalles técnicos al usuario final

### 6.4 Manejo de Errores de Integración

Cuando MS04-TRIPS no puede comunicarse con servicios dependientes (MS06-PRICING, MS10-GEO, etc.), puede retornar:

**Error con Degradación:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "REQUESTED",
  ...
  "degradation": "NO_ROUTER"
}
```

**Interpretación:**
- El trip fue creado exitosamente
- El servicio de rutas (MS10-GEO) no estaba disponible
- El precio es una estimación simplificada
- El viaje es válido y puede continuar

**Acción Recomendada:**
- Mostrar advertencia al usuario que el precio es estimado
- Permitir que el usuario continúe con el trip
- El precio final será ajustado al completar el viaje

**Errores del Gateway (no del servicio):**
- `404` Route not configured: la ruta no está registrada en el Gateway
- `503` Upstream unavailable: el servicio está temporalmente fuera
- Reportar con `X-Request-ID` y timestamp para trazabilidad

---

## 7. Consideraciones de Implementación

### 7.1 Gestión de Estado en el Cliente

El cliente debe mantener sincronizado el estado del trip con el servidor.

**Recomendaciones:**

1. **Polling**: Implementar polling periódico para verificar cambios de estado
   ```
   Frecuencia recomendada: cada 5-10 segundos durante estados activos
   ```

2. **Eventos asíncronos**: El estado puede cambiar por eventos internos (Redis Streams), ej:
   - `payment.captured` → trip pasa a `PAID`
   - `driver.offline` → trip puede cancelarse

3. **WebSockets**: (Próximamente) Suscribirse a eventos de cambio de estado en tiempo real

4. **Estado Local**: Mantener una copia local del estado del trip
   ```typescript
   interface TripState {
     tripId: string;
     status: TripStatus;
     lastUpdate: Date;
     // ... otros campos relevantes
   }
   ```

5. **Sincronización**: Actualizar estado local después de cada operación exitosa

### 7.2 Timeouts y Reintentos

#### Timeouts Recomendados

| Operación | Timeout | Justificación |
|-----------|---------|---------------|
| Crear Trip | 10s | Requiere múltiples llamadas a servicios |
| Aceptar Trip | 5s | Operación simple de actualización |
| Verificar PIN | 3s | Operación de validación rápida |
| Iniciar Trip | 3s | Operación simple de actualización |
| Completar Trip | 15s | Requiere cálculo de precio y creación de pago |
| Cancelar Trip | 5s | Operación simple de actualización |

#### Estrategia de Reintentos

**Operaciones Idempotentes** (seguras para reintentar):
- GET /health
- Todas las operaciones con el mismo `tripId`

**Reintentos Recomendados:**
```typescript
{
  maxRetries: 3,
  backoff: 'exponential', // 1s, 2s, 4s
  retryOn: [500, 503, 408, 429], // Errores de servidor / rate limit
  doNotRetry: [400, 401, 404] // Errores de cliente
}
```

**Nota 429:** Respetar `Retry-After` si el Gateway lo retorna.

**Ejemplo de Implementación (Conceptual):**
```typescript
// NO implementar exactamente así, es solo ilustrativo
async function createTripWithRetry(data, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await api.post('/trips', data);
    } catch (error) {
      if (attempt === maxAttempts || error.status < 500) {
        throw error;
      }
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

### 7.3 Manejo de Índices H3

Los índices H3 son requeridos para crear trips y deben ser calculados en el cliente.

**Librería Recomendada:**
- NPM: `h3-js` (JavaScript/TypeScript)
- iOS: `H3-iOS`
- Android: `h3-java`

**Cálculo de Índices:**

```typescript
// Ejemplo ilustrativo (NO es código exacto)
import { latLngToCell } from 'h3-js';

// Convertir coordenadas a H3 resolución 9
const originH3 = latLngToCell(originLat, originLng, 9);
const destH3 = latLngToCell(destLat, destLng, 9);
```

**Validación de H3:**
- Resolución: 9 (obligatorio)
- Longitud: 15 caracteres
- Formato: hexadecimal

### 7.4 Seguridad

#### Protección de Datos Sensibles

1. **Nunca almacenar tokens en localStorage**: Usar sessionStorage o memoria
2. **HTTPS en producción**: Usar HTTPS en entornos públicos; HTTP solo para entornos internos/desarrollo
3. **JWT validado por Gateway**: Los 401/403 provienen del Gateway, no del servicio
4. **CORS centralizado**: El Gateway define los orígenes permitidos
5. **Validación del lado del cliente**: Validar datos antes de enviar
6. **No exponer IDs internos**: Los UUIDs son seguros de exponer

#### Headers de Seguridad

Siempre incluir:
```http
Authorization: Bearer <token>
Content-Type: application/json
```

Opcional (recomendado):
```http
X-Request-ID: <uuid>  // Para tracking de requests
User-Agent: <app-info> // Identificación de la app
```

El Gateway agrega `X-Request-ID` y `X-Gateway-Version` en las respuestas para trazabilidad.

### 7.5 Optimización de Performance

#### Caché del Lado del Cliente

**NO cachear:**
- Estado del trip (siempre verificar con servidor)
- Precios (pueden cambiar por surge pricing)

**SÍ cachear (con TTL corto):**
- Listado de tipos de vehículos (TTL: 1 hora)
- Configuración de ciudades (TTL: 1 hora)

#### Reducción de Latencia

1. **Pre-cálculo de H3**: Calcular índices H3 mientras el usuario selecciona ubicación
2. **Validación anticipada**: Validar datos del formulario antes de enviar
3. **Feedback inmediato**: Mostrar loaders inmediatamente al hacer peticiones
4. **Timeouts apropiados**: No esperar más del tiempo recomendado

### 7.6 Experiencia de Usuario

#### Estados de Carga

Implementar estados de carga claros para cada operación:

```typescript
// Ejemplo ilustrativo de estados
interface UIState {
  loading: boolean;
  error: string | null;
  success: boolean;
}
```

#### Mensajes de Error Amigables

Mapear errores técnicos a mensajes comprensibles:

| Error Técnico | Mensaje al Usuario |
|---------------|-------------------|
| `401 Unauthorized` | "Tu sesión ha expirado. Por favor inicia sesión nuevamente." |
| `404 Not Found` | "No se encontró el viaje solicitado." |
| `500 Internal Error` | "Ocurrió un error inesperado. Por favor intenta nuevamente." |
| `Network Error` | "Verifica tu conexión a internet e intenta nuevamente." |

#### Confirmaciones Críticas

Solicitar confirmación del usuario para acciones irreversibles:
- Cancelar trip después de asignación
- Completar trip (conductor)

---

## 8. Apéndices

### 8.1 Glosario de Términos

| Término | Definición |
|---------|-----------|
| **Trip** | Un viaje completo desde solicitud hasta finalización |
| **Rider** | Pasajero que solicita un viaje |
| **Driver** | Conductor que acepta y realiza el viaje |
| **Quote** | Cotización de precio estimado |
| **Surge Multiplier** | Multiplicador de demanda dinámica |
| **H3 Index** | Índice hexagonal jerárquico para geolocalización |
| **PIN** | Código de verificación del pasajero |
| **Payment Intent** | Intención de pago creada para procesar el cobro |
| **Degradation** | Modo de operación reducida cuando servicios dependientes fallan |

### 8.2 Enumeraciones

#### TripStatus

```typescript
enum TripStatus {
  REQUESTED = 'REQUESTED',           // Viaje solicitado por pasajero
  OFFERED = 'OFFERED',               // Viaje ofrecido a conductores cercanos
  ASSIGNED = 'ASSIGNED',             // Conductor asignado, PIN generado
  PICKUP_STARTED = 'PICKUP_STARTED', // PIN verificado, conductor en punto de recogida
  IN_PROGRESS = 'IN_PROGRESS',       // Viaje en curso
  COMPLETED = 'COMPLETED',           // Viaje completado (⚠️ bloqueado por MS07-PAYMENTS)
  PAID = 'PAID',                     // Pago procesado (❌ no disponible)
  CANCELED = 'CANCELED'              // Viaje cancelado
}
```

#### PaymentMethod

```typescript
enum PaymentMethod {
  CASH = 'cash',   // Pago en efectivo
  QR = 'qr'        // Pago por QR
}
```

#### CancelReason

```typescript
enum CancelReason {
  RIDER_CANCELLED = 'RIDER_CANCELLED',           // Pasajero canceló
  DRIVER_CANCELLED = 'DRIVER_CANCELLED',         // Conductor canceló
  NO_SHOW = 'NO_SHOW',                           // No show del pasajero
  SYSTEM_TIMEOUT = 'SYSTEM_TIMEOUT',             // Timeout del sistema
  REASSIGN_EXHAUSTED = 'REASSIGN_EXHAUSTED'      // Reintentos agotados
}
```

#### CancelSide

```typescript
enum CancelSide {
  RIDER = 'rider',     // Cancelación por pasajero
  DRIVER = 'driver',   // Cancelación por conductor
  SYSTEM = 'system'    // Cancelación automática
}
```

### 8.3 Tipos de Vehículos

| Tipo | Descripción | Capacidad |
|------|-------------|-----------|
| `economy` | Vehículo económico | 4 pasajeros |
| `comfort` | Vehículo confortable | 4 pasajeros |
| `premium` | Vehículo premium | 4 pasajeros |
| `xl` | Vehículo grande | 6+ pasajeros |
| `delivery` | Servicio de delivery | N/A |
| `moto` | Motocicleta | 1 pasajero |

### 8.4 Ciudades Soportadas

| Código | Ciudad | País |
|--------|--------|------|
| `LPZ` | La Paz | Bolivia |
| `CBB` | Cochabamba | Bolivia |
| `SCZ` | Santa Cruz | Bolivia |

### 8.5 Recursos Adicionales

- **Documentación H3**: https://h3geo.org/
- **Gateway Argo**: `argo-gateway/DOCUMENTACION_GATEWAY.md`
- **MS02-AUTH**: Consultar guía de autenticación
- **MS07-PAYMENTS**: ⚠️ **AÚN NO DESARROLLADO** - Cuando esté disponible, consultar guía de pagos

### 8.6 Estado de Dependencias

| Microservicio | Estado | Impacto en Trips |
|---------------|--------|------------------|
| MS02-AUTH | ✅ Desplegado | Autenticación funcional |
| MS03-DRIVER-SESSIONS | ✅ Desplegado | Validación de conductores funcional |
| MS06-PRICING | ✅ Desplegado | Cotización y precio final funcional |
| MS10-GEO | ✅ Desplegado | Rutas, ETA y H3 funcional |
| MS07-PAYMENTS | ❌ No desarrollado | Bloquea `/complete` y estado `PAID` |

### 8.7 Flujo Completo de Ejemplo

A continuación, un ejemplo paso a paso de un flujo completo:

**1. Pasajero crea viaje**
```http
POST /trips
{
  "riderId": "rider-001",
  "vehicleType": "economy",
  "city": "LPZ",
  "payment_method": "cash",
  "originLat": -16.5000,
  "originLng": -68.1193,
  "originH3Res9": "89283082827ffff",
  "destLat": -16.5100,
  "destLng": -68.1293,
  "destH3Res9": "89283082837ffff"
}
```

**Response: 201**
```json
{
  "id": "trip-123",
  "status": "REQUESTED",
  "paymentMethod": "cash",
  "estimateTotal": 25.50,
  ...
}
```

**2. Conductor acepta viaje**
```http
PATCH /trips/trip-123/accept
{
  "driverId": "driver-456"
}
```

**Response: 200**
```json
{
  "id": "trip-123",
  "status": "ASSIGNED",
  "driverId": "driver-456"
}
```

**3. Pasajero verifica PIN**
```http
POST /trips/trip-123/pin/verify
{
  "pin": "1234"
}
```

**Response: 200**
```json
{
  "verified": true,
  "tripId": "trip-123"
}
```

**4. Conductor inicia viaje**
```http
PATCH /trips/trip-123/start
```

**Response: 200**
```json
{
  "id": "trip-123",
  "status": "IN_PROGRESS",
  "inProgressAt": "2025-12-20T10:40:00.000Z"
}
```

**5. Conductor completa viaje**
```http
PATCH /trips/trip-123/complete
{
  "distance_m_final": 5800,
  "duration_s_final": 840
}
```

**Response: 200**
```json
{
  "id": "trip-123",
  "status": "COMPLETED",
  "totalPrice": 27.80,
  "paymentIntentId": "pi_789",
  ...
}
```

---

## Soporte y Contacto

Para preguntas, dudas o reportar problemas con esta guía de integración:

- **Equipo de Backend**: Pablo Toledo
---

**Fecha**: Enero 2026
**Versión**: 1.2.0
**Última revisión**: Actualización de estados del trip y documentación de bloqueo por MS07-PAYMENTS
