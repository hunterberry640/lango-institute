---
description: Auto-trigger the new-client-setup skill when the user wants to set up a new client site
globs:
  - "**/*"
---

# Template Repo — Cleaning Service Sites

This repository is a reusable template for bilingual (EN/ES) cleaning-service landing pages deployed to AWS.

When the user mentions any of the following:
- Setting up a new client
- Starting a new project from this template
- Onboarding a new client
- Configuring a new domain
- Deploying a new site

Read and follow the skill at `.cursor/skills/new-client-setup/SKILL.md`. It walks through three phases:

1. **Collect client info and populate the site** — business details, contact info, domain, images
2. **GitHub repo setup** — git init, create repo, push
3. **AWS deployment** — Route 53, Terraform, deploy.sh

Do not skip phases. Follow the skill instructions step by step.
