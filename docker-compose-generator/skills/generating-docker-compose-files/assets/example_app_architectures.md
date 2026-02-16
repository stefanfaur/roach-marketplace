# Example Application Architectures with Docker/Podman Compose

Common application architectures and their corresponding compose configurations. All examples use Compose Specification format (no `version:` key) and include notes for Podman compatibility.

## Table of Contents

1. [Simple Web Application (Frontend + Backend + Database)](#1-simple-web-application)
2. [Message Queue Application (Producer + Message Broker + Consumer)](#2-message-queue-application)
3. [Microservices Architecture (API Gateway + Multiple Microservices)](#3-microservices-architecture)

## 1. Simple Web Application

Frontend, backend API, and database.

```yaml
services:
  frontend:
    image: <YOUR_FRONTEND_IMAGE>
    ports:
      - "8080:80"  # Podman rootless: use 8080 instead of 80
    depends_on:
      - backend
    restart: always
    networks:
      - app-network

  backend:
    image: <YOUR_BACKEND_IMAGE>
    environment:
      DATABASE_URL: postgres://<DB_USER>:<DB_PASSWORD>@db:5432/<DB_NAME>
    depends_on:
      - db
    restart: always
    networks:
      - app-network

  db:
    image: postgres:14
    environment:
      POSTGRES_USER: <DB_USER>
      POSTGRES_PASSWORD: <DB_PASSWORD>
      POSTGRES_DB: <DB_NAME>
    volumes:
      - db_data:/var/lib/postgresql/data
    restart: always
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U <DB_USER> -d <DB_NAME>"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  db_data:

networks:
  app-network:
    driver: bridge
```

## 2. Message Queue Application

Producer, RabbitMQ broker, and consumer.

```yaml
services:
  rabbitmq:
    image: rabbitmq:3.9-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: <RABBITMQ_USER>
      RABBITMQ_DEFAULT_PASS: <RABBITMQ_PASSWORD>
    restart: always
    networks:
      - app-network

  producer:
    image: <YOUR_PRODUCER_IMAGE>
    depends_on:
      - rabbitmq
    environment:
      RABBITMQ_HOST: rabbitmq
      RABBITMQ_USER: <RABBITMQ_USER>
      RABBITMQ_PASSWORD: <RABBITMQ_PASSWORD>
    restart: always
    networks:
      - app-network

  consumer:
    image: <YOUR_CONSUMER_IMAGE>
    depends_on:
      - rabbitmq
    environment:
      RABBITMQ_HOST: rabbitmq
      RABBITMQ_USER: <RABBITMQ_USER>
      RABBITMQ_PASSWORD: <RABBITMQ_PASSWORD>
    restart: always
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

## 3. Microservices Architecture

API gateway with multiple microservices.

```yaml
services:
  api-gateway:
    image: <YOUR_API_GATEWAY_IMAGE>
    ports:
      - "8080:8080"
    depends_on:
      - microservice1
      - microservice2
    restart: always
    networks:
      - app-network

  microservice1:
    image: <YOUR_MICROSERVICE1_IMAGE>
    restart: always
    networks:
      - app-network
    environment:
      PORT: 3001

  microservice2:
    image: <YOUR_MICROSERVICE2_IMAGE>
    restart: always
    networks:
      - app-network
    environment:
      PORT: 3002

networks:
  app-network:
    driver: bridge
```

## Podman Notes for All Examples

- Replace ports < 1024 with high ports for rootless mode
- Add `:z` to bind mount volumes on SELinux systems
- All examples use custom bridge networks for DNS resolution
- For production with Podman: generate systemd units with `podman generate systemd`
