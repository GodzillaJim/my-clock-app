import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Box,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Stack,
  Card,
  CardContent,
  Grid,
  Alert
} from '@mui/material';
import {
  Visibility,
  Edit,
  Delete,
  Download,
  Refresh,
  BugReport,
  Lightbulb,
  Warning,
  ThumbDown,
  CheckCircle,
  Cancel,
  Schedule
} from '@mui/icons-material';
import { FeedbackItem } from './FeedbackForm';
import { focusStorage } from '@/services/focusStorage';

interface FeedbackManagerProps {
  open: boolean;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const getTypeIcon = (type: FeedbackItem['type']) => {
  switch (type) {
    case 'bug': return <BugReport />;
    case 'feature-request': return <Lightbulb />;
    case 'issue': return <Warning />;
    case 'general': return <ThumbDown />;
  }
};

const getStatusIcon = (status: FeedbackItem['status']) => {
  switch (status) {
    case 'open': return <Schedule color="warning" />;
    case 'in-progress': return <Schedule color="info" />;
    case 'resolved': return <CheckCircle color="success" />;
    case 'dismissed': return <Cancel color="disabled" />;
  }
};

const getSeverityColor = (severity: FeedbackItem['severity']): 'default' | 'success' | 'warning' | 'error' => {
  switch (severity) {
    case 'low': return 'success';
    case 'medium': return 'default';
    case 'high': return 'warning';
    case 'critical': return 'error';
  }
};

const getTypeColor = (type: FeedbackItem['type']): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (type) {
    case 'bug': return 'error';
    case 'feature-request': return 'info';
    case 'issue': return 'warning';
    case 'general': return 'default';
  }
};

