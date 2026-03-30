#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# ── Load and validate .env ────────────────────────────────────────────────────

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "Copy .env.example to .env and fill in your values:"
  echo "  cp $SCRIPT_DIR/.env.example $ENV_FILE"
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

# ── Export AWS credentials (isolate from any local profiles) ──────────────────

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_REGION
export AWS_SHARED_CREDENTIALS_FILE=/dev/null
export AWS_CONFIG_FILE=/dev/null
export AWS_SDK_LOAD_CONFIG=0
unset AWS_PROFILE AWS_SESSION_TOKEN AWS_SECURITY_TOKEN

# ── Verify credentials match the expected account ────────────────────────────

ACTUAL_ACCOUNT="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
if [ -z "$ACTUAL_ACCOUNT" ] || [ "$ACTUAL_ACCOUNT" = "None" ]; then
  echo "ERROR: Unable to validate AWS credentials from $ENV_FILE."
  echo "Run: aws sts get-caller-identity"
  exit 1
fi

if [ "$ACTUAL_ACCOUNT" != "$AWS_ACCOUNT_ID" ]; then
  echo "ERROR: WRONG AWS ACCOUNT! Expected $AWS_ACCOUNT_ID but got $ACTUAL_ACCOUNT"
  echo "Update $ENV_FILE with keys from account $AWS_ACCOUNT_ID."
  exit 1
fi

# ── Export Terraform variables ────────────────────────────────────────────────

export TF_VAR_aws_account_id="$AWS_ACCOUNT_ID"
export TF_VAR_aws_region="$AWS_REGION"
export TF_VAR_domain_name="$DOMAIN_NAME"

# ── Compute backend config ────────────────────────────────────────────────────

DOMAIN_DASHED="${DOMAIN_NAME//./-}"
STATE_BUCKET="${DOMAIN_DASHED}-tf-state-${AWS_ACCOUNT_ID}"
STATE_KEY="site/terraform.tfstate"

BACKEND_ARGS=(
  -backend-config="bucket=${STATE_BUCKET}"
  -backend-config="key=${STATE_KEY}"
  -backend-config="region=${AWS_REGION}"
)

# ── Handle terraform init: auto-create state bucket if needed ─────────────────

if [ "${1:-}" = "init" ]; then
  if ! aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
    echo "Creating Terraform state bucket: $STATE_BUCKET"
    if [ "$AWS_REGION" = "us-east-1" ]; then
      aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$AWS_REGION"
    else
      aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$AWS_REGION" \
        --create-bucket-configuration LocationConstraint="$AWS_REGION"
    fi
    aws s3api put-bucket-versioning --bucket "$STATE_BUCKET" \
      --versioning-configuration Status=Enabled
    echo "State bucket created with versioning enabled."
  fi

  shift
  exec terraform init "${BACKEND_ARGS[@]}" "$@"
fi

exec terraform "$@"
