# MS04-TRIPS - Guía de Testing en Producción

Este documento describe cómo probar el microservicio MS04-TRIPS desplegado en AWS usando las herramientas de testing proporcionadas.

## 📦 Herramientas Disponibles

### 1. Colección de Postman (`postman-collection.json`)
- ✅ Interfaz gráfica intuitiva
- ✅ Tests automatizados por endpoint
- ✅ Variables de entorno configuradas
- ✅ Ideal para testing manual y debugging

### 2. Script Automatizado (`test-endpoints.sh`)
- ✅ Testing automatizado completo
- ✅ Salida con colores y resumen de resultados
- ✅ Ideal para CI/CD y testing rápido
- ✅ No requiere interfaz gráfica

---

## 🚀 Opción 1: Testing con Postman

### Paso 1: Importar la Colección

1. Abre Postman
2. Click en **Import** (esquina superior izquierda)
3. Selecciona el archivo `postman-collection.json`
4. La colección "MS04-TRIPS API - Production Tests" se importará automáticamente

### Paso 2: Obtener JWT Token

Necesitas un token JWT válido de MS02-AUTH. Puedes obtenerlo de dos formas:

#### Opción A: Login desde Postman
```bash
# Endpoint de login (ejemplo)
POST http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/auth/login

# Body
{
  "email": "user@example.com",
  "password": "password123"
}

# Response incluirá el JWT token
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Opción B: Usar token existente
Si ya tienes un token JWT, cópialo.

### Paso 3: Configurar Variables

1. En Postman, selecciona la colección **MS04-TRIPS API - Production Tests**
2. Click en la pestaña **Variables**
3. Actualiza el valor de `jwt_token` con tu token JWT:
   ```
   jwt_token = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. Click **Save**

### Paso 4: Ejecutar Tests

#### Testing Manual (Request por Request)

1. Expande la carpeta **Health Checks**
2. Selecciona "Health Check - Public"
3. Click **Send**
4. Verifica que la respuesta sea 200 OK

Continúa con el flujo completo:

```
1. Health Checks/Health Check - Public
2. Health Checks/Health Check - Database
3. Trip Lifecycle/1. Create Trip
4. Trip Lifecycle/2. Accept Trip
5. Trip Lifecycle/3. Verify PIN
6. Trip Lifecycle/4. Start Trip
7. Trip Lifecycle/5. Complete Trip
8. Trip Cancellation/Cancel Trip - Rider
```

#### Testing Automatizado (Collection Runner)

1. Click en la colección **MS04-TRIPS API - Production Tests**
2. Click en **Run** (botón azul en la parte superior)
3. En el Collection Runner:
   - Selecciona todos los folders o requests específicos
   - Click **Run MS04-TRIPS API - Production Tests**
4. Observa los resultados en tiempo real

**IMPORTANTE**: Los tests en "Trip Lifecycle" deben ejecutarse en orden secuencial porque:
- `Create Trip` genera un `trip_id` que se guarda automáticamente
- Los siguientes requests usan ese `trip_id`

### Paso 5: Verificar Resultados

Postman ejecuta tests automáticos en cada request:

✅ **Tests Pasados**: Aparecen en verde
❌ **Tests Fallados**: Aparecen en rojo con detalles del error

Ejemplo de tests automáticos:
```javascript
✓ Status code is 201
✓ Trip created successfully
✓ Pricing breakdown is present
```

---

## 🖥️ Opción 2: Testing con Script Automatizado

### Paso 1: Verificar Dependencias

El script requiere `jq` para parsear JSON. Instálalo si no lo tienes:

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq
```

### Paso 2: Obtener JWT Token

Igual que en Postman, necesitas un token JWT válido de MS02-AUTH.

### Paso 3: Ejecutar el Script

```bash
# Formato
./test-endpoints.sh <JWT_TOKEN>

# Ejemplo
./test-endpoints.sh eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### Paso 4: Interpretar Resultados

El script produce output con colores:

