#!/bin/bash
set -euo pipefail

###############################################################################
# deploy-trips.sh
# Script de despliegue para MS04-TRIPS en AWS ECS Fargate
#
# ARQUITECTURA OPTIMIZADA (Enero 2026):
# - 1 ALB compartido con routing por paths (NO crear ALB propio)
# - Cloud Map para service discovery interno (argo.local)
# - Single-AZ para desarrollo (subnet única)
# - desiredCount=0 por defecto (control de costos)
#
# Basado en: GUIA_DESPLIEGUE_MICROSERVICIOS_ARGO.md
#
# Uso: ./deploy-trips.sh
###############################################################################

echo "=============================================="
echo "Deploying argo-trips to AWS ECS/Fargate"
echo "=============================================="

# =============================================================================
# 1. Variables de Infraestructura (NO MODIFICAR - valores de la guía oficial)
# =============================================================================
export AWS_REGION="us-east-2"
export AWS_ACCOUNT_ID="522195962216"
export ECR_REPO_NAME="argo-trips"
export ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"
export IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
export ECS_CLUSTER="argo-cluster"
export ECS_SERVICE="argo-trips-service"
export CLOUD_MAP_NAMESPACE="argo.local"
export BUILDX_BUILDER="argo-builder"

# Infraestructura compartida (Single-AZ para desarrollo)
export SUBNET_ID="subnet-09d829aab7d6307a6"  # us-east-2a únicamente
export SECURITY_GROUP_ID="sg-0be38c7c217448d01"  # ECS tasks security group
export EXECUTION_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole"

# Task sizing para trips (según guía: procesamiento moderado)
export TASK_CPU="512"
export TASK_MEMORY="1024"

echo ""
echo "Configuration:"
echo "   AWS_REGION:       $AWS_REGION"
echo "   AWS_ACCOUNT:      $AWS_ACCOUNT_ID"
echo "   ECR_URI:          $ECR_URI"
echo "   IMAGE_TAG:        $IMAGE_TAG"
echo "   ECS_CLUSTER:      $ECS_CLUSTER"
echo "   ECS_SERVICE:      $ECS_SERVICE"
echo "   CLOUD_MAP:        $CLOUD_MAP_NAMESPACE"
echo "   SUBNET:           $SUBNET_ID (Single-AZ: us-east-2a)"
echo "   TASK_SIZE:        ${TASK_CPU} CPU, ${TASK_MEMORY} MB"
echo ""

# =============================================================================
# 2. Login en ECR
# =============================================================================
echo "Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS \
  --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "ECR login successful"

# =============================================================================
# 3. Crear repositorio ECR si no existe
# =============================================================================
echo ""
echo "Checking ECR repository..."
aws ecr describe-repositories \
  --repository-names "$ECR_REPO_NAME" \
  --region "$AWS_REGION" >/dev/null 2>&1 || \
aws ecr create-repository \
  --repository-name "$ECR_REPO_NAME" \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --tags Key=Environment,Value=development Key=Project,Value=argo Key=Service,Value=trips \
  --region "$AWS_REGION"

echo "ECR repository ready"

# =============================================================================
# 4. Build + Push para linux/amd64 usando buildx
# =============================================================================
echo ""
echo "Building Docker image for linux/amd64..."

# Crear builder si no existe
docker buildx inspect "$BUILDX_BUILDER" >/dev/null 2>&1 || \
  docker buildx create --name "$BUILDX_BUILDER" --driver docker-container --bootstrap

docker buildx use "$BUILDX_BUILDER"

# Build y push
docker buildx build \
  --builder "$BUILDX_BUILDER" \
  --platform linux/amd64 \
  -t "$ECR_URI:$IMAGE_TAG" \
  -t "$ECR_URI:latest" \
  -f Dockerfile \
  . \
  --push

echo "Image pushed: $ECR_URI:$IMAGE_TAG"

# =============================================================================
# 5. Crear Log Group con retención de 7 días (OBLIGATORIO en desarrollo)
# =============================================================================
echo ""
echo "Ensuring CloudWatch log group with 7-day retention..."
aws logs create-log-group \
  --log-group-name "/ecs/argo-trips" \
  --region "$AWS_REGION" 2>/dev/null || echo "   Log group already exists"

