import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Button, Accordion, AccordionDetails, AccordionSummary, Skeleton, Typography, TextField,
} from '@mui/material';
import { useCatch, useEffectAsync } from '../../reactHelper';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useSettingsStyles from '../common/useSettingsStyles';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { traccarPath } from '../../config/traccarApi.js';
import { settingsListParent } from '../../common/util/navigationParents';

const EditItemView = ({
  children, endpoint, item, setItem, defaultItem, validate, onItemSaved,
}) => {
  const navigate = useNavigate();
  const { classes } = useSettingsStyles();
  const t = useTranslation();

  const { id } = useParams();

  useEffectAsync(async () => {
    if (!item) {
      if (id) {
        const response = await fetchOrThrow(traccarPath(`/api/${endpoint}/${id}`));
        setItem(await response.json());
      } else {
        setItem(defaultItem || {});
      }
    }
  }, [id, item, defaultItem]);

  const handleSave = useCatch(async () => {
    let path = `/api/${endpoint}`;
    if (id) {
      path += `/${id}`;
    }

    const response = await fetchOrThrow(traccarPath(path), {
      method: !id ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });

    if (onItemSaved) {
      onItemSaved(await response.json());
    }
    navigate(settingsListParent(endpoint));
  });

  return (
      // `xs` capped every settings form at 444px regardless of screen size, so
      // on a desktop the form sat in a narrow ribbon with the rest of the page
      // empty. `sm` (600px) still respects a sane line length for a single
      // column of fields without wasting the whole viewport.
      <Container maxWidth="sm" className={classes.container} sx={{ mx: 0 }}>
        {item ? children : (
          <Accordion defaultExpanded>
            <AccordionSummary>
              <Typography variant="subtitle1">
                <Skeleton width="10em" />
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {[...Array(3)].map((_, i) => (
                <Skeleton key={-i} width="100%">
                  <TextField />
                </Skeleton>
              ))}
            </AccordionDetails>
          </Accordion>
        )}
        <div className={classes.buttons}>
          <Button
            color="primary"
            variant="outlined"
            onClick={() => navigate(settingsListParent(endpoint))}
            disabled={!item}
          >
            {t('sharedCancel')}
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={handleSave}
            disabled={!item || !validate()}
          >
            {t('sharedSave')}
          </Button>
        </div>
      </Container>
  );
};

export default EditItemView;
