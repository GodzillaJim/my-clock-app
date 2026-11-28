import React from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import type { SettingsSectionProps } from './types';

/** Daily history and export preferences. */
export const DataSection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Daily History
      </Typography>

      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.autoResetDaily}
              onChange={(e) => onChange('autoResetDaily', e.target.checked)}
            />
          }
          label="Automatically reset history at midnight"
        />
      </FormGroup>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Export Format
        </Typography>
        <Select
          value={settings.exportFormat}
          onChange={(e) => onChange('exportFormat', e.target.value as 'csv' | 'json')}
          size="small"
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="csv">CSV</MenuItem>
          <MenuItem value="json">JSON</MenuItem>
        </Select>
      </Box>

      <Alert severity="info" sx={{ mt: 2 }}>
        All session data is stored locally on your device. No data is sent to external servers.
      </Alert>
    </Box>
  );
};