export const FeedbackManager: React.FC<FeedbackManagerProps> = ({ open, onClose }) => {
  const [tabValue, setTabValue] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<FeedbackItem[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    resolved: 0,
    byType: { bug: 0, 'feature-request': 0, issue: 0, general: 0 },
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 }
  });
  const [filters, setFilters] = useState({
    status: 'all' as FeedbackItem['status'] | 'all',
    type: 'all' as FeedbackItem['type'] | 'all',
    severity: 'all' as FeedbackItem['severity'] | 'all'
  });

  useEffect(() => {
    if (open) {
      loadFeedback();
    }
  }, [open]);

  useEffect(() => {
    applyFilters();
  }, [feedback, filters]);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const [allFeedback, feedbackStats] = await Promise.all([
        focusStorage.getFeedback(),
        focusStorage.getFeedbackStats()
      ]);
      setFeedback(allFeedback);
      setStats(feedbackStats);
    } catch (error) {
      console.error('Failed to load feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...feedback];

    if (filters.status !== 'all') {
      filtered = filtered.filter(f => f.status === filters.status);
    }
    if (filters.type !== 'all') {
      filtered = filtered.filter(f => f.type === filters.type);
    }
    if (filters.severity !== 'all') {
      filtered = filtered.filter(f => f.severity === filters.severity);
    }

    setFilteredFeedback(filtered);
  };

  const updateFeedbackStatus = async (id: string, status: FeedbackItem['status']) => {
    try {
      await focusStorage.updateFeedbackStatus(id, status);
      await loadFeedback(); // Reload data
    } catch (error) {
      console.error('Failed to update feedback status:', error);
    }
  };

  const deleteFeedback = async (id: string) => {
    if (confirm('Are you sure you want to delete this feedback?')) {
      try {
        await focusStorage.deleteFeedback(id);
        await loadFeedback(); // Reload data
      } catch (error) {
        console.error('Failed to delete feedback:', error);
      }
    }
  };

  const exportFeedback = async () => {
    try {
      const csvData = await focusStorage.exportFeedback('csv');
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export feedback:', error);
    }
  };

  const renderOverviewTab = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Feedback Summary
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Total Items:</Typography>
                  <Typography variant="h6">{stats.total}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Open:</Typography>
                  <Typography variant="h6" color="warning.main">{stats.open}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Resolved:</Typography>
                  <Typography variant="h6" color="success.main">{stats.resolved}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                By Type
              </Typography>
              <Stack spacing={1}>
                {Object.entries(stats.byType).map(([type, count]) => (
                  <Box key={type} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getTypeIcon(type as FeedbackItem['type'])}
                      <Typography>{type}</Typography>
                    </Box>
                    <Typography>{count}</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                By Severity
              </Typography>
              <Stack direction="row" spacing={2}>
                {Object.entries(stats.bySeverity).map(([severity, count]) => (
                  <Chip
                    key={severity}
                    label={`${severity}: ${count}`}
                    color={getSeverityColor(severity as FeedbackItem['severity'])}
                    variant="outlined"
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const renderFeedbackTab = () => (
    <Box>
      {/* Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filters.status}
            label="Status"
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="in-progress">In Progress</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
            <MenuItem value="dismissed">Dismissed</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={filters.type}
            label="Type"
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="bug">Bug</MenuItem>
            <MenuItem value="feature-request">Feature Request</MenuItem>
            <MenuItem value="issue">Issue</MenuItem>
            <MenuItem value="general">General</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Severity</InputLabel>
          <Select
            value={filters.severity}
            label="Severity"
            onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value as any }))}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ ml: 'auto' }}>
          <IconButton onClick={loadFeedback} disabled={loading}>
            <Refresh />
          </IconButton>
          <IconButton onClick={exportFeedback}>
            <Download />
          </IconButton>
        </Box>
      </Box>

      {/* Feedback Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">Loading...</TableCell>
              </TableRow>
            ) : filteredFeedback.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">No feedback items found</TableCell>
              </TableRow>
            ) : (
              filteredFeedback.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Chip
                      icon={getTypeIcon(item.type)}
                      label={item.type}
                      size="small"
                      color={getTypeColor(item.type)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.severity}
                      size="small"
                      color={getSeverityColor(item.severity)}
                      variant="filled"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getStatusIcon(item.status)}
                      <Typography variant="body2">{item.status}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {item.timestamp.toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedFeedback(item);
                            setShowDetail(true);
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => deleteFeedback(item.id)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderFeedbackDetail = () => {
    if (!selectedFeedback) return null;

    return (
      <Dialog open={showDetail} onClose={() => setShowDetail(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getTypeIcon(selectedFeedback.type)}
            Feedback Details
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6">{selectedFeedback.title}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip
                  label={selectedFeedback.type}
                  color={getTypeColor(selectedFeedback.type)}
                  size="small"
                />
                <Chip
                  label={selectedFeedback.severity}
                  color={getSeverityColor(selectedFeedback.severity)}
                  size="small"
                />
                <Chip
                  label={selectedFeedback.status}
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>Description:</Typography>
              <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedFeedback.description}
                </Typography>
              </Paper>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Category:</Typography>
                <Typography variant="body2">{selectedFeedback.category}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Submitted:</Typography>
                <Typography variant="body2">
                  {selectedFeedback.timestamp.toLocaleString()}
                </Typography>
              </Grid>
            </Grid>

            {selectedFeedback.userAgent && (
              <Box>
                <Typography variant="subtitle2">User Agent:</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  {selectedFeedback.userAgent}
                </Typography>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" gutterBottom>Change Status:</Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant={selectedFeedback.status === 'open' ? 'contained' : 'outlined'}
                  onClick={() => updateFeedbackStatus(selectedFeedback.id, 'open')}
                >
                  Open
                </Button>
                <Button
                  size="small"
                  variant={selectedFeedback.status === 'in-progress' ? 'contained' : 'outlined'}
                  onClick={() => updateFeedbackStatus(selectedFeedback.id, 'in-progress')}
                >
                  In Progress
                </Button>
                <Button
                  size="small"
                  variant={selectedFeedback.status === 'resolved' ? 'contained' : 'outlined'}
                  onClick={() => updateFeedbackStatus(selectedFeedback.id, 'resolved')}
                >
                  Resolved
                </Button>
                <Button
                  size="small"
                  variant={selectedFeedback.status === 'dismissed' ? 'contained' : 'outlined'}
                  onClick={() => updateFeedbackStatus(selectedFeedback.id, 'dismissed')}
                >
                  Dismissed
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetail(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Feedback Management
            <Typography variant="body2" color="text.secondary">
              {stats.total} total items
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab label="Overview" />
              <Tab label={`Feedback Items (${filteredFeedback.length})`} />
            </Tabs>
          </Box>
          
          <TabPanel value={tabValue} index={0}>
            {renderOverviewTab()}
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            {renderFeedbackTab()}
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {renderFeedbackDetail()}
    </>
  );
};