# Diagrama de contexto da fundação

```mermaid
flowchart LR
  browser[Browser] --> web[Next.js Web]
  web --> api[NestJS REST API]
  api --> postgres[(PostgreSQL)]
  api --> minio[(MinIO / S3 API)]
  api --> mailpit[Mailpit SMTP]
```
