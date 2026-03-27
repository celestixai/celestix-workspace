import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface ReportGroup {
  name: string;
  totalMinutes: number;
  billableMinutes: number;
  entries: any[];
}

interface Report {
  groups: ReportGroup[];
  totalMinutes: number;
  totalBillable: number;
}

interface ReportSummary {
  totalTracked: number;
  totalBillable: number;
  totalNonBillable: number;
  byUser: Array<{ name: string; minutes: number }>;
}

interface TimesheetDay {
  date: string;
  dayName: string;
  entries: Array<{
    id: string;
    taskId: string;
    taskTitle: string;
    minutes: number;
    note: string | null;
    isBillable: boolean;
  }>;
  totalMinutes: number;
}

interface Timesheet {
  days: TimesheetDay[];
  weekTotal: number;
}

interface BillingReport {
  totalBillable: number;
  totalAmount: number;
  byUser: Array<{ name: string; hours: number; rate: number; amount: number }>;
  entries: any[];
}

export function useReport(startDate: string, endDate: string, groupBy: string) {
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await api.get('/time-tracking/report', {
        params: { startDate, endDate, groupBy },
      });
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, groupBy]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useReportSummary(startDate: string, endDate: string) {
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await api.get('/time-tracking/report/summary', {
        params: { startDate, endDate },
      });
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useDetailedReport(startDate: string, endDate: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await api.get('/time-tracking/report/detailed', {
        params: { startDate, endDate },
      });
      setData(res.data.data);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useTimesheet(userId: string | undefined, weekStart: string) {
  const [data, setData] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!weekStart) return;
    setLoading(true);
    try {
      const params: any = { weekStart };
      if (userId) params.userId = userId;
      const res = await api.get('/time-tracking/timesheet', { params });
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useBillingReport(startDate: string, endDate: string) {
  const [data, setData] = useState<BillingReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await api.get('/time-tracking/report/billing', {
        params: { startDate, endDate },
      });
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export async function addTimesheetEntry(body: {
  taskId: string;
  date: string;
  minutes: number;
  note?: string;
  isBillable?: boolean;
}) {
  const res = await api.post('/time-tracking/timesheet/entry', body);
  return res.data.data;
}

export async function updateTimesheetEntry(entryId: string, body: { minutes: number; note?: string }) {
  const res = await api.patch(`/time-tracking/timesheet/entry/${entryId}`, body);
  return res.data.data;
}

export async function exportReportCsv(startDate: string, endDate: string) {
  const res = await api.get('/time-tracking/report/export', {
    params: { startDate, endDate },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `time-report-${startDate}-${endDate}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function setBillableRates(body: {
  workspaceId?: string;
  defaultRate: number;
  userRates?: Array<{ userId: string; rate: number }>;
}) {
  const res = await api.put('/time-tracking/settings/billable-rates', body);
  return res.data.data;
}
