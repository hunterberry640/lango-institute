output "s3_bucket_name" {
  description = "Name of the S3 bucket hosting the site files"
  value       = aws_s3_bucket.site.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (needed for cache invalidation)"
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.site.domain_name
}

output "site_url" {
  description = "Live site URL"
  value       = "https://${var.domain_name}"
}

output "site_url_www" {
  description = "Live site URL (www)"
  value       = "https://www.${var.domain_name}"
}

output "nameservers" {
  description = "Set these NS records at your domain registrar"
  value       = aws_route53_zone.main.name_servers
}
