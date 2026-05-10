"""Storage helper: optional S3 upload/download for persistence.

Usage: call upload_file(local_path) to upload to S3 when enabled.
"""
import os
import logging
from config import Config

logger = logging.getLogger(__name__)


def upload_file(local_path: str) -> bool:
    cfg = Config()
    if not cfg.S3_ENABLED:
        logger.debug("S3 not enabled; skipping upload")
        return False

    try:
        import boto3
        s3 = boto3.client('s3')
        bucket = cfg.S3_BUCKET
        key = cfg.S3_KEY
        if not bucket:
            logger.error("S3_BUCKET not set; cannot upload")
            return False

        s3.upload_file(local_path, bucket, key)
        logger.info(f"Uploaded {local_path} to s3://{bucket}/{key}")
        return True

    except Exception as e:
        logger.error(f"Failed to upload to S3: {e}")
        return False


def download_file(local_path: str) -> bool:
    cfg = Config()
    if not cfg.S3_ENABLED:
        logger.debug("S3 not enabled; skipping download")
        return False

    try:
        import boto3
        s3 = boto3.client('s3')
        bucket = cfg.S3_BUCKET
        key = cfg.S3_KEY
        if not bucket:
            logger.error("S3_BUCKET not set; cannot download")
            return False

        s3.download_file(bucket, key, local_path)
        logger.info(f"Downloaded s3://{bucket}/{key} to {local_path}")
        return True

    except Exception as e:
        logger.error(f"Failed to download from S3: {e}")
        return False