aws logs put-retention-policy \
  --log-group-name "/ecs/argo-trips" \
  --retention-in-days 7 \
  --region "$AWS_REGION"

echo "Log group configured with 7-day retention"

# =============================================================================
# 6. Detectar si el servicio ECS existe
# =============================================================================
echo ""
echo "Checking if ECS service exists..."

SERVICE_EXISTS=$(aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --region "$AWS_REGION" \
  --query 'services[?status==`ACTIVE`] | length(@)' \
  --output text)

if [[ "$SERVICE_EXISTS" == "0" ]]; then
  echo "ECS service does not exist. Creating for FIRST DEPLOY..."
  echo ""

  # ===========================================================================
  # PRIMER DEPLOY: Crear Cloud Map Service, Task Definition y ECS Service
  # ===========================================================================

  # Leer variables de entorno desde .env
  if [[ ! -f ".env" ]]; then
    echo "ERROR: .env file not found"
    exit 1
  fi

  source .env

  # -------------------------------------------------------------------------
  # 6.1 Registrar servicio en Cloud Map (argo.local)
  # -------------------------------------------------------------------------
  echo "Registering service in Cloud Map (${CLOUD_MAP_NAMESPACE})..."

  # Obtener namespace ID
  NAMESPACE_ID=$(aws servicediscovery list-namespaces \
    --query "Namespaces[?Name=='${CLOUD_MAP_NAMESPACE}'].Id" \
    --output text \
    --region "$AWS_REGION")

  if [[ -z "$NAMESPACE_ID" || "$NAMESPACE_ID" == "None" ]]; then
    echo "ERROR: Cloud Map namespace '${CLOUD_MAP_NAMESPACE}' not found"
    echo "Please create it first or contact DevOps team"
    exit 1
  fi

  echo "   Namespace ID: $NAMESPACE_ID"

  # Verificar si el servicio ya existe en Cloud Map
  CLOUD_MAP_SERVICE_ID=$(aws servicediscovery list-services \
    --query "Services[?Name=='argo-trips'].Id" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")

  if [[ -z "$CLOUD_MAP_SERVICE_ID" || "$CLOUD_MAP_SERVICE_ID" == "None" ]]; then
    # Crear servicio en Cloud Map
    CLOUD_MAP_SERVICE_ARN=$(aws servicediscovery create-service \
      --name "argo-trips" \
      --namespace-id "$NAMESPACE_ID" \
      --dns-config "NamespaceId=${NAMESPACE_ID},DnsRecords=[{Type=A,TTL=10}]" \
      --health-check-custom-config FailureThreshold=1 \
      --query 'Service.Arn' \
      --output text \
      --region "$AWS_REGION")

    CLOUD_MAP_SERVICE_ID=$(echo "$CLOUD_MAP_SERVICE_ARN" | rev | cut -d'/' -f1 | rev)
    echo "   Created Cloud Map service: argo-trips"
  else
    CLOUD_MAP_SERVICE_ARN=$(aws servicediscovery get-service \
      --id "$CLOUD_MAP_SERVICE_ID" \
      --query 'Service.Arn' \
      --output text \
      --region "$AWS_REGION")
    echo "   Cloud Map service already exists: argo-trips"
  fi

  echo "   Service Registry ARN: $CLOUD_MAP_SERVICE_ARN"

  # -------------------------------------------------------------------------
  # 6.2 Crear Task Definition
  # -------------------------------------------------------------------------
  echo ""
  echo "Creating task definition..."

  # URLs de servicios internos (via Cloud Map o ALB)
  # Usando ALB compartido para servicios externos según la guía
  ALB_URL="http://argo-shared-alb-828452645.us-east-2.elb.amazonaws.com"

  cat > task-def-trips.json <<EOF
{
  "family": "argo-trips-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "${TASK_CPU}",
  "memory": "${TASK_MEMORY}",
  "executionRoleArn": "${EXECUTION_ROLE_ARN}",
  "runtimePlatform": {
    "cpuArchitecture": "X86_64",
    "operatingSystemFamily": "LINUX"
  },
  "containerDefinitions": [
    {
      "name": "argo-trips",
      "image": "${ECR_URI}:${IMAGE_TAG}",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"},
        {"name": "SERVICE_ID", "value": "argo-trips"},
        {"name": "PRICING_SERVICE_URL", "value": "${PRICING_SERVICE_URL:-${ALB_URL}/pricing}"},
        {"name": "GEO_SERVICE_URL", "value": "${GEO_SERVICE_URL:-${ALB_URL}/geo}"},
        {"name": "DRIVER_SESSIONS_SERVICE_URL", "value": "${DRIVER_SESSIONS_SERVICE_URL:-${ALB_URL}/driver-sessions}"},
        {"name": "AUTH_SERVICE_URL", "value": "${AUTH_SERVICE_URL:-${ALB_URL}/auth}"},
        {"name": "PAYMENTS_URL", "value": "${PAYMENTS_URL:-}"},
        {"name": "SERVICE_EMAIL", "value": "${SERVICE_EMAIL:-admin@example.com}"},
        {"name": "SERVICE_PASSWORD", "value": "${SERVICE_PASSWORD:-Admin1234}"}
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:/argo/trips/database-url"
        },
        {
          "name": "REDIS_URL",
          "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:/argo/trips/redis-url"
        },
        {
          "name": "REDIS_EVENT_BUS_URL",
          "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:/argo/trips/redis-event-bus-url"
        }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/argo-trips",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs",
          "mode": "non-blocking",
          "max-buffer-size": "25m"
        }
      }
    }
  ],
  "tags": [
    {"key": "Environment", "value": "development"},
    {"key": "Project", "value": "argo"},
    {"key": "Service", "value": "trips"}
  ]
}
EOF

  # Registrar task definition
  echo "Registering task definition..."
  REGISTER_OUTPUT=$(aws ecs register-task-definition \
    --cli-input-json file://task-def-trips.json \
    --region "$AWS_REGION")

  TASK_DEF_ARN=$(echo "$REGISTER_OUTPUT" | jq -r '.taskDefinition.taskDefinitionArn')
  echo "Task definition registered: $TASK_DEF_ARN"

  # -------------------------------------------------------------------------
  # 6.3 Crear ECS Service con Cloud Map (desiredCount=0)
  # -------------------------------------------------------------------------
  echo ""
  echo "Creating ECS service with Cloud Map integration..."
  echo "IMPORTANT: desiredCount=0 (cost control - start manually when needed)"

  aws ecs create-service \
    --cluster "$ECS_CLUSTER" \
    --service-name "$ECS_SERVICE" \
    --task-definition "$TASK_DEF_ARN" \
    --desired-count 0 \
    --launch-type FARGATE \
    --platform-version LATEST \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_ID}],securityGroups=[${SECURITY_GROUP_ID}],assignPublicIp=ENABLED}" \
    --service-registries "registryArn=${CLOUD_MAP_SERVICE_ARN}" \
    --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}" \
    --tags key=Environment,value=development key=Project,value=argo key=Service,value=trips \
    --region "$AWS_REGION" \
    --output json | jq '{
      serviceName: .service.serviceName,
      status: .service.status,
      desiredCount: .service.desiredCount,
      taskDefinition: .service.taskDefinition
    }'

  echo "ECS service created successfully"

  # Limpiar archivo temporal
  rm -f task-def-trips.json

  echo ""
  echo "=============================================="
  echo "FIRST DEPLOY COMPLETED"
  echo "=============================================="
  echo ""
  echo "Next steps:"
  echo "1. Create secrets in AWS Secrets Manager (if not exist):"
  echo "   - /argo/trips/database-url"
  echo "   - /argo/trips/redis-url"
  echo "   - /argo/trips/redis-event-bus-url"
  echo ""
  echo "2. Request Gateway configuration from DevOps team:"
  echo "   - Path prefix: /trips/*"
  echo "   - Health check path: /health"
  echo "   - Protected routes (JWT required)"
  echo ""
  echo "3. Start the service when ready:"
  echo "   aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --desired-count 1 --region $AWS_REGION"
  echo ""

