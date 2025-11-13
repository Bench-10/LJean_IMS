import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useAuth } from '../../../authentication/Authentication.jsx';
import { currencyFormat } from '../../../utils/formatCurrency.js';
import ChartNoData from '../../common/ChartNoData.jsx';
import ChartLoading from '../../common/ChartLoading.jsx';
import { analyticsApi } from '../../../utils/api.js';
import DropdownCustom from '../../DropdownCustom.jsx';
import dayjs from 'dayjs';

// Timeline window sizes (how many periods to show per page)
const TIMELINE_WINDOW_SIZES = { daily: 7, weekly: 5, monthly: 5 };
const TIMELINE_CACHE = new Map();
const TIMELINE_SELECTION_KEY = 'analytics:branchTimeline:lastSelection';

function BranchTimeline({ Card, categoryFilter, branchTimelineRef }) {
  const { user } = useAuth();
  const [branchTimelineData, setBranchTimelineData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(() => {
    if (typeof window === 'undefined') return '1';
    return window.sessionStorage.getItem(TIMELINE_SELECTION_KEY) || '1';
  });
  const [timelineInterval, setTimelineInterval] = useState('monthly');
  const [allBranches, setAllBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [timelineMeta, setTimelineMeta] = useState({
    min_date: null,
    max_date: null
  });
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [totalPeriods, setTotalPeriods] = useState(TIMELINE_WINDOW_SIZES[timelineInterval] || TIMELINE_WINDOW_SIZES.monthly);

  const updateSelectedBranch = useCallback((value, options = {}) => {
    const normalized = value ? String(value) : '';
    const nextValue = normalized || (options.allowEmpty ? '' : '1');
    setSelectedBranch(nextValue || (options.allowEmpty ? '' : '1'));
    if (typeof window !== 'undefined') {
      if (nextValue) {
        window.sessionStorage.setItem(TIMELINE_SELECTION_KEY, nextValue);
      } else {
        window.sessionStorage.removeItem(TIMELINE_SELECTION_KEY);
      }
    }
  }, []);
  
  // ROLE CHECK: ONLY OWNER SHOULD SEE BRANCH TIMELINE
  const isOwner = useMemo(() => {
    if (!user) return false;
    const roles = Array.isArray(user.role) ? user.role : user?.role ? [user.role] : [];
    return roles.some(role => role.toLowerCase() === 'owner');
  }, [user]);

  const cacheKey = useMemo(
    () => JSON.stringify({
      branch: selectedBranch || '1',
      interval: timelineInterval,
      category: categoryFilter || 'all'
    }),
    [categoryFilter, selectedBranch, timelineInterval]
  );

  // Fetch branches independently and always auto-select first branch
  const fetchBranches = useCallback(async (signal) => {
    if (!isOwner) {
      setAllBranches([]);
      return;
    }
    
    try {
      setLoadingBranches(true);
      const response = await analyticsApi.get(`/api/analytics/branches`, { signal });
      const branches = Array.isArray(response.data) ? response.data : [];
      setAllBranches(branches);

      if (!branches.length) {
        updateSelectedBranch('', { allowEmpty: true });
        return;
      }

      const storedSelection = typeof window !== 'undefined'
        ? window.sessionStorage.getItem(TIMELINE_SELECTION_KEY)
        : null;

      const candidateValues = [
        selectedBranch,
        storedSelection,
        String(branches[0].branch_id)
      ].filter(Boolean).map(val => String(val));

      const nextSelection =
        candidateValues.find(value =>
          branches.some(b => String(b.branch_id) === value)
        ) || String(branches[0].branch_id);

      if (nextSelection !== selectedBranch) {
        updateSelectedBranch(nextSelection);
      } else if (typeof window !== 'undefined' && nextSelection) {
        window.sessionStorage.setItem(TIMELINE_SELECTION_KEY, nextSelection);
      }
    } catch (e) {
      if (e?.code === 'ERR_CANCELED') return;
      console.error('Branches fetch error:', e);
    } finally {
      setLoadingBranches(false);
    }
  }, [isOwner, selectedBranch, updateSelectedBranch]);

  // Load branches on mount
  useEffect(() => {
    const controller = new AbortController();
    fetchBranches(controller.signal);
    return () => controller.abort();
  }, [fetchBranches]);

  // Reset pagination when branch or interval changes
  useEffect(() => {
    setBranchTimelineData([]);
    setTimelineMeta({ min_date: null, max_date: null });
    setHasMoreHistory(true);
    setTotalPeriods(TIMELINE_WINDOW_SIZES[timelineInterval] || TIMELINE_WINDOW_SIZES.monthly);
  }, [selectedBranch, timelineInterval]);

  const getIntervalUnit = useCallback(() => {
    if (timelineInterval === 'daily') return 'day';
    if (timelineInterval === 'weekly') return 'week';
    if (timelineInterval === 'monthly') return 'month';
    return 'year';
  }, [timelineInterval]);

  // Compute date range for pagination
  const computeTimelineRange = useCallback(({ endDate } = {}) => {
    const unit = getIntervalUnit();
    let end = endDate ? dayjs(endDate) : dayjs();
    if (!end.isValid()) {
      return null;
    }

    // Align end date to interval boundary
    if (timelineInterval === 'weekly') {
      end = end.endOf('week');
    } else if (timelineInterval === 'monthly') {
      end = end.endOf('month');
    } else if (timelineInterval === 'yearly') {
      end = end.endOf('year');
    } else {
      end = end.endOf('day');
    }

    const start = end.subtract(totalPeriods - 1, unit);
    if (timelineInterval === 'weekly') {
      end = end.endOf('week');
      const alignedStart = start.startOf('week');
      return {
        start_date: alignedStart.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD')
      };
    }
    if (timelineInterval === 'monthly') {
      const alignedStart = start.startOf('month');
      const alignedEnd = end.endOf('month');
      return {
        start_date: alignedStart.format('YYYY-MM-DD'),
        end_date: alignedEnd.format('YYYY-MM-DD')
      };
    }
    if (timelineInterval === 'yearly') {
      const alignedStart = start.startOf('year');
      const alignedEnd = end.endOf('year');
      return {
        start_date: alignedStart.format('YYYY-MM-DD'),
        end_date: alignedEnd.format('YYYY-MM-DD')
      };
    }

    return {
      start_date: start.startOf('day').format('YYYY-MM-DD'),
      end_date: end.endOf('day').format('YYYY-MM-DD')
    };
  }, [getIntervalUnit, timelineInterval, totalPeriods]);

  // Fetch timeline data with pagination
  const loadTimelineChunk = useCallback(async ({ mode = 'replace', signal, rangeOverride } = {}) => {
    if (!isOwner || !selectedBranch) {
      setBranchTimelineData([]);
      setLoading(false);
      return;
    }

    const range = rangeOverride ?? computeTimelineRange();
    if (!range) return;

    try {
      setLoading(true);
      setError(null);

      const params = {
        branch_id: selectedBranch,
        interval: timelineInterval,
        start_date: range.start_date,
        end_date: range.end_date
      };

      if (categoryFilter) {
        params.category_id = categoryFilter;
      }

      const response = await analyticsApi.get(`/api/analytics/branch-timeline`, {
        params,
        signal
      });

      const timelineData = Array.isArray(response.data) ? response.data : [];
      const sorted = timelineData
        .slice()
        .sort((a, b) => (a.period || '').localeCompare(b.period || ''));
      const dates = sorted.map((d) => d.period).filter(Boolean);
      const meta = {
        min_date: dates[0] || null,
        max_date: dates[dates.length - 1] || null
      };
      setTimelineMeta(meta);
      setBranchTimelineData(sorted);
      setHasMoreHistory(sorted.length >= totalPeriods);
      TIMELINE_CACHE.set(cacheKey, {
        data: sorted,
        meta,
        hasMoreHistory: sorted.length >= totalPeriods,
        totalPeriods
      });

    } catch (e) {
      if (e?.code === 'ERR_CANCELED') return;
      console.error('Branch timeline fetch error:', e);
      setError('Failed to load branch timeline data');
      setBranchTimelineData([]);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, categoryFilter, computeTimelineRange, isOwner, selectedBranch, timelineInterval, totalPeriods]);

  // Load initial data
  useEffect(() => {
    if (!selectedBranch || loadingBranches) return;
    const cached = TIMELINE_CACHE.get(cacheKey);
    if (cached && cached.totalPeriods === totalPeriods) {
      setBranchTimelineData(Array.isArray(cached.data) ? cached.data : []);
      setTimelineMeta(cached.meta ?? { min_date: null, max_date: null });
      setHasMoreHistory(cached.hasMoreHistory ?? true);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    loadTimelineChunk({ mode: 'replace', signal: controller.signal });
    return () => controller.abort();
  }, [cacheKey, loadingBranches, loadTimelineChunk, selectedBranch, totalPeriods]);

  // IF NOT OWNER, RETURN NULL (COMPONENT WON'T RENDER)
  if (!isOwner) return null;

  const selectedBranchName = useMemo(() => {
    if (!selectedBranch) return 'Branch 1';
    const match = allBranches?.find(
      (b) => String(b.branch_id) === String(selectedBranch)
    );
    if (match?.branch_name) return match.branch_name;
    if (selectedBranch) return `Branch ${selectedBranch}`;
    return 'Branch 1';
  }, [allBranches, selectedBranch]);

  const hasTimelineData = branchTimelineData.length > 0;
  const shouldShowChart = selectedBranch && hasTimelineData && !loading && !error;

  // Pagination helpers
  const windowSize = TIMELINE_WINDOW_SIZES[timelineInterval] || TIMELINE_WINDOW_SIZES.monthly;
  const windowLabel = useMemo(() => {
    if (timelineInterval === 'yearly') return `${totalPeriods} years`;
    if (timelineInterval === 'weekly') return `${totalPeriods} weeks`;
    if (timelineInterval === 'daily') return `${totalPeriods} days`;
    return `${totalPeriods} months`;
  }, [timelineInterval, totalPeriods]);

  const rangeLabel = useMemo(() => {
    if (!branchTimelineData.length) return '';
    const first = branchTimelineData[0]?.formatted_period || '';
    const last = branchTimelineData[branchTimelineData.length - 1]?.formatted_period || '';
    return first && last ? `${first} - ${last}` : '';
  }, [branchTimelineData]);

  const canLoadOlder = useMemo(() => {
    if (loading) return false;
    if (!hasMoreHistory) return false;
    if (!branchTimelineData.length) return false;
    return true;
  }, [branchTimelineData, hasMoreHistory, loading]);

  const hasExtendedRange = totalPeriods > windowSize;

  const handleLoadOlder = useCallback(() => {
    if (loading || !canLoadOlder) return;
    setTotalPeriods(prev => prev + windowSize);
  }, [canLoadOlder, loading, windowSize]);

  const handleResetRange = useCallback(() => {
    if (loading) return;
    setTotalPeriods(windowSize);
  }, [loading, windowSize]);

  return (
    <>
      {/* BRANCH TIMELINE CHART */}
      <Card title={`BRANCH SALES TIMELINE - ${selectedBranchName.toUpperCase()}`} 
      className="col-span-full h-[calc(100vh-260px)] min-h-[420px]"
      exportRef={branchTimelineRef}>

        <div className="flex flex-col h-full overflow-hidden relative">
          {loading && <ChartLoading message="Loading branch timeline..." />}
          {error && !loading && (
            <ChartNoData
              message={error}
              hint="Please try selecting a different branch or refresh the page."
            />
          )}
          
          {/* CONTROLS */}
          <div data-export-exclude className="flex flex-col gap-3 mb-4">
            {/* Dropdowns Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3 justify-end">
              {/* BRANCH SELECTOR */}
              <div className="w-full sm:w-[260px]">
                <DropdownCustom
                  label="Branch"
                  value={selectedBranch}
                  labelClassName="text-[11px]"
                  onChange={e => updateSelectedBranch(e.target.value)}
                  options={
                    loadingBranches
                      ? [{
                          value: selectedBranch || '1',
                          label: `Branch ${selectedBranch || '1'} (Loading...)`
                        }]
                      : (Array.isArray(allBranches) && allBranches.length > 0
                          ? allBranches.map((b) => ({
                              value: String(b.branch_id),
                              label: b.branch_name
                            }))
                          : [{ value: '', label: 'No branches available' }]
                        )
                  }
                  variant="simple"
                  size="xs"
                  disabled={loadingBranches || !allBranches.length}
                />
              </div>

              {/* INTERVAL SELECTOR */}
              <div className="w-full sm:w-[160px]">
                <DropdownCustom
                  label="Interval"
                  value={timelineInterval}
                  labelClassName="text-[11px]"
                  onChange={e => setTimelineInterval(e.target.value)}
                  options={[
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                  variant="simple"
                  size="xs"
                />
              </div>
            </div>

            {/* Pagination Info & Controls */}
            {selectedBranch && hasTimelineData && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-2 py-1.5 bg-gray-50 rounded border border-gray-200">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-gray-700">{rangeLabel}</span>
                  <span className="text-[10px] text-gray-500">Window size: {windowLabel}</span>
                </div>
                <div className="flex gap-2">
                  {(hasExtendedRange || (!hasMoreHistory && branchTimelineData.length > 0)) && (
                    <button
                      onClick={handleResetRange}
                      disabled={loading}
                      className="px-3 py-1.5 text-[11px] font-medium text-blue-600 bg-white border border-blue-200 rounded hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Back to Latest
                    </button>
                  )}
                  <button
                    onClick={handleLoadOlder}
                    disabled={!canLoadOlder}
                    className="px-3 py-1.5 text-[11px] font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {loading ? 'Loading...' : 'Load Older Data'}
                  </button>
                </div>
              </div>
            )}
          </div>


          {/* CHART AREA */}
          {!selectedBranch && !loading && !error && !loadingBranches && (
            <ChartNoData
              message="No branches available to display timeline."
              hint="PLEASE ADD BRANCHES TO YOUR SYSTEM."
            />
          )}
          
          {selectedBranch && !loading && !error && !hasTimelineData && (
            <ChartNoData
              message="No sales timeline data for the selected branch and filters."
              hint="TRY SELECTING A DIFFERENT BRANCH OR ADJUSTING FILTERS."
            />
          )}

          {shouldShowChart && (
            <div className="flex-1 min-h-0 max-h-full overflow-hidden" data-chart-container="branch-timeline">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={branchTimelineData}
                  margin={{ top: 10, right: 15, left: 0, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="formatted_period" 
                    tick={{ fontSize: 10 }} 
                    axisLine={false} 
                    tickLine={false}
                  />
                  {(() => {
                    const maxSales = branchTimelineData.reduce((m,p) => Math.max(m, Number(p.sales_amount)||0), 0);
                    const maxUnits = branchTimelineData.reduce((m,p) => Math.max(m, Number(p.units_sold)||0), 0);
                    const overallMax = Math.max(maxSales, maxUnits);
                    
                    if (overallMax <= 0) return <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 1]} />;
                    
                    const target = Math.ceil(overallMax * 1.15); 
                    const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
                    const padded = Math.ceil(target / magnitude) * magnitude;
                    
                    return <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, padded]} />;
                  })()}
                  <Tooltip 
                    labelFormatter={(label) => {
                      // Simple date formatting based on interval
                      if (timelineInterval === 'daily') {
                        return `Date: ${label}`;
                      } else if (timelineInterval === 'weekly') {
                        return `Week of: ${label}`;
                      } else {
                        return `Month: ${label}`;
                      }
                    }}
                    formatter={(value, name) => {
                      if (name === 'Sales Amount') {
                        return [currencyFormat(value), 'Sales Amount (Net Vat)'];
                      } else if (name === 'Units Sold') {
                        return [`${value} units`, 'Units Sold'];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={24} 
                    wrapperStyle={{ fontSize: 10 }}
                    payload={[
                      { value: 'Sales Amount', type: 'rect', color: '#0f766e' },
                      { value: 'Units Sold', type: 'rect', color: '#0891b2' }
                    ]}
                  />
                  
                  <Bar 
                    dataKey="sales_amount" 
                    name="Sales Amount"
                    fill="#0f766e" 
                    radius={[4,4,0,0]}
                  />
                  <Bar 
                    dataKey="units_sold" 
                    name="Units Sold"
                    fill="#0891b2" 
                    radius={[4,4,0,0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

export default BranchTimeline;
