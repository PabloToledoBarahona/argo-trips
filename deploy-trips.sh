#!/bin/bash
set -euo pipefail

###############################################################################
# deploy-trips.sh
# Script de despliegue CI/CD para MS04 – argo-trips en AWS ECS/Fargate
#
# Este script maneja tanto el PRIMER DEPLOY como deploys posteriores.
#
# IMPORTANTE - CONFIGURACIÓN REQUERIDA ANTES DEL PRIMER DEPLOY:
# - Asegúrate de configurar las variables SUBNET_IDS y SECURITY_GROUP_IDS
#   en la sección "Network Configuration" más abajo
# - Estas deben corresponder a tu VPC existente en us-east-2
# - Puedes obtenerlas desde la consola de AWS o desde otro servicio ya desplegado
#
# Uso: ./deploy-trips.sh
###############################################################################

echo "=============================================="
echo "🚀 Deploying argo-trips to AWS ECS/Fargate"
echo "=============================================="

# =============================================================================
# 1. Variables de entorno
# =============================================================================
export AWS_REGION="us-east-2"
export AWS_ACCOUNT_ID="228864602830"
export ECR_REPO_NAME="argo-trips"
export ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"
export IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
export ECS_CLUSTER="argo-cluster"
export ECS_SERVICE="argo-trips-service"
export BUILDX_BUILDER="argo-builder"

echo ""
echo "📋 Configuration:"
echo "   AWS_REGION:    $AWS_REGION"
echo "   AWS_ACCOUNT:   $AWS_ACCOUNT_ID"
echo "   ECR_URI:       $ECR_URI"
echo "   IMAGE_TAG:     $IMAGE_TAG"
echo "   ECS_CLUSTER:   $ECS_CLUSTER"
echo "   ECS_SERVICE:   $ECS_SERVICE"
echo ""

# =============================================================================
# 2. Login en ECR
# =============================================================================
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS \
  --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "✅ ECR login successful"

# =============================================================================
# 3. Crear repositorio ECR si no existe
# =============================================================================
echo ""
echo "📦 Checking ECR repository..."
aws ecr describe-repositories \
  --repository-names "$ECR_REPO_NAME" \
  --region "$AWS_REGION" >/dev/null 2>&1 || \
aws ecr create-repository \
  --repository-name "$ECR_REPO_NAME" \
  --image-scanning-configuration scanOnPush=true \
  --region "$AWS_REGION"

echo "✅ ECR repository ready"

# =============================================================================
# 4. Build + Push para linux/amd64 usando buildx
# =============================================================================
echo ""
echo "🔨 Building Docker image for linux/amd64..."

# Usar el builder existente
docker buildx use "$BUILDX_BUILDER"
docker buildx inspect --bootstrap "$BUILDX_BUILDER"

# Build y push
docker buildx build \
  --builder "$BUILDX_BUILDER" \
  --platform linux/amd64 \
  -t "$ECR_URI:$IMAGE_TAG" \
  -t "$ECR_URI:latest" \
  -f Dockerfile \
  . \
  --push

echo "✅ Image pushed: $ECR_URI:$IMAGE_TAG"

# =============================================================================
# 5. Detectar si el servicio ECS existe
# =============================================================================
echo ""
echo "🔍 Checking if ECS service exists..."

SERVICE_EXISTS=$(aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --region "$AWS_REGION" \
  --query 'services[?status==`ACTIVE`] | length(@)' \
  --output text)