else
  echo "ECS service exists. Proceeding with UPDATE..."

  # ===========================================================================
  # DEPLOY POSTERIOR: Actualizar Task Definition y forzar nuevo deployment
  # ===========================================================================

  # Obtener la taskDefinition actual
  echo ""
  echo "Getting current task definition..."

  CURRENT_TASK_ARN=$(aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION" \
    --query 'services[0].taskDefinition' \
    --output text)

  echo "   Current: $CURRENT_TASK_ARN"

  aws ecs describe-task-definition \
    --task-definition "$CURRENT_TASK_ARN" \
    --region "$AWS_REGION" \
    --query 'taskDefinition' \
    --output json > task-def-current.json

  # Extraer solo los campos necesarios y actualizar imagen
  echo "Creating new task definition with updated image..."

  cat task-def-current.json | jq --arg IMAGE "$ECR_URI:$IMAGE_TAG" '{
    family,
    networkMode,
    executionRoleArn,
    containerDefinitions: [.containerDefinitions[0] | .image = $IMAGE],
    requiresCompatibilities,
    cpu,
    memory,
    runtimePlatform
  }' > task-def-new.json

  # Registrar nueva taskDefinition revision
  echo "Registering new task definition..."

  REGISTER_OUTPUT=$(aws ecs register-task-definition \
    --cli-input-json file://task-def-new.json \
    --region "$AWS_REGION")

  NEW_TASK_DEF_ARN=$(echo "$REGISTER_OUTPUT" | jq -r '.taskDefinition.taskDefinitionArn')
  NEW_REVISION=$(echo "$REGISTER_OUTPUT" | jq -r '.taskDefinition.revision')

  echo "New task definition registered:"
  echo "   ARN: $NEW_TASK_DEF_ARN"
  echo "   Revision: $NEW_REVISION"

  # Actualizar el servicio ECS
  echo ""
  echo "Updating ECS service..."

  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --task-definition "$NEW_TASK_DEF_ARN" \
    --region "$AWS_REGION" \
    --output json | jq '{
      serviceName: .service.serviceName,
      status: .service.status,
      desiredCount: .service.desiredCount,
      runningCount: .service.runningCount,
      taskDefinition: .service.taskDefinition
    }'

  echo "ECS service updated"

  # Limpiar archivos temporales
  rm -f task-def-current.json task-def-new.json
