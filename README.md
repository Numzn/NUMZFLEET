# NUMZFLEET V2 — NumzLab-first development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full workflow.

## Quick start (NumzLab)

```bash
cd /srv/projects/numzfleet
./scripts/dev
./scripts/verify
```

## Branch and CI

Single branch: **`main`**. There is no `develop` branch and no staging environment.

Every push to `main` runs CI (lint/test) and, if it passes, automatically builds images, pushes to Docker
Hub, and deploys to OCI production — see [deployment/REGISTRY_DEPLOY.md](deployment/REGISTRY_DEPLOY.md).

## Repository layout

```text
/srv/projects/numzfleet
├── fuel-api/              # Backend API
├── traccar-fleet-system/  # Frontend (Vite)
├── erb-fuel-monitor/      # ERB price scraper
├── deployment/
│   ├── compose/
│   │   └── docker-compose.dev.yml

---

# NumzTrak Fleet Management System

A comprehensive fleet management and GPS tracking system built on Traccar, featuring real-time vehicle tracking, fuel management, and advanced fleet analytics.

## 🚀 Features

- **Real-time GPS Tracking**: Live vehicle location tracking with MapLibre GL JS
- **Fuel Management**: Complete fuel request and approval workflow
- **Dashboard Analytics**: KPI cards, charts, and fleet statistics
- **Geofencing**: Virtual boundaries with alerts
- **Driver Management**: Driver profiles and assignment
- **Maintenance Tracking**: Vehicle maintenance schedules and history
- **Reports**: Comprehensive reporting system (trips, stops, events, statistics)
- **Multi-language Support**: 60+ languages
- **PWA Support**: Progressive Web App with offline capabilities
- **Socket.io Integration**: Real-time updates via WebSocket

## 📋 Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Development](#development)
- [Docker Deployment](#docker-deployment)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

## 🏗️ Architecture

The system consists of three main components:

1. **Backend (Traccar)**: Java-based GPS tracking server
   - MySQL database for Traccar data
   - Handles GPS protocols and device communication
   - RESTful API for device management

2. **Fuel API**: Node.js microservice for fuel management
   - PostgreSQL database for fuel data
   - Express.js REST API
   - Socket.io for real-time notifications
   - Port: 3000

3. **Frontend**: React-based web application
   - React 19 with Material-UI (MUI)
   - Redux for state management
   - MapLibre GL JS for maps
   - Vite for build tooling
   - Dev server default port: **5174** (host **3002** is reserved for the Dockerized static frontend)

## 📦 Prerequisites

- **Node.js** 20.x or higher
- **Docker** and **Docker Compose** (for containerized deployment)
- **MySQL** 8.0+ (for Traccar backend)
- **PostgreSQL** 15+ (for Fuel API)
- **Java** 11+ (for Traccar backend)
- **Git**

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Numzn/NUMZFLEET.git
cd NUMZFLEET
```

### 2. Environment Setup

Copy the environment template and configure:

```bash
# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

### 3. Install Dependencies

```bash
# Root dependencies (if any)
npm install

# Frontend dependencies
cd traccar-fleet-system/frontend
npm install

# Fuel API dependencies
cd ../../fuel-api
npm install
```

## ⚙️ Configuration

### Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
# Database Passwords
MYSQL_ROOT_PASSWORD=your_secure_password
MYSQL_PASSWORD=your_secure_password
POSTGRES_PASSWORD=your_secure_password

# Traccar Configuration
TRACCAR_ADMIN_USER=admin
TRACCAR_ADMIN_PASSWORD=your_admin_password

# Application Secrets
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret

# Network Settings
HTTP_PORT=8082
HTTPS_PORT=8443
PORT=3000
CORS_ORIGIN=http://localhost:5174,http://localhost:3002
```

### Database Setup

The system uses two databases:

- **MySQL** (Traccar): Stores device data, positions, events
- **PostgreSQL** (Fuel Management): Stores fuel requests, stations, vehicle specs

Database initialization scripts are in `backend/scripts/init-database.sql`

## 🚀 Running the Application

### Option 1: Docker Compose (recommended)

**Full stack rebuild (Windows, canonical):** from repo root run `.\rebuild-stack.ps1` (see script header for flags). Core + ERB is the default.

