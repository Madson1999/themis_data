'use strict';

function bool(v, def = false) {
    const s = String(v ?? '').toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    return def;
}

const useSSL = bool(process.env.S3_USE_SSL, false);

let endpoint = (process.env.S3_ENDPOINT || '').trim();
if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
if (!endpoint) endpoint = useSSL ? 'https://minio:9000' : 'http://minio:9000';

module.exports = new (require('@aws-sdk/client-s3').S3Client)({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint,
    forcePathStyle: true,
    credentials: {
        accessKeyId: (process.env.S3_ACCESS_KEY || '').trim(),
        secretAccessKey: (process.env.S3_SECRET_KEY || '').trim(),
    },
});
