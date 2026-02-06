#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-2}"
DNS="${DNS:-argo-shared-alb-828452645.us-east-2.elb.amazonaws.com}"
CLUSTER="${CLUSTER:-argo-cluster}"

aws sts get-caller-identity --region "$AWS_REGION" >/dev/null || {
  echo "AWS CLI sin credenciales" >&2
  exit 1
}

LB_ARN="$(aws elbv2 describe-load-balancers --region "$AWS_REGION" \
  --query "LoadBalancers[?DNSName=='${DNS}'].LoadBalancerArn" --output text)"

echo "LB_ARN=$LB_ARN"
[[ -n "$LB_ARN" ]] || { echo "No se encontró ALB por DNS"; exit 1; }

echo "== Target Groups =="
aws elbv2 describe-target-groups --region "$AWS_REGION" --load-balancer-arn "$LB_ARN" \
  --query "TargetGroups[].{name:TargetGroupName,port:Port,proto:Protocol,health:HealthCheckPath,arn:TargetGroupArn}" \
  --output table

for TG in $(aws elbv2 describe-target-groups --region "$AWS_REGION" --load-balancer-arn "$LB_ARN" \
  --query "TargetGroups[].TargetGroupArn" --output text); do
  echo "== Target Health $TG =="
  aws elbv2 describe-target-health --region "$AWS_REGION" --target-group-arn "$TG" \
    --query "TargetHealthDescriptions[].{id:Target.Id,port:Target.Port,state:TargetHealth.State,reason:TargetHealth.Reason}" \
    --output table
done

echo "== ECS Services =="
SERVICES="$(aws ecs list-services --region "$AWS_REGION" --cluster "$CLUSTER" --query "serviceArns" --output text)"
aws ecs describe-services --region "$AWS_REGION" --cluster "$CLUSTER" --services $SERVICES \
  --query "services[].{name:serviceName,desired:desiredCount,running:runningCount,pending:pendingCount,status:status}" \
  --output table
