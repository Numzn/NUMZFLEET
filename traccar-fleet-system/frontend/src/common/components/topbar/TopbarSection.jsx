import React from 'react';
import { Box } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { 
  getLeftSectionStyles, 
  getCenterSectionStyles, 
  getRightSectionStyles,
  getDividerStyles 
} from '../../styles/topbarStyles';

const useStyles = makeStyles()((theme) => ({
  leftSection: getLeftSectionStyles(theme),
  centerSection: getCenterSectionStyles(theme),
  rightSection: getRightSectionStyles(theme),
  divider: getDividerStyles(theme),
}));

export const TopbarLeftSection = ({ children, ...props }) => {
  const { classes } = useStyles();
  return <Box className={classes.leftSection} {...props}>{children}</Box>;
};

export const TopbarCenterSection = ({ children, ...props }) => {
  const { classes } = useStyles();
  return <Box className={classes.centerSection} {...props}>{children}</Box>;
};

export const TopbarRightSection = ({ children, ...props }) => {
  const { classes } = useStyles();
  return <Box className={classes.rightSection} {...props}>{children}</Box>;
};

export const TopbarDivider = ({ ...props }) => {
  const { classes } = useStyles();
  return <Box className={classes.divider} {...props} />;
};









