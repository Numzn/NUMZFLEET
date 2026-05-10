# Contributing to NumzTrak Fleet Management System

Thank you for your interest in contributing to NumzTrak! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Production releases (registry model)](#production-releases-registry-model)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)

## 📜 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## 🚀 Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/Numzn/NUMZFLEET.git
   cd NUMZFLEET
   ```
   Use your fork URL if you forked first; the clone folder name may differ (for example `NUMZFLEET`).

2. **Set up development environment**
   - Follow the installation instructions in [README.md](README.md)
   - Ensure all services are running
   - Run tests to verify setup

3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

## 🚢 Production releases (registry model)

Production deployment is **registry-based only**: images are built in CI (or a release machine), pushed to Docker Hub as `numzfleet-frontend`, `numzfleet-backend`, and `numzfleet-erb` tagged with the **full git SHA**; servers run `deployment/deploy/deploy-from-registry.sh` (pull + up, no build).

Read [deployment/REGISTRY_DEPLOY.md](deployment/REGISTRY_DEPLOY.md) and ensure workflow secrets `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` are set for [.github/workflows/build-push-numzfleet-images.yml](.github/workflows/build-push-numzfleet-images.yml).

## 💻 Development Workflow

### Frontend Development

```bash
cd traccar-fleet-system/frontend
npm install
npm start
```

### Fuel API Development

```bash
cd fuel-api
npm install
npm run dev
```

### Backend Development

- Use Java 11+
- Follow Traccar development guidelines
- Test GPS protocol handlers thoroughly

## 📐 Coding Standards

### JavaScript/TypeScript

- Use ESLint configuration (Airbnb style guide)
- Follow React best practices
- Use functional components with hooks
- Prefer `const` and `let` over `var`
- Use meaningful variable names

### Code Formatting

- Use 2 spaces for indentation
- Use single quotes for strings (JavaScript)
- Use trailing commas in objects/arrays
- Maximum line length: 100 characters

### File Naming

- Components: `PascalCase.jsx` (e.g., `FuelRequestsCard.jsx`)
- Utilities: `camelCase.js` (e.g., `dataAggregator.js`)
- Constants: `UPPER_SNAKE_CASE.js`

### Component Structure

```jsx
// 1. Imports
import React from 'react';
import { useState } from 'react';

// 2. Component
const MyComponent = ({ prop1, prop2 }) => {
  // 3. Hooks
  const [state, setState] = useState(null);
  
  // 4. Effects
  useEffect(() => {
    // effect logic
  }, []);
  
  // 5. Handlers
  const handleClick = () => {
    // handler logic
  };
  
  // 6. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};

export default MyComponent;
```

## 📝 Commit Guidelines

Use conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(fuel): add fuel request approval workflow
fix(map): resolve geolocation button disabled state
docs(readme): update installation instructions
style(ui): improve button spacing in navigation controls
refactor(api): simplify fuel request service logic
```

## 🔀 Pull Request Process

1. **Update documentation** if needed
2. **Ensure tests pass** (if applicable)
3. **Update CHANGELOG.md** with your changes
4. **Request review** from maintainers
5. **Address feedback** promptly
6. **Squash commits** if requested

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No console.logs or debug code
- [ ] No sensitive data committed
- [ ] Tests pass (if applicable)

## 🧪 Testing

### Frontend Testing

```bash
cd traccar-fleet-system/frontend
npm test
```

### API Testing

- Test endpoints with Postman or similar
- Verify error handling
- Test edge cases

### Manual Testing

- Test on multiple browsers
- Test responsive design
- Verify accessibility

## 🐛 Reporting Bugs

Use the GitHub issue template and include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: OS, browser, Node version
- **Screenshots**: If applicable

## 💡 Suggesting Features

- Use the feature request template
- Explain the use case
- Describe the expected behavior
- Consider implementation complexity

## 📚 Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for new functions
- Update API documentation if endpoints change
- Keep code comments clear and concise

## 🔒 Security

- **Never commit**:
  - `.env` files
  - API keys or secrets
  - SSL certificates
  - Database passwords
  - Personal information

- **Report security issues** privately to maintainers

## ❓ Questions?

- Open a discussion on GitHub
- Check existing issues and PRs
- Review documentation in `fuel-api/docs/` and repo markdown guides (`README.md`, `LOCAL_DEVELOPMENT_GUIDE.md`)

Thank you for contributing! 🎉





