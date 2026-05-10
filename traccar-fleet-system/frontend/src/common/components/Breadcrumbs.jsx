import React from 'react';
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography, Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';

const StyledBreadcrumbs = styled(MuiBreadcrumbs)(({ theme }) => ({
  '& .MuiBreadcrumbs-separator': {
    color: theme.palette.text.secondary,
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
  color: theme.palette.primary.main,
  fontSize: '0.875rem',
  fontWeight: 500,
  transition: 'color 0.2s ease',
  '&:hover': {
    color: theme.palette.primary.dark,
    textDecoration: 'underline',
  },
}));

const BreadcrumbText = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  fontWeight: 500,
}));

const BreadcrumbIcon = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginRight: theme.spacing(0.5),
  '& svg': {
    fontSize: '1rem',
  },
}));

const Breadcrumbs = ({ items = [], showHome = true }) => {
  const navigate = useNavigate();
  const location = useLocation();

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
      const label = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
      
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

