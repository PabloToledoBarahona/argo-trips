#!/bin/bash
set -euo pipefail

###############################################################################
# setup-alb-trips.sh
# Crea y configura Application Load Balancer para MS04-TRIPS
#
# Este script:
# 1. Crea un ALB público para el servicio TRIPS
# 2. Crea un Target Group para el servicio ECS
# 3. Configura un Listener en puerto 80
# 4. Actualiza el servicio ECS para registrarse en el ALB
#
# PREREQUISITOS:
# - El servicio ECS argo-trips-service debe estar desplegado
# - Variables SUBNET_IDS y SECURITY_GROUP_IDS configuradas
#
# Uso: ./setup-alb-trips.sh
###############################################################################

echo "=============================================="
echo "🔧 Setting up ALB for argo-trips"
echo "=============================================="

# =============================================================================
# 1. Variables de entorno
# =============================================================================
export AWS_REGION="us-east-2"
export AWS_ACCOUNT_ID="228864602830"
export ECS_CLUSTER="argo-cluster"
export ECS_SERVICE="argo-trips-service"
export ALB_NAME="alb-argo-trips"
export TARGET_GROUP_NAME="tg-argo-trips"
export VPC_ID=""  # Se detectará automáticamente

echo ""
echo "📋 Configuration:"
echo "   AWS_REGION:    $AWS_REGION"
echo "   ECS_CLUSTER:   $ECS_CLUSTER"
echo "   ECS_SERVICE:   $ECS_SERVICE"
echo "   ALB_NAME:      $ALB_NAME"
echo ""

# =============================================================================
# 2. Obtener configuración de red desde otro servicio (argo-profiles)
# =============================================================================
echo "🔍 Getting network configuration from argo-profiles-service..."

