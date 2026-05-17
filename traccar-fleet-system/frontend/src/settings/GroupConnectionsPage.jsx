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
import { formatNotificationTitle } from '../common/util/formatter';
import useFeatures from '../common/util/useFeatures';
import useSettingsStyles from './common/useSettingsStyles';
import { traccarPath } from '../config/traccarApi.js';

const GroupConnectionsPage = () => {
  const { classes } = useSettingsStyles();
  const t = useTranslation();

  const { id } = useParams();

  const features = useFeatures();

  return (
      <Container maxWidth="xs" className={classes.container}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              {t('sharedConnections')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails className={classes.details}>
            <LinkField
              endpointAll={traccarPath('/api/geofences?all=true')}
              endpointLinked={`${traccarPath('/api/geofences')}?groupId=${id}`}
              baseId={id}
              keyBase="groupId"
              keyLink="geofenceId"
              label={t('sharedGeofences')}
            />
            <LinkField
              endpointAll={traccarPath('/api/notifications?all=true')}
              endpointLinked={`${traccarPath('/api/notifications')}?groupId=${id}`}
              baseId={id}
              keyBase="groupId"
              keyLink="notificationId"
              titleGetter={(it) => formatNotificationTitle(t, it)}
              label={t('sharedNotifications')}
            />
            {!features.disableDrivers && (
              <LinkField
                endpointAll={traccarPath('/api/drivers?all=true')}
                endpointLinked={`${traccarPath('/api/drivers')}?groupId=${id}`}
                baseId={id}
                keyBase="groupId"
                keyLink="driverId"
                titleGetter={(it) => `${it.name} (${it.uniqueId})`}
                label={t('sharedDrivers')}
              />
            )}
            {!features.disableComputedAttributes && (
              <LinkField
                endpointAll={traccarPath('/api/attributes/computed?all=true')}
                endpointLinked={`${traccarPath('/api/attributes/computed')}?groupId=${id}`}
                baseId={id}
                keyBase="groupId"
                keyLink="attributeId"
                titleGetter={(it) => it.description}
                label={t('sharedComputedAttributes')}
              />
            )}
            {!features.disableSavedCommands && (
              <LinkField
                endpointAll={traccarPath('/api/commands?all=true')}
                endpointLinked={`${traccarPath('/api/commands')}?groupId=${id}`}
                baseId={id}
                keyBase="groupId"
                keyLink="commandId"
                titleGetter={(it) => it.description}
                label={t('sharedSavedCommands')}
              />
            )}
            {!features.disableMaintenance && (
              <LinkField
                endpointAll={traccarPath('/api/maintenance?all=true')}
                endpointLinked={`${traccarPath('/api/maintenance')}?groupId=${id}`}
                baseId={id}
                keyBase="groupId"
                keyLink="maintenanceId"
                label={t('sharedMaintenance')}
              />
            )}
          </AccordionDetails>
        </Accordion>
      </Container>
  );
};

export default GroupConnectionsPage;
