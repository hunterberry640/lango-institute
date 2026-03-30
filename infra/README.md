# Infrastructure — AWS Deployment

Terraform configuration to deploy a static site to AWS. All account-specific
details live in a single file (`infra/.env`).

## Architecture

```
User → Route 53 (DNS) → CloudFront (CDN + HTTPS) → S3 (Static Files)
```

**Resources created:**

- **S3 bucket** — Stores HTML, CSS, JS, and image files
- **CloudFront distribution** — Global CDN with HTTPS, caching, and gzip compression
- **ACM certificate** — Free SSL/TLS certificate for the domain (auto-renewed)
- **Route 53 records** — A/AAAA records for apex and `www`
- **CloudFront function** — Rewrites `/en/` to `/en/index.html` for clean URLs

## Prerequisites

1. [Terraform](https://developer.hashicorp.com/terraform/install) installed (>= 1.5)
2. [AWS CLI](https://aws.amazon.com/cli/) installed
3. An AWS account with an IAM user that has permissions for S3, CloudFront, Route 53, and ACM

## Configuration — Single File Setup

Copy the example config and fill in your values:

```bash
cp infra/.env.example infra/.env
```

Edit `infra/.env` with your account details:

```
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
DOMAIN_NAME=example.com
```

That's it — every other script and the CI workflow reads from this one file.

## First-Time Setup

```bash
cd infra

# Load credentials and lock terraform to your account
source .envrc

# Initialize Terraform (auto-creates the state bucket if needed)
terraform init

# Preview what will be created
terraform plan

# Create all resources (takes ~5-15 min for ACM cert + CloudFront)
terraform apply
```

Type `yes` when prompted. If you open a new terminal, run `source .envrc` again.

### S3 bucket naming

By default, Terraform auto-generates a unique bucket name:

- Site files: `<domain-dashed>-site-<account_id>`
- Terraform state: `<domain-dashed>-tf-state-<account_id>`

You can override the site bucket name by setting `TF_VAR_site_bucket_name`.

## Deploy Site Files

After Terraform has created the infrastructure, deploy the site:

```bash
# From the project root
chmod +x deploy.sh
./deploy.sh
```

This syncs all site files to S3 and invalidates the CloudFront cache.

## CI/CD (GitHub Actions)

The workflow at `.github/workflows/deploy.yml` deploys automatically on push
to `main`. Set these GitHub Secrets on your repository:

| Secret | Description |
|--------|-------------|
| `AWS_ACCOUNT_ID` | 12-digit AWS account ID |
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `DOMAIN_NAME` | Root domain (e.g. `example.com`) |

Optional: `AWS_REGION` (defaults to `us-east-1`).

## Updating the Site

After making changes to HTML/CSS/JS, just re-run:

```bash
./deploy.sh
```

Changes propagate in ~1-5 minutes (CloudFront cache invalidation).

## Deploying to a New Account

1. Clone the repo
2. `cp infra/.env.example infra/.env`
3. Fill in the 5 values (account ID, region, credentials, domain)
4. `source infra/.envrc`
5. `terraform init` (auto-creates state bucket + configures backend)
6. `terraform apply`
7. `bash deploy.sh` (syncs site files)

For CI: set the 4 GitHub Secrets listed above and push to `main`.

## Tear Down

To destroy all AWS resources:

```bash
cd infra
terraform destroy
```

Note: the Terraform state bucket is not managed by Terraform and must be
deleted manually if you want to fully clean up.

## Costs

For a low-traffic static site, expect **~$0.50-2.00/month**:

- S3: ~$0.01/month (a few MB of storage)
- CloudFront: Free tier covers 1TB/month data transfer + 10M requests
- Route 53: $0.50/month per hosted zone
- ACM certificate: Free