SUBNET_IDS=$(aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services argo-profiles-service \
  --region "$AWS_REGION" \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets' \
  --output text | tr '\t' ',')

SECURITY_GROUP_IDS=$(aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services argo-profiles-service \
  --region "$AWS_REGION" \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups' \
  --output text)

# Convertir subnets a array para ALB
SUBNET_ARRAY=(${SUBNET_IDS//,/ })

echo "   Subnets: $SUBNET_IDS"
echo "   Security Group: $SECURITY_GROUP_IDS"

# Obtener VPC ID desde la primera subnet
VPC_ID=$(aws ec2 describe-subnets \
  --subnet-ids "${SUBNET_ARRAY[0]}" \
  --region "$AWS_REGION" \
  --query 'Subnets[0].VpcId' \
  --output text)

echo "   VPC ID: $VPC_ID"

# =============================================================================
# 3. Crear Application Load Balancer
# =============================================================================
echo ""
echo "🏗️  Creating Application Load Balancer..."

# Verificar si ya existe
EXISTING_ALB=$(aws elbv2 describe-load-balancers \
  --region "$AWS_REGION" \
  --query "LoadBalancers[?LoadBalancerName=='$ALB_NAME'].LoadBalancerArn" \
  --output text || echo "")

if [[ -n "$EXISTING_ALB" ]]; then
  echo "⚠️  ALB already exists: $ALB_NAME"
  ALB_ARN="$EXISTING_ALB"
else
  ALB_ARN=$(aws elbv2 create-load-balancer \
    --name "$ALB_NAME" \
    --subnets "${SUBNET_ARRAY[@]}" \
    --security-groups "$SECURITY_GROUP_IDS" \
    --scheme internet-facing \
    --type application \
    --ip-address-type ipv4 \
    --region "$AWS_REGION" \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)

  echo "✅ ALB created: $ALB_ARN"
fi

# Obtener DNS del ALB
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns "$ALB_ARN" \
  --region "$AWS_REGION" \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "   ALB DNS: $ALB_DNS"

# =============================================================================
# 4. Crear Target Group
# =============================================================================
echo ""
echo "🎯 Creating Target Group..."

# Verificar si ya existe
EXISTING_TG=$(aws elbv2 describe-target-groups \
  --region "$AWS_REGION" \
  --query "TargetGroups[?TargetGroupName=='$TARGET_GROUP_NAME'].TargetGroupArn" \
  --output text || echo "")

if [[ -n "$EXISTING_TG" ]]; then
  echo "⚠️  Target Group already exists: $TARGET_GROUP_NAME"
  TG_ARN="$EXISTING_TG"
else
  TG_ARN=$(aws elbv2 create-target-group \
    --name "$TARGET_GROUP_NAME" \
    --protocol HTTP \
    --port 3000 \
    --vpc-id "$VPC_ID" \
    --target-type ip \
    --health-check-enabled \
    --health-check-protocol HTTP \
    --health-check-path "/healthz" \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --matcher HttpCode=200 \
    --region "$AWS_REGION" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

  echo "✅ Target Group created: $TG_ARN"
fi

# =============================================================================
# 5. Crear Listener (puerto 80)
# =============================================================================
echo ""
echo "👂 Creating Listener on port 80..."

# Verificar si ya existe
EXISTING_LISTENER=$(aws elbv2 describe-listeners \
  --load-balancer-arn "$ALB_ARN" \
  --region "$AWS_REGION" \
  --query 'Listeners[?Port==`80`].ListenerArn' \
  --output text || echo "")

if [[ -n "$EXISTING_LISTENER" ]]; then
  echo "⚠️  Listener already exists on port 80"
  LISTENER_ARN="$EXISTING_LISTENER"
else
  LISTENER_ARN=$(aws elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn="$TG_ARN" \
    --region "$AWS_REGION" \
    --query 'Listeners[0].ListenerArn' \
    --output text)

  echo "✅ Listener created: $LISTENER_ARN"
fi

# =============================================================================
# 6. Actualizar servicio ECS para usar el ALB
# =============================================================================
echo ""
echo "🔄 Updating ECS service to use ALB..."

# Obtener la task definition actual
TASK_DEF_ARN=$(aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --region "$AWS_REGION" \
  --query 'services[0].taskDefinition' \
  --output text)

echo "   Current task definition: $TASK_DEF_ARN"

# Actualizar el servicio para incluir el load balancer
aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=argo-trips,containerPort=3000" \
  --health-check-grace-period-seconds 60 \
  --region "$AWS_REGION" \
  --output json > /dev/null

echo "✅ ECS service updated with load balancer"

# =============================================================================
# 7. Esperar a que el servicio esté estable
# =============================================================================
echo ""
echo "⏳ Waiting for service to stabilize..."

aws ecs wait services-stable \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --region "$AWS_REGION"

echo "✅ Service is stable!"

# =============================================================================
# 8. Verificar health checks
# =============================================================================
echo ""
echo "🔍 Checking target health..."

sleep 10  # Esperar a que se registren los targets

aws elbv2 describe-target-health \
  --target-group-arn "$TG_ARN" \
  --region "$AWS_REGION" \
  --output table

# =============================================================================
# 9. Resumen
# =============================================================================
echo ""
echo "=============================================="
echo "✅ ALB Setup Complete!"
echo "=============================================="
echo ""
echo "📊 Summary:"
echo "   ALB Name:           $ALB_NAME"
echo "   ALB DNS:            $ALB_DNS"
echo "   Target Group:       $TARGET_GROUP_NAME"
echo "   Health Check Path:  /healthz"
echo ""
echo "🧪 Test the service:"
echo "   curl http://$ALB_DNS/healthz"
echo ""
echo "📝 Next steps:"
echo "   1. Update envoy-gateway-with-trips.yaml"
echo "   2. Replace 'alb-argo-trips.us-east-2.elb.amazonaws.com'"
echo "   3. With: '$ALB_DNS'"
echo "   4. Apply the gateway configuration"
echo ""