fi

# =============================================================================
# 7. Verificar estado del deployment (si hay tasks corriendo)
# =============================================================================
echo ""
echo "Checking current service status..."

SERVICE_STATUS=$(aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --region "$AWS_REGION" \
  --output json | jq '{
    serviceName: .services[0].serviceName,
    status: .services[0].status,
    desiredCount: .services[0].desiredCount,
    runningCount: .services[0].runningCount,
    pendingCount: .services[0].pendingCount,
    taskDefinition: .services[0].taskDefinition
  }')

echo "$SERVICE_STATUS"

DESIRED_COUNT=$(echo "$SERVICE_STATUS" | jq -r '.desiredCount')

if [[ "$DESIRED_COUNT" == "0" ]]; then
  echo ""
  echo "=============================================="
  echo "DEPLOYMENT READY (Service stopped)"
  echo "=============================================="
  echo ""
  echo "The service is deployed but NOT running (desiredCount=0)"
  echo "This is intentional for cost control in development."
  echo ""
  echo "To start the service:"
  echo "   aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --desired-count 1 --region $AWS_REGION"
  echo ""
  echo "To stop when done:"
  echo "   aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --desired-count 0 --region $AWS_REGION"
  echo ""
else
  echo ""
  echo "Waiting for service to stabilize..."
  aws ecs wait services-stable \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION"

  echo ""
  echo "=============================================="
  echo "DEPLOYMENT COMPLETED"
  echo "=============================================="
fi

echo ""
echo "Summary:"
echo "   Image:        $ECR_URI:$IMAGE_TAG"
echo "   Service:      $ECS_SERVICE"
echo "   Cluster:      $ECS_CLUSTER"
echo "   Region:       $AWS_REGION"
echo "   Cloud Map:    argo-trips.${CLOUD_MAP_NAMESPACE}"
echo ""
echo "Test endpoint (when running):"
echo "   curl http://argo-shared-alb-828452645.us-east-2.elb.amazonaws.com/trips/health"
echo ""
