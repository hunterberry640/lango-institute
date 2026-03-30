---
name: new-client-setup
description: Set up a new cleaning-service client site from this template repo. Use when the user says they want to set up a new client, start a new project, onboard a client, or configure a new site. Covers collecting business info, populating all site files, GitHub repo creation, and AWS deployment.
---

# New Client Setup

This repo is a bilingual (EN/ES) static cleaning-service site template. After cloning and wiping site-specific content, follow these three phases to stand up a new client.

## Phase 1: Collect client info and populate the site

### Step 1 — Gather required information

Ask the user for the following. Use the AskQuestion tool for structured choices where noted; use conversational prompts for free-text fields. Do NOT proceed to file edits until all required fields are collected.

**Required:**

| Field | Example | Notes |
|-------|---------|-------|
| Business full name | "Ramirez Cleaning and Detailing Service" | Used in JSON-LD, footer, title tags, copyright |
| Business short name | "Ramirez Cleaning" | Used in navbar logo text |
| Domain name | `ramirezcleaningservices.com` | No protocol prefix |
| Phone (English line) | (214) 554-2902 | |
| Email | `info@example.com` | |
| Street address | 615 Elsbeth St | |
| City, State, ZIP | Dallas, TX 75208 | |
| Latitude / Longitude | 32.7479, -96.8280 | Look up via Google Maps if user doesn't know |
| Service areas | Dallas, Plano, Frisco, Irving... | List of cities/neighborhoods |
| Operating hours | Mon-Fri 9am-5pm, Sat 9am-4pm | Weekday + weekend hours |
| Web3Forms access key | `09b92f36-...` | User creates at https://web3forms.com |

**Optional (ask, skip if not available yet):**

| Field | Notes |
|-------|-------|
| Phone (Spanish line) | Second phone if bilingual support |
| Social media links | Facebook, Instagram, etc. |
| Customer reviews | Name, quote, city for each (2-5 reviews) |
| Tagline / subheadline | Hero section subtext |
| Services list + pricing | Basic cleaning, deep clean, etc. with prices |
| Images | Logo PNG, favicon ICO, hero background, gallery photos, before/after pairs |

### Step 2 — Populate files

Update each file below using the collected info. For every file, use find-and-replace with the StrReplace tool. Work through them in this order:

#### 2a. `package.json`
- Replace the `"name"` value with a kebab-case version of the client name (e.g. `"acme-cleaning-services"`).

#### 2b. `infra/.env`
- Copy `infra/.env.example` to `infra/.env` if it doesn't exist.
- Set `AWS_ACCOUNT_ID` to the client's 12-digit AWS account ID.
- Set `AWS_REGION` if different from `us-east-1`.
- Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for the IAM user.
- Set `DOMAIN_NAME` to the client's domain.

#### 2c. `robots.txt`
- Replace the domain in the Sitemap URL.

#### 2d. `sitemap.xml`
- Replace all `https://www.OLD_DOMAIN` with `https://www.NEW_DOMAIN`.
- Update `<lastmod>` to today's date.

#### 2e. `index.html` (root redirect)
- Update the `<link rel="canonical">` URL.
- Update the `<title>` text.

#### 2f. `en/index.html` (English page)
This is the biggest file. Update these sections:
- `<title>` tag — business name, services, city
- `<meta name="description">` — business name, services, city list
- `<link rel="canonical">` and all `hreflang` URLs — new domain
- All `og:` meta tags — title, description, url, image URL
- All `twitter:` meta tags — title, description, image URL
- `og:locale` — keep `en_US` / `es_MX`
- **JSON-LD structured data** (`<script type="application/ld+json">`):
  - `name`, `description`, `url`, `telephone`, `image`
  - `address` object (street, city, state, zip)
  - `geo` object (lat, lng)
  - `areaServed` array (list of cities)
  - `hasOfferCatalog` (services)
  - `aggregateRating` (rating, count)
  - `review` array (customer reviews)
  - `sameAs` array (social media URLs)
  - `openingHoursSpecification` (hours)
- **Navbar** — logo `alt` text, short business name text
- **Hero section** — headline, subheadline
- **Trust bar** — rating, client count
- **Services section** — service names, descriptions, pricing
- **How It Works** — step descriptions
- **Reviews section** — customer quotes, names, locations
- **Service Areas** — city names and descriptions
- **Before/After sliders** — image `src` and `alt` attributes
- **Gallery carousel** — image `src` and `alt` attributes
- **Footer** — business name, address, phone, email, social links, hours, copyright
- **Quote form** — Web3Forms `access_key` hidden input, `from_name` hidden input
- **Image paths** — update `src` attributes for logo, favicon, hero, gallery, before/after

#### 2g. `es/index.html` (Spanish page)
Same updates as `en/index.html` but with Spanish translations for all user-facing text. Keep the same image paths, domain, coordinates, and structured data values. Translate:
- `<title>`, `<meta description>`, OG/Twitter descriptions
- JSON-LD `description` and `inLanguage` ("es")
- All visible text (navbar, hero, services, reviews, footer, form labels)

#### 2h. `README.md`
- Update project name in heading and description.
- Update any URLs (GitHub Pages, domain).

#### 2i. `infra/README.md`
- No domain-specific changes needed (README is now generic and reads from `.env`).

### Step 3 — Handle images