if [[ "$SERVICE_EXISTS" == "0" ]]; then
  echo "⚠️  ECS service does not exist. This is the FIRST DEPLOY."
  echo ""

  # ===========================================================================
  # PRIMER DEPLOY: Crear Task Definition y ECS Service
  # ===========================================================================

  ###########################################################################
  # CONFIGURACIÓN DE RED REQUERIDA
  #
  # ⚠️  IMPORTANTE: Antes de ejecutar el primer deploy, debes configurar:
  #
  # 1. SUBNET_IDS: Lista de subnet IDs (al menos 2 en diferentes AZs)
  #    Ejemplo: subnet-xxxxx,subnet-yyyyy
  #
  #    Para obtenerlas desde argo-profiles-service:
  #    aws ecs describe-services \
  #      --cluster argo-cluster \
  #      --services argo-profiles-service \
  #      --region us-east-2 \
  #      --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets' \
  #      --output text
  #
  # 2. SECURITY_GROUP_IDS: Lista de security group IDs
  #    Ejemplo: sg-xxxxx
  #
  #    Para obtenerlas desde argo-profiles-service:
  #    aws ecs describe-services \
  #      --cluster argo-cluster \
  #      --services argo-profiles-service \
  #      --region us-east-2 \
  #      --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups' \
  #      --output text
  #
  ###########################################################################

  # CONFIGURAR ESTAS VARIABLES ANTES DE EJECUTAR:
  SUBNET_IDS="${SUBNET_IDS:-}"
  SECURITY_GROUP_IDS="${SECURITY_GROUP_IDS:-}"

  if [[ -z "$SUBNET_IDS" ]] || [[ -z "$SECURITY_GROUP_IDS" ]]; then
    echo "❌ ERROR: SUBNET_IDS and SECURITY_GROUP_IDS must be configured"
    echo ""
    echo "Please set these environment variables before running this script:"
    echo ""
    echo "export SUBNET_IDS=\"subnet-xxxxx,subnet-yyyyy\""
    echo "export SECURITY_GROUP_IDS=\"sg-xxxxx\""
    echo ""
    echo "You can get these values from an existing service like argo-profiles-service:"
    echo ""
    echo "# Get subnets:"
    echo "aws ecs describe-services \\"
    echo "  --cluster argo-cluster \\"
    echo "  --services argo-profiles-service \\"
    echo "  --region us-east-2 \\"
    echo "  --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets' \\"
    echo "  --output text"
    echo ""
    echo "# Get security groups:"
    echo "aws ecs describe-services \\"
    echo "  --cluster argo-cluster \\"
    echo "  --services argo-profiles-service \\"
    echo "  --region us-east-2 \\"
    echo "  --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups' \\"
    echo "  --output text"
    echo ""
    exit 1
  fi

  # Obtener execution role y task role desde argo-profiles-service
  echo "📋 Getting IAM roles from argo-profiles-service..."

  PROFILES_TASK_DEF_ARN=$(aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "argo-profiles-service" \
    --region "$AWS_REGION" \
    --query 'services[0].taskDefinition' \
    --output text)

  EXECUTION_ROLE_ARN=$(aws ecs describe-task-definition \
    --task-definition "$PROFILES_TASK_DEF_ARN" \
    --region "$AWS_REGION" \
    --query 'taskDefinition.executionRoleArn' \
    --output text)

  TASK_ROLE_ARN=$(aws ecs describe-task-definition \
    --task-definition "$PROFILES_TASK_DEF_ARN" \
    --region "$AWS_REGION" \
    --query 'taskDefinition.taskRoleArn' \
    --output text)

  echo "   Execution Role: $EXECUTION_ROLE_ARN"
  echo "   Task Role: $TASK_ROLE_ARN"

  # Leer variables de entorno desde .env (solo para URLs no sensibles)
  echo ""
  echo "📋 Reading environment variables from .env file..."

  if [[ ! -f ".env" ]]; then
    echo "❌ ERROR: .env file not found"
    exit 1
  fi

  # Cargar variables del .env
  source .env

  # Crear task definition inicial
  echo ""
  echo "📝 Creating initial task definition with AWS Secrets Manager..."

  cat > task-def-initial.json <<EOF
{
  "family": "argo-trips",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$EXECUTION_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "argo-trips",
      "image": "$ECR_URI:$IMAGE_TAG",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "SERVICE_ID",
          "value": "argo-trips"
        },
        {
          "name": "PORT",
          "value": "3000"
        },
        {
          "name": "PRICING_SERVICE_URL",
          "value": "$PRICING_SERVICE_URL"
        },
        {
          "name": "GEO_SERVICE_URL",
          "value": "$GEO_SERVICE_URL"
        },
        {
          "name": "PAYMENTS_URL",
          "value": "${PAYMENTS_URL:-}"
        },
        {
          "name": "DRIVER_SESSIONS_SERVICE_URL",
          "value": "${DRIVER_SESSIONS_SERVICE_URL:-}"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-2:228864602830:secret:/argo/trips/database-url"
        },
        {
          "name": "REDIS_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-2:228864602830:secret:/argo/trips/redis-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/argo-trips",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node -e \"require('net').connect(3000, 'localhost').on('connect', () => process.exit(0)).on('error', () => process.exit(1))\""],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 40
      }
    }
  ]
}
EOF

  echo "✅ Task definition configured with AWS Secrets Manager for sensitive credentials"

  # Crear log group si no existe
  echo ""
  echo "📋 Creating CloudWatch log group..."
  aws logs create-log-group \
    --log-group-name "/ecs/argo-trips" \
    --region "$AWS_REGION" 2>/dev/null || echo "   Log group already exists"

  # Registrar task definition
  echo ""
  echo "📝 Registering task definition..."
  REGISTER_OUTPUT=$(aws ecs register-task-definition \
    --cli-input-json file://task-def-initial.json \
    --region "$AWS_REGION")

  TASK_DEF_ARN=$(echo "$REGISTER_OUTPUT" | jq -r '.taskDefinition.taskDefinitionArn')
  echo "✅ Task definition registered: $TASK_DEF_ARN"

  # Convertir subnet y security group IDs a formato JSON array
  SUBNET_ARRAY=$(echo "$SUBNET_IDS" | tr ',' '\n' | jq -R . | jq -s .)
  SG_ARRAY=$(echo "$SECURITY_GROUP_IDS" | tr ',' '\n' | jq -R . | jq -s .)

  # Crear ECS service
  echo ""
  echo "🚀 Creating ECS service..."
  aws ecs create-service \
    --cluster "$ECS_CLUSTER" \
    --service-name "$ECS_SERVICE" \
    --task-definition "$TASK_DEF_ARN" \
    --desired-count 1 \
    --launch-type FARGATE \
    --platform-version LATEST \
    --network-configuration "awsvpcConfiguration={subnets=$SUBNET_ARRAY,securityGroups=$SG_ARRAY,assignPublicIp=ENABLED}" \
    --region "$AWS_REGION" \
    --output json | jq '{
      serviceName: .service.serviceName,
      status: .service.status,
      desiredCount: .service.desiredCount,
      taskDefinition: .service.taskDefinition
    }'

  echo "✅ ECS service created successfully"

  # Limpiar archivo temporal
  rm -f task-def-initial.json