```
==============================================
🧪 MS04-TRIPS - Production API Testing
==============================================

ℹ️  INFO: Gateway URL: http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com
ℹ️  INFO: Base URL: http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/trips
ℹ️  INFO: Rider ID: rider-test-1703012345
ℹ️  INFO: Driver ID: driver-67890

==============================================
📊 Health Checks
==============================================

TEST: Health check público (sin autenticación)
✅ PASS: Health check público respondió 200 OK
ℹ️  INFO: Response: {"status":"healthy","service":"argo-trips"}

TEST: Health check con verificación de base de datos
✅ PASS: Database health check: OK

==============================================
🚗 Trip Lifecycle - Full Flow
==============================================

TEST: Crear nuevo viaje (POST /trips)
✅ PASS: Trip creado exitosamente: 01JFHK3M2XQRST8UVWXYZ01234
ℹ️  INFO: Status: PENDING
ℹ️  INFO: Estimate Total: $15.50
ℹ️  INFO: Quote ID: quote-abc123def456

...

==============================================
📈 Test Summary
==============================================

Total Tests: 10
Passed:      10
Failed:      0

✅ All tests passed!
```

### Códigos de Salida

- `0`: Todos los tests pasaron
- `1`: Algunos tests fallaron (útil para CI/CD)

---

## 📋 Endpoints Disponibles

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/trips/healthz` | Health check público | ❌ No |
| GET | `/trips/health` | Health check con DB | ❌ No |
| POST | `/trips` | Crear viaje | ✅ Sí |
| PATCH | `/trips/:id/accept` | Aceptar viaje | ✅ Sí |
| POST | `/trips/:id/pin/verify` | Verificar PIN | ✅ Sí |
| PATCH | `/trips/:id/start` | Iniciar viaje | ✅ Sí |
| PATCH | `/trips/:id/complete` | Completar viaje | ✅ Sí |
| PATCH | `/trips/:id/cancel` | Cancelar viaje | ✅ Sí |

---

## 🔍 Datos de Prueba

### Ubicaciones (Columbus, OH)

**Origin (Downtown Columbus):**
- Latitud: `39.9612`
- Longitud: `-82.9988`
- H3 Res9: `89284a8371fffff`

**Destination (Ohio State University):**
- Latitud: `40.0067`
- Longitud: `-83.0305`
- H3 Res9: `89284a8b57fffff`

### IDs de Prueba

```json
{
  "riderId": "rider-12345",
  "driverId": "driver-67890",
  "vehicleType": "sedan",
  "city": "columbus",
  "pin": "1234"
}
```

### Valores de Enums

**CancelReason:**
- `RIDER_CANCELLED`
- `DRIVER_CANCELLED`
- `NO_SHOW`
- `SYSTEM_TIMEOUT`
- `REASSIGN_EXHAUSTED`

**CancelSide:**
- `rider`
- `driver`
- `system`

---

## ✅ Flujo Completo de Testing

### Escenario 1: Viaje Exitoso (Happy Path)

```
1. Create Trip
   ↓ trip_id = abc-123

2. Accept Trip (driver-67890)
   ↓ status = ACCEPTED

3. Verify PIN (1234)
   ↓ verified = true

4. Start Trip
   ↓ status = IN_PROGRESS

5. Complete Trip
   ↓ status = COMPLETED
   ↓ paymentIntentId = pi_xyz789
```

### Escenario 2: Viaje Cancelado por Rider

```
1. Create Trip
   ↓ trip_id = def-456

2. Cancel Trip (RIDER_CANCELLED, side: rider)
   ↓ status = CANCELLED
```

### Escenario 3: Viaje Cancelado por Driver

```
1. Create Trip
   ↓ trip_id = ghi-789

2. Accept Trip (driver-67890)
   ↓ status = ACCEPTED

3. Cancel Trip (DRIVER_CANCELLED, side: driver)
   ↓ status = CANCELLED
