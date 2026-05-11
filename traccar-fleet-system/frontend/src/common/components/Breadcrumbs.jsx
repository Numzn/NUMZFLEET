import React from 'react';
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography, Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';
import { useContextStripState } from './contextStripState';

const StyledBreadcrumbs = styled(MuiBreadcrumbs)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  '& .MuiBreadcrumbs-ol': {
    flexWrap: 'wrap',
    rowGap: theme.spacing(0.25),
  },
  '& .MuiBreadcrumbs-separator': {
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
  },
  '& .MuiBreadcrumbs-li': {
    display: 'flex',
    alignItems: 'center',
  },
}));

const BreadcrumbLink = styled(Link)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  textDecoration: 'none',
  color: theme.palette.text.secondary,
  fontSize: '0.8125rem',
  fontWeight: 600,
  lineHeight: 1.2,
  transition: 'color 0.2s ease',
  '&:hover': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
  },
}));

const BreadcrumbText = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  fontSize: '0.8125rem',
  color: theme.palette.text.primary,
  fontWeight: 700,
  lineHeight: 1.2,
}));

const BreadcrumbIcon = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginRight: 0,
  '& svg': {
    fontSize: '1.05rem',
  },
}));

const Breadcrumbs = ({ items = [], showHome = true, hideWhenContextStrip = true }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { enabled } = useContextStripState();

  if (hideWhenContextStrip && enabled) {
    return null;
  }

  const formatSegmentLabel = (seg) => {
    const raw = String(seg || '');
    if (!raw) return '';

    // Friendly labels for known route segments
    const known = {
      fleet: 'Fleet',
      'operation-sessions': 'Operation sessions',
      run: 'Run',
      plan: 'Plan',
      create: 'Create',
      history: 'History',
      vehicles: 'Vehicles',
      'fuel-requests': 'Fuel requests',
    };
    if (known[raw]) return known[raw];

    // IDs look ugly as bare numbers in breadcrumbs
    if (/^\d+$/.test(raw)) return `#${raw}`;

    return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/-/g, ' ');
  };

  // Generate breadcrumbs from current path if no items provided
  const generateBreadcrumbs = () => {
    if (items.length > 0) return items;
    
    const pathnames = location.pathname.split('/').filter((x) => x);
    const breadcrumbs = [];
    
    if (showHome) {
      breadcrumbs.push({
        label: 'Home',
        href: '/',
        icon: <HomeIcon />,
      });
    }
    
    pathnames.forEach((name, index) => {
      const href = `/${pathnames.slice(0, index + 1).join('/')}`;
      const label = formatSegmentLabel(name);
      
      breadcrumbs.push({
        label,
        href,
        isLast: index === pathnames.length - 1,
      });
    });
    
    return breadcrumbs;
  };

  const breadcrumbItems = generateBreadcrumbs();

  const handleClick = (href, isLast) => {
    if (!isLast && href) {
      navigate(href);
    }
  };

  return (
    <StyledBreadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      aria-label="breadcrumb"
    >
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;
        
        return (
          <Box key={index} component="span">
            {isLast ? (
              <BreadcrumbText component="span">
                {item.icon && <BreadcrumbIcon>{item.icon}</BreadcrumbIcon>}
                {item.label}
              </BreadcrumbText>
            ) : (
              <BreadcrumbLink
                component="button"
                onClick={() => handleClick(item.href, isLast)}
                sx={{ cursor: 'pointer' }}
              >
                {item.icon && <BreadcrumbIcon>{item.icon}</BreadcrumbIcon>}
                {item.label}
              </BreadcrumbLink>
            )}
          </Box>
        );
      })}
    </StyledBreadcrumbs>
  );
};

export default Breadcrumbs;

