import { useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Container,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LinkField from '../common/components/LinkField';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { formatNotificationTitle } from '../common/util/formatter';
import AppLayout from '../common/components/AppLayout';
import useSettingsStyles from './common/useSettingsStyles';
import { traccarPath } from '../config/traccarApi.js';

const UserConnectionsPage = () => {
  const { classes } = useSettingsStyles();
  const t = useTranslation();

  const { id } = useParams();

  return (
    <AppLayout>
      <Container maxWidth="xs" className={classes.container}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              {t('sharedConnections')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails className={classes.details}>
            <LinkField
              endpointAll={traccarPath('/api/devices?all=true&excludeAttributes=true')}
              endpointLinked={`${traccarPath('/api/devices')}?userId=${id}&excludeAttributes=true`}
              baseId={id}
              keyBase="userId"
              keyLink="deviceId"
              titleGetter={(it) => `${it.name} (${it.uniqueId})`}
              label={t('deviceTitle')}
            />
            <LinkField
              endpointAll={traccarPath('/api/groups?all=true')}
              endpointLinked={`${traccarPath('/api/groups')}?userId=${id}`}
              baseId={id}
              keyBase="userId"
              keyLink="groupId"
              label={t('settingsGroups')}
            />
            <LinkField
              endpointAll={traccarPath('/api/geofences?all=true')}
              endpointLinked={`${traccarPath('/api/geofences')}?userId=${id}`}
              baseId={id}
              keyBase="userId"
              keyLink="geofenceId"
              label={t('sharedGeofences')}
            />
            <LinkField
              endpointAll={traccarPath('/api/notifications?all=true')}
              endpointLinked={`${traccarPath('/api/notifications')}?userId=${id}`}
              baseId={id}
              keyBase="userId"
              keyLink="notificationId"
              titleGetter={(it) => formatNotificationTitle(t, it, true)}
              label={t('sharedNotifications')}
            />
            <LinkField
              endpointAll={traccarPath('/api/calendars?all=true')}
              endpointLinked={`${traccarPath('/api/calendars')}?userId=${id}`}
              baseId={id}
              keyBase="userId"
              keyLink="calendarId"
              label={t('sharedCalendars')}
            />
            <LinkField
              endpointAll={traccarPath('/api/users?all=true&excludeAttributes=true')}
              endpointLinked={`${traccarPath('/api/users')}?userId=${id}&excludeAttributes=true`}
              baseId={id}
              keyBase="userId"
              keyLink="managedUserId"
              label={t('settingsUsers')}
            />
            <LinkField
              endpointAll={traccarPath('/api/attributes/computed?all=true')}
              endpointLinked={`${traccarPath('/api/attributes/computed')}?userId=${id}`}
              baseId={id}
              keyBase="userId"
              keyLink="attributeId"
              titleGetter={(it) => it.description}
              label={t('sharedComputedAttributes')}
            />
            <LinkField
              endpointAll={traccarPath('/api/drivers?all=true')}
              endpointLinked={`${traccarPath('/api/drivers')}?userId=${id}`}
              baseId={id}
              keyBase="userId"
              keyLink="driverId"
              titleGetter={(it) => `${it.name} (${it.uniqueId})`}
              label={t('sharedDrivers')}
            />
            <LinkField
              endpointAll={traccarPath('/api/commands?all=true')}
              endpointLinked={`${traccarPath('/api/commands')}?userId=${id}`}
              baseId={id}
              keyBase="userId"
              keyLink="commandId"
              titleGetter={(it) => it.description}
              label={t('sharedSavedCommands')}
            />
            <LinkField
              endpointAll={traccarPath('/api/maintenance?all=true')}
              endpointLinked={`${traccarPath('/api/maintenance')}?userId=${id}`}
              baseId={id}
              keyBase="userId"
              keyLink="maintenanceId"
              label={t('sharedMaintenance')}
            />
          </AccordionDetails>
        </Accordion>
      </Container>
    </AppLayout>
  );
};

export default UserConnectionsPage;