Ask the user if they have images ready. If yes:
1. Have them place files in `src/assets/` (logo, favicon, hero, gallery, before/after).
2. Update all `<img src="...">` and `<link rel="icon" href="...">` paths in both `en/index.html` and `es/index.html`.
3. Update image `alt` attributes with the client's business name and location for SEO.
4. Update `og:image` and `twitter:image` meta tags with the new hero image URL.
5. Update `"image"` in JSON-LD with the new logo URL.

If images aren't ready, leave placeholders and tell the user to update them later.

---

## Phase 2: GitHub repo setup

### Step 1 — Initialize git

```bash
git init
```

### Step 2 — Verify .gitignore

Confirm the root `.gitignore` includes at minimum:
```
node_modules
dist
dist-ssr
*.local
.DS_Store
```

Also confirm `infra/.gitignore` includes:
```
.terraform/
*.tfstate
*.tfstate.backup
.terraform.lock.hcl
.env
!.env.example
.envrc
```

### Step 3 — Initial commit

```bash
git add -A
git commit -m "Initial site setup for <CLIENT_NAME>"
```

### Step 4 — Create GitHub repo and push

Check if `gh` CLI is available:

```bash
gh --version
```

**If `gh` is installed:**

```bash
gh repo create <repo-name> --private --source=. --push
```

Ask the user for the repo name. Use a short kebab-case name like `acme-cleaning`.

**If `gh` is NOT installed**, give manual instructions:

1. Go to https://github.com/new
2. Create a private repo named `<repo-name>` (do NOT initialize with README)
3. Run:
```bash
git remote add origin https://github.com/<USERNAME>/<repo-name>.git
git branch -M main
git push -u origin main
```

### Step 5 — Set GitHub Secrets for CI

Set these secrets on the repo for automated deployments via GitHub Actions:

```bash
gh secret set AWS_ACCOUNT_ID --body "<ACCOUNT_ID>"
gh secret set AWS_ACCESS_KEY_ID --body "<ACCESS_KEY>"
gh secret set AWS_SECRET_ACCESS_KEY --body "<SECRET_KEY>"
gh secret set DOMAIN_NAME --body "<DOMAIN>"
```

If `gh` is not installed, set them manually at Settings > Secrets and variables > Actions.

### Step 6 — Optional GitHub Pages staging

If the user wants a quick preview before AWS is ready:

1. Go to repo Settings > Pages
2. Source: Deploy from branch `main`, folder `/ (root)`
3. Site will be at `https://<username>.github.io/<repo-name>/`

Note: The root `index.html` redirect handles subdirectory paths automatically.

---

## Phase 3: AWS deployment

### Step 1 — Verify prerequisites

Run these checks and report results to the user:

```bash
aws --version
terraform --version
```

If **AWS CLI** is missing: direct to https://aws.amazon.com/cli/
If **Terraform** is missing: direct to https://developer.hashicorp.com/terraform/install

### Step 2 — Configure `infra/.env`

All account-specific details live in a single file. If not already done in Phase 1 step 2b:

```bash
cp infra/.env.example infra/.env
```

Ask the user for:
- AWS account ID (12-digit number from the AWS console)
- IAM user access key and secret key
- AWS region (default: us-east-1)

Fill in `infra/.env` with these values plus the domain name collected in Phase 1.

Verify credentials work:
```bash
cd infra
source .envrc
```

This sources `.env`, exports credentials, and validates the account ID matches.

### Step 3 — Route 53 hosted zone

Check if the domain's hosted zone exists:

```bash
aws route53 list-hosted-zones-by-name --dns-name <DOMAIN> --max-items 1
```

If it does NOT exist, create it:

```bash
aws route53 create-hosted-zone --name <DOMAIN> --caller-reference $(date +%s)
```

Then instruct the user:
1. Copy the 4 NS records from the hosted zone
2. Go to their domain registrar (Namecheap, GoDaddy, etc.)
3. Set the nameservers to the Route 53 NS records
4. Wait for propagation (can take up to 48 hours, usually minutes)

### Step 4 — Terraform init and apply

The `terraform` command is wrapped by `.envrc` to read all config from `infra/.env`.
The init step auto-creates the S3 state bucket if it doesn't exist.

```bash
cd infra
terraform init
terraform plan
```

Review the plan with the user, then:

```bash
terraform apply
```

This creates: S3 bucket, CloudFront distribution, ACM certificate (with DNS validation), Route 53 A/AAAA records. Takes 5-15 minutes.

### Step 5 — Deploy site files

From the repo root:

```bash
chmod +x deploy.sh
bash deploy.sh
```

This syncs files to S3 and invalidates the CloudFront cache.

### Step 6 — Verify

Open these URLs and confirm the site loads with HTTPS:
- `https://<DOMAIN>`
- `https://www.<DOMAIN>`
- `https://<DOMAIN>/en/`
- `https://<DOMAIN>/es/`

Test the language switcher between EN and ES.

---

## Post-setup verification checklist

After all three phases, run through this:

1. **Grep for leftover references** — search the repo for the previous client's domain or business name to confirm nothing was missed:
   ```bash
   rg "OLD_DOMAIN_OR_NAME" --type html --type json
   ```

2. **Local dev check** — run `npm run dev` and spot-check the site in a browser.

3. **Language switcher** — click EN/ES links and confirm both pages load correctly.

4. **Structured data** — paste the live URL into https://search.google.com/test/rich-results and confirm no errors.

5. **Meta tags** — check page source for correct `<title>`, `<meta description>`, canonical, and OG tags.

6. **Forms** — submit a test quote request and confirm it arrives via Web3Forms.

7. **Mobile** — check the site on a phone or in Chrome DevTools mobile view.