else
  echo "✅ ECS service exists. Proceeding with update."

  # ===========================================================================
  # DEPLOY POSTERIOR: Actualizar servicio existente
  # ===========================================================================

  # Obtener la taskDefinition actual
  echo ""
  echo "📄 Getting current task definition..."

  CURRENT_TASK_ARN=$(aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION" \
    --query 'services[0].taskDefinition' \
    --output text)

  echo "   Current task definition ARN: $CURRENT_TASK_ARN"

  aws ecs describe-task-definition \
    --task-definition "$CURRENT_TASK_ARN" \
    --region "$AWS_REGION" \
    --query 'taskDefinition' \
    --output json > task-def-current.json

  echo "✅ Task definition exported to task-def-current.json"

  # Limpiar JSON y reemplazar solo el campo image
  echo ""
  echo "📝 Creating new task definition..."

  # Extraer solo los campos necesarios para register-task-definition
  cat task-def-current.json | jq '{
    family,
    networkMode,
    taskRoleArn,
    executionRoleArn,
    containerDefinitions,
    requiresCompatibilities,
    cpu,
    memory,
    volumes,
    placementConstraints
  }' > task-def-base.json

  # Reemplazar la imagen
  jq --arg IMAGE "$ECR_URI:$IMAGE_TAG" '
    .containerDefinitions[0].image = $IMAGE
  ' task-def-base.json > task-def-new.json

  echo "✅ New task definition created with image: $ECR_URI:$IMAGE_TAG"

  # Registrar nueva taskDefinition revision
  echo ""
  echo "📝 Registering new task definition..."

  REGISTER_OUTPUT=$(aws ecs register-task-definition \
    --cli-input-json file://task-def-new.json \
    --region "$AWS_REGION")

  NEW_TASK_DEF_ARN=$(echo "$REGISTER_OUTPUT" | jq -r '.taskDefinition.taskDefinitionArn')
  NEW_REVISION=$(echo "$REGISTER_OUTPUT" | jq -r '.taskDefinition.revision')

  echo "✅ New task definition registered:"
  echo "   ARN: $NEW_TASK_DEF_ARN"
  echo "   Revision: $NEW_REVISION"

  # Actualizar el servicio ECS
  echo ""
  echo "🔄 Updating ECS service..."

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

  echo "✅ ECS service updated"

  # Limpiar archivos temporales
  rm -f task-def-current.json task-def-base.json task-def-new.json
fi

# =============================================================================
# 6. Esperar estabilidad del servicio
# =============================================================================
echo ""
echo "⏳ Waiting for service to stabilize (this may take a few minutes)..."

aws ecs wait services-stable \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --region "$AWS_REGION"

echo "✅ Service is stable!"

# =============================================================================
# 7. Verificación final
# =============================================================================
echo ""
echo "🔍 Final verification..."

aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --region "$AWS_REGION" \
  --output json | jq '{
    serviceName: .services[0].serviceName,
    status: .services[0].status,
    desiredCount: .services[0].desiredCount,
    runningCount: .services[0].runningCount,
    pendingCount: .services[0].pendingCount,
    taskDefinition: .services[0].taskDefinition,
    deployments: [.services[0].deployments[] | {
      status: .status,
      desiredCount: .desiredCount,
      runningCount: .runningCount,
      taskDefinition: .taskDefinition
    }]
  }'

echo ""
echo "=============================================="
echo "✅ Deployment completed successfully!"
echo "=============================================="
echo ""
echo "📊 Summary:"
echo "   Image:    $ECR_URI:$IMAGE_TAG"
echo "   Service:  $ECS_SERVICE"
echo "   Cluster:  $ECS_CLUSTER"
echo "   Region:   $AWS_REGION"
echo ""
