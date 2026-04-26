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
   - Port: 3001

3. **Frontend**: React-based web application
   - React 19 with Material-UI (MUI)
   - Redux for state management
   - MapLibre GL JS for maps
   - Vite for build tooling
   - Port: 3002

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
git clone https://github.com/Numzn/NUMZGPS.git
cd NUMZGPS
```

### 2. Environment Setup

Copy the environment template and configure:

```bash
# Backend environment
cp backend/env.template backend/.env
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

Create `backend/.env` from `backend/env.template`:

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
PORT=3001
CORS_ORIGIN=http://localhost:3002
```

### Database Setup

The system uses two databases:

- **MySQL** (Traccar): Stores device data, positions, events
- **PostgreSQL** (Fuel Management): Stores fuel requests, stations, vehicle specs

Database initialization scripts are in `backend/scripts/init-database.sql`

## 🚀 Running the Application

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
cd backend
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production (Oracle, Same-Origin) — Git-First Release

All production deployments are commit-locked. Only commits already in `origin/main` can reach the server. Never deploy local build artifacts directly.

**One-command release (Windows PowerShell, from repo root):**

```powershell
# Deploy latest origin/main to numz.site
.\release-prod.ps1
```

**Roll back to a previous known-good commit:**

```powershell
.\release-prod.ps1 -Commit <prev-sha>
```

The script enforces this flow automatically:
1. Frontend lint → build (local gate)
2. Nginx config syntax check (local gate)
3. Resolve + verify SHA is in `origin/main`
4. SSH → checkout exact SHA on server → build + deploy
5. Live health checks (HTTPS, Traccar API, Fuel API)

**CI gate** — every PR and push to `main` runs [`.github/workflows/release-gate.yml`](.github/workflows/release-gate.yml) which validates frontend and nginx config before merge is allowed.

Production URLs:

- Frontend: https://numz.site
- Traccar API (cemented): https://numz.site/traccar/api/... (see [ROUTING.md](ROUTING.md))
- Fuel API (same origin): https://numz.site/api/... (e.g. `/api/fuel-requests`)

### Option 2: Local Development

#### Start Backend (Traccar)
```bash
cd backend
./start-numztrak.ps1  # Windows PowerShell
# or
java -jar traccar.jar
```

#### Start Fuel API
```bash
cd fuel-api
npm run dev
```

#### Start Frontend
```bash
cd traccar-fleet-system/frontend
npm start
# or for local development
npm run start:local
```

### Access Points

- **Frontend**: http://localhost:3002
- **Traccar API**: http://localhost:8082
- **Fuel API**: http://localhost:3001
- **MySQL**: localhost:3306
- **PostgreSQL**: localhost:5432

## 📁 Project Structure

```
numztrak-fleet-system/
├── backend/                 # Traccar backend (Java)
│   ├── conf/               # Configuration files
│   ├── scripts/            # Database and utility scripts
│   ├── docker-compose.yml  # Docker services definition
│   └── env.template        # Environment variables template
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
└── data/                   # Database data (gitignored)
    ├── mysql/             # MySQL data
    └── fuel-postgres/     # PostgreSQL data
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

# Start production
npm start
```

### Code Style

- **Frontend**: ESLint with Airbnb config
- **Backend**: Follow Java conventions
- **API**: ESLint recommended

## 🐳 Docker Deployment

### Services

The Docker Compose setup includes:

1. **numztrak-mysql**: MySQL 8.0 for Traccar
2. **numztrak-postgres**: PostgreSQL 15 for Fuel API
3. **numztrak-traccar**: Traccar GPS tracking server
4. **numztrak-fuel-api**: Fuel management API
5. **numztrak-frontend**: React frontend (optional)
6. **numztrak-nginx**: Reverse proxy (optional)

### Docker Commands

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f [service-name]

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## 📡 API Documentation

### Traccar API

Traccar provides a RESTful API. Documentation: https://www.traccar.org/api/

### Fuel API Endpoints

- `GET /api/fuel-requests` - List fuel requests
- `POST /api/fuel-requests` - Create fuel request
- `PUT /api/fuel-requests/:id` - Update fuel request
- `POST /api/fuel-requests/:id/approve` - Approve request
- `POST /api/fuel-requests/:id/reject` - Reject request
- `GET /api/fuel-stations` - List fuel stations
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
- Review `DOCKER_SETUP_REVIEW.md` for deployment help

## 🔒 Security

- Never commit `.env` files
- Use strong passwords in production
- Keep dependencies updated
- Review `backend/env.template` for required secrets
- SSL certificates should be generated separately

---

**Made with ❤️ for fleet management**

