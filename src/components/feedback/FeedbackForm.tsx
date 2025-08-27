import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  Stack,
  Alert
} from '@mui/material';
import { BugReport, Lightbulb, Warning, ThumbDown } from '@mui/icons-material';

export interface FeedbackItem {
  id: string;
  type: 'bug' | 'feature-request' | 'issue' | 'general';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  timestamp: Date;
  status: 'open' | 'in-progress' | 'resolved' | 'dismissed';
  userAgent?: string;
  appVersion?: string;
  sessionContext?: {
    timerState?: string;
    sessionType?: string;
    currentSession?: boolean;
  };
}

interface FeedbackFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (feedback: Omit<FeedbackItem, 'id' | 'timestamp' | 'status'>) => Promise<void>;
}

const feedbackTypes = [
  { value: 'bug', label: 'Bug Report', icon: <BugReport />, color: 'error' as const },
  { value: 'feature-request', label: 'Feature Request', icon: <Lightbulb />, color: 'info' as const },
  { value: 'issue', label: 'Operational Issue', icon: <Warning />, color: 'warning' as const },
  { value: 'general', label: 'General Feedback', icon: <ThumbDown />, color: 'default' as const }
];

const severityLevels = [
  { value: 'low', label: 'Low', color: 'success' as const },
  { value: 'medium', label: 'Medium', color: 'info' as const },
  { value: 'high', label: 'High', color: 'warning' as const },
  { value: 'critical', label: 'Critical', color: 'error' as const }
];

const categories = [
  'Timer/Sessions',
  'UI/UX',
  'Performance',
  'Data/Storage',
  'Notifications',
  'Settings',
  'Shortcuts/Hotkeys',
  'System Integration',
  'Other'
];

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ open, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    type: 'bug' as FeedbackItem['type'],
    title: '',
    description: '',
    severity: 'medium' as FeedbackItem['severity'],
    category: 'Other'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit({
        ...formData,
        userAgent: navigator.userAgent,
        appVersion: '1.0.0', // Could be dynamic
        sessionContext: {
          // Add session context if needed
          timerState: 'idle', // Could be passed as prop
          sessionType: 'focus',
          currentSession: false
        }
      });
      
      setSubmitSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      type: 'bug',
      title: '',
      description: '',
      severity: 'medium',
      category: 'Other'
    });
    setSubmitSuccess(false);
    onClose();
  };

  const selectedType = feedbackTypes.find(t => t.value === formData.type);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {selectedType?.icon}
          Submit Feedback
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {submitSuccess ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Feedback submitted successfully! Thank you for helping improve the app.
          </Alert>
        ) : (
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              Help us improve Focus Sessions by reporting bugs, suggesting features, or sharing your experience.
            </Typography>

            <FormControl fullWidth>
              <InputLabel>Feedback Type</InputLabel>
              <Select
                value={formData.type}
                label="Feedback Type"
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as FeedbackItem['type'] }))}
              >
                {feedbackTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {type.icon}
                      {type.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={formData.severity}
                  label="Severity"
                  onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value as FeedbackItem['severity'] }))}
                >
                  {severityLevels.map(level => (
                    <MenuItem key={level.value} value={level.value}>
                      <Chip 
                        label={level.label} 
                        size="small" 
                        color={level.color}
                        variant="outlined"
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                >
                  {categories.map(category => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Brief description of the issue or request"
              error={!formData.title.trim()}
              helperText={!formData.title.trim() ? 'Title is required' : ''}
            />

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Please provide detailed information about what happened, what you expected, and steps to reproduce (if applicable)"
              error={!formData.description.trim()}
              helperText={!formData.description.trim() ? 'Description is required' : ''}
            />

            <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                <strong>Tips for good feedback:</strong><br/>
                • Be specific about what happened<br/>
                • Include steps to reproduce the issue<br/>
                • Mention what you expected vs what actually happened<br/>
                • Include any error messages you saw
              </Typography>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={isSubmitting || submitSuccess || !formData.title.trim() || !formData.description.trim()}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};