```bash
# Start all services (core only)
docker compose -f docker-compose.yml up -d --build

# Core + ERB overlay
docker compose -f docker-compose.yml -f docker-compose.erb.yml up -d --build

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Option 2: Local Development

#### Start Backend (Traccar + fuel-api + DBs in Docker)
```bash
docker compose -f docker-compose.yml -f docker-compose.erb.yml up -d --build
```

#### Start Fuel API
```bash
cd fuel-api
npm run dev
```

#### Start Frontend
```bash
cd traccar-fleet-system/frontend
npm run dev
```

### Access Points

- **Frontend (Vite dev)**: http://localhost:5174
- **Frontend (Docker static, root compose)**: http://localhost:3002
- **Traccar API**: http://localhost:8082
- **Fuel API**: http://localhost:3000
- **MySQL**: localhost:3306
- **PostgreSQL**: localhost:5432

## 📁 Project Structure

```
NUMZFLEET/  (canonical monorepo: [Numzn/NUMZFLEET](https://github.com/Numzn/NUMZFLEET))
├── docker-compose.yml      # Core stack (authoritative)
├── docker-compose.erb.yml  # Optional ERB overlay
├── rebuild-stack.ps1       # Canonical Windows full-stack rebuild
├── backend/
│   ├── conf/               # Traccar XML and runtime config
│   ├── scripts/            # Database and utility scripts
│   └── .env.example        # Environment template (copy to backend/.env)
│
├── fuel-api/               # Fuel Management API (Node.js)
│   ├── src/
│   │   ├── config/         # Database and service configs
│   │   ├── controllers/   # API controllers
│   │   ├── models/         # Sequelize models
│   │   ├── routes/         # Express routes
│   │   └── services/       # Business logic
│   └── Dockerfile
│
├── traccar-fleet-system/
│   └── frontend/           # React frontend
│       ├── src/
│       │   ├── dashboard/  # Dashboard components
│       │   ├── fuelRequests/ # Fuel management UI
│       │   ├── map/        # Map components
│       │   ├── main/       # Main map view
│       │   ├── reports/    # Reporting pages
│       │   └── settings/   # Settings pages
│       └── public/        # Static assets
│
└── data/                   # Optional local paths (gitignored); compose may use named volumes instead
    └── …                  # See `docker-compose.yml` volume definitions
```

## 💻 Development

### Frontend Development

```bash
cd traccar-fleet-system/frontend

# Start development server
npm start

# Build for production
npm run build

# Lint code
npm run lint
npm run lint:fix
```

### Fuel API Development

```bash
cd fuel-api

# Start with nodemon (auto-reload)
npm run dev

# Start production (local)
npm start
```

### Code Style

- **Frontend**: ESLint with Airbnb config
- **Backend**: Follow Java conventions
- **API**: ESLint recommended

## 🐳 Docker Deployment

### Local / development (build on machine)

From repo root (full stack including databases and Traccar):

```bash
docker compose up -d --build
```

On Windows, the canonical rebuild/smoke flow is `.\rebuild-stack.ps1` (see [LOCAL_DEVELOPMENT_GUIDE.md](LOCAL_DEVELOPMENT_GUIDE.md)).

### Services (local compose)

1. **frontend**: Vite build served by Nginx (port 3002)
2. **backend**: Node.js API (port 3000)
3. **db**: PostgreSQL (port 5432)
4. **traccar**: Traccar server (port 8082)
5. **traccar-mysql**: MySQL 8 for Traccar’s schema (fuel-api reads this database; not published to the host by default)

Optional ERB overlay: `docker compose -f docker-compose.yml -f docker-compose.erb.yml up -d --build`

### Production (registry-only — single model)

Production servers **do not build images**. They **pull** SHA-tagged images from Docker Hub and run `deployment/compose/docker-compose.prod.yml`.

Operator runbook: [deployment/REGISTRY_DEPLOY.md](deployment/REGISTRY_DEPLOY.md)  
CI build/push/deploy: [.github/workflows/main.yml](.github/workflows/main.yml)  
Workstation deploy helper: [deployment/scripts/auto_deploy.py](deployment/scripts/auto_deploy.py) — see [deployment/REGISTRY_DEPLOY.md](deployment/REGISTRY_DEPLOY.md).

### Docker commands (local)

```bash
docker compose up -d --build
docker compose logs -f [service-name]
docker compose down
docker compose down -v
```

### Production backups

Single-node backup and restore (Postgres, Traccar MySQL, optional ERB volume) are documented in [deployment/backup/README.md](deployment/backup/README.md).

## 📡 API Documentation

### Traccar API

Traccar provides a RESTful API. Documentation: https://www.traccar.org/api/

### Fuel API Endpoints

- `GET /api/fuel-requests` - List fuel requests
- `POST /api/fuel-requests` - Create fuel request
- `PUT /api/fuel-requests/:id` - Update fuel request
- `POST /api/fuel-requests/:id/approve` - Approve request
- `POST /api/fuel-requests/:id/reject` - Reject request
- `GET /api/vehicle-specs` - Get vehicle specifications

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](traccar-fleet-system/frontend/LICENSE.txt) file for details.

## 🙏 Acknowledgments

- [Traccar](https://www.traccar.org/) - GPS tracking platform
- [MapLibre GL JS](https://maplibre.org/) - Open-source map rendering
- [Material-UI](https://mui.com/) - React component library
- [React](https://react.dev/) - UI framework

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation in `/docs`
- See [LOCAL_DEVELOPMENT_GUIDE.md](LOCAL_DEVELOPMENT_GUIDE.md) for standardized compose and dev workflows

## 🔒 Security

- Never commit `.env` files
- Use strong passwords in production
- Keep dependencies updated
- Review `backend/.env.example` for required secrets
- SSL certificates should be generated separately

---

**Made with ❤️ for fleet management**

