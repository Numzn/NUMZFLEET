import React, { forwardRef } from 'react';
import { AppBar, Toolbar, Box } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { getTopbarStyles, getTopbarLayoutStyles } from '../../styles/topbarStyles';

const useStyles = makeStyles()((theme) => ({
  container: getTopbarStyles(theme),
  toolbar: getTopbarLayoutStyles(theme),
}));

const UnifiedTopbar = forwardRef(({ 
  children, 
  variant = 'appbar', // 'appbar' | 'box'
  position = 'fixed',
  ...props 
}, ref) => {
  const { classes } = useStyles();
  const Component = variant === 'appbar' ? AppBar : Box;
  
  return (
    <Component 
      ref={ref}
      className={classes.container}
      position={position}
      elevation={0}
      sx={props.sx}
      {...props}
    >
      <Toolbar className={classes.toolbar} disableGutters>
        {children}
      </Toolbar>
    </Component>
  );
});

export default UnifiedTopbar;
