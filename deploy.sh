#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/infra"
ENV_FILE="$INFRA_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "Copy .env.example to .env and fill in your values:"
  echo "  cp $INFRA_DIR/.env.example $ENV_FILE"
  exit 1
fi

source <(tr -d '\r' < "$ENV_FILE")

REQUIRED_VARS=(AWS_ACCOUNT_ID AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY DOMAIN_NAME)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set in $ENV_FILE"
    exit 1
  fi
done

AWS_REGION="${AWS_REGION:-us-east-1}"

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_REGION
export AWS_SHARED_CREDENTIALS_FILE=/dev/null
export AWS_CONFIG_FILE=/dev/null
export AWS_SDK_LOAD_CONFIG=0
unset AWS_PROFILE AWS_SESSION_TOKEN AWS_SECURITY_TOKEN

ACTUAL_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
if [ "$ACTUAL_ACCOUNT" != "$AWS_ACCOUNT_ID" ]; then
  echo "ERROR: WRONG AWS ACCOUNT! Expected $AWS_ACCOUNT_ID but got $ACTUAL_ACCOUNT"
  echo "The credentials in $ENV_FILE belong to account $ACTUAL_ACCOUNT, not $AWS_ACCOUNT_ID."
  exit 1
fi
echo "Confirmed: deploying to account $ACTUAL_ACCOUNT"

BUCKET=$(cd "$INFRA_DIR" && terraform output -raw s3_bucket_name)
DISTRIBUTION_ID=$(cd "$INFRA_DIR" && terraform output -raw cloudfront_distribution_id)

echo "Deploying to S3 bucket: $BUCKET"

aws s3 sync "$SCRIPT_DIR" "s3://$BUCKET" \
  --delete \
  --exclude ".git/*" \
  --exclude ".github/*" \
  --exclude ".cursor/*" \
  --exclude "node_modules/*" \
  --exclude "infra/*" \
  --exclude "deploy.sh" \
  --exclude ".gitignore" \
  --exclude "*.md" \
  --exclude "package.json" \
  --exclude "package-lock.json" \
  --exclude "vite.config.js" \
  --exclude ".nojekyll" \
  --exclude "CNAME" \
  --cache-control "public, max-age=86400"

aws s3 cp "s3://$BUCKET" "s3://$BUCKET" \
  --recursive \
  --exclude "*" \
  --include "*.html" \
  --metadata-directive REPLACE \
  --cache-control "public, max-age=300" \
  --content-type "text/html"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --no-cli-pager

echo "Deploy complete! Site is live at https://${DOMAIN_NAME}"
