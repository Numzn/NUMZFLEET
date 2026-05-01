import { Card, CardContent, Grid, Typography } from '@mui/material';

const formatCurrency = (value) => new Intl.NumberFormat('en-ZM', {
  style: 'currency',
  currency: 'ZMW',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const SessionStats = ({ sessions = [], fleetEfficiency = { efficiency: null, type: null } }) => {
  const totals = sessions.reduce((acc, session) => ({
    totalBudget: acc.totalBudget + (session.totalBudget || 0),
    totalSpent: acc.totalSpent + (session.totalSpent || 0),
  }), { totalBudget: 0, totalSpent: 0 });

  const difference = totals.totalBudget - totals.totalSpent;

  const cards = [
    { label: 'Total Budget', value: formatCurrency(totals.totalBudget) },
    { label: 'Spent', value: formatCurrency(totals.totalSpent) },
    { label: 'Balance', value: formatCurrency(difference) },
    {
      label: 'Efficiency',
      value: fleetEfficiency.efficiency != null
        ? `${fleetEfficiency.efficiency.toFixed(1)} ${fleetEfficiency.type || ''}`
        : '--',
    },
  ];

  return (
    <Grid container spacing={2}>
      {cards.map((card) => (
        <Grid item xs={12} sm={6} md={3} key={card.label}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">{card.label}</Typography>
              <Typography variant="h5">{card.value}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default SessionStats;