```

---

## ⚠️ Errores Comunes

### 1. Error 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Solución**: Verifica que el JWT token sea válido y no haya expirado.

### 2. Driver Not Online

```json
{
  "statusCode": 400,
  "message": "Driver driver-67890 is not online"
}
```

**Solución**: Esto es **esperado en testing** si el driver no está realmente conectado en MS03-DRIVER-SESSIONS. Para testing completo:
- Usa un driver_id que esté realmente online en MS03
- O configura un driver mock en MS03-DRIVER-SESSIONS

### 3. Invalid H3 Cell

```json
{
  "statusCode": 400,
  "message": "Invalid H3 cell format"
}
```

**Solución**: Verifica que los valores de `originH3Res9` y `destH3Res9` sean válidos. Usa los valores de ejemplo proporcionados.

### 4. Trip Not Found

```json
{
  "statusCode": 404,
  "message": "Trip not found"
}
```

**Solución**: El `trip_id` no existe. Crea un nuevo trip primero.

### 5. Invalid State Transition

```json
{
  "statusCode": 400,
  "message": "Cannot start trip in current state"
}
```

**Solución**: Los trips tienen un flujo de estados estricto:
```
PENDING → ACCEPTED → IN_PROGRESS → COMPLETED
        ↓            ↓
      CANCELLED    CANCELLED
```

---

## 🔧 Troubleshooting

### Ver logs del servicio

```bash
# Logs en tiempo real
aws logs tail /ecs/argo-trips \
  --region us-east-2 \
  --follow

# Filtrar errores
aws logs tail /ecs/argo-trips \
  --region us-east-2 \
  --filter-pattern "ERROR"
```

### Verificar estado del servicio

```bash
aws ecs describe-services \
  --cluster argo-cluster \
  --services argo-trips-service \
  --region us-east-2 \
  --query 'services[0].[status,runningCount,desiredCount]'
```

### Verificar health del ALB

```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-2:228864602830:targetgroup/tg-argo-trips/... \
  --region us-east-2
```

---

## 📊 Integración con CI/CD

### GitHub Actions Example

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y jq curl

      - name: Run API tests
        env:
          JWT_TOKEN: ${{ secrets.JWT_TOKEN }}
        run: |
          chmod +x test-endpoints.sh
          ./test-endpoints.sh $JWT_TOKEN
```

### GitLab CI Example

```yaml
test_api:
  stage: test
  image: alpine:latest
  before_script:
    - apk add --no-cache curl jq bash
  script:
    - chmod +x test-endpoints.sh
    - ./test-endpoints.sh $JWT_TOKEN
  only:
    - main
    - develop
```

---

## 📝 Notas Importantes

1. **JWT Token Expiration**: Los tokens JWT expiran. Si obtienes errores 401, genera un nuevo token.

2. **Rate Limiting**: El servicio tiene rate limiting configurado. Si ejecutas muchos tests rápidamente, podrías recibir errores 429 (Too Many Requests).

3. **Driver Sessions**: Para testing completo de `Accept Trip`, necesitas un driver que esté realmente online en MS03-DRIVER-SESSIONS.

4. **Database State**: Los trips se crean realmente en la base de datos. Usa IDs únicos para cada ejecución de testing.

5. **Production Testing**: Estos tests están diseñados para el ambiente de producción. Ten cuidado de no generar basura en la base de datos.

---

## 🎯 Próximos Pasos

Una vez verificado que todos los endpoints funcionan correctamente:

1. ✅ **Documentar para Frontend**: Usa los ejemplos de Postman como base para la documentación de API
2. ✅ **Swagger/OpenAPI**: Considera agregar Swagger UI para documentación interactiva
3. ✅ **Monitoring**: Configura alertas en CloudWatch para errores y latencia
4. ✅ **Performance Testing**: Usa herramientas como k6 o Artillery para load testing

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs del servicio en CloudWatch
2. Verifica que el Gateway esté correctamente configurado
3. Confirma que MS10-GEO, MS06-PRICING y MS03-DRIVER-SESSIONS estén operativos
4. Verifica el estado del ALB y targets

---

**Última actualización**: 2024-12-18
**Versión**: 1.0.0
**Microservicio**: MS04-TRIPS
**Ambiente**: Production (AWS ECS)
