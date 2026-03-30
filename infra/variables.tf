variable "aws_account_id" {
  description = "AWS account ID to deploy into (12-digit number)"
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must be a 12-digit AWS account ID."
  }
}

variable "aws_region" {
  description = "AWS region for S3 bucket and other resources (CloudFront is global)"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Root domain name (e.g. ramirezcleaningservices.com)"
  type        = string
}

variable "site_bucket_name" {
  description = "Optional S3 bucket name override for site assets. Leave null to auto-generate a unique name."
  type        = string
  default     = null
}
