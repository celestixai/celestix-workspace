import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateReportInput,
  UpdateReportInput,
  CreateDataSourceInput,
  UpdateDataSourceInput,
  QueryDataInput,
} from './analytics.schema';

const userSelect = { id: true, displayName: true, avatarUrl: true, email: true } as const;

export class AnalyticsService {
  // ==================================
  // REPORT CRUD
  // ==================================

  async createReport(userId: string, input: CreateReportInput) {
    const report = await prisma.analyticsReport.create({
      data: {
        userId,
        title: input.title,
        dataSourceId: input.dataSourceId,
        pages: input.pages ?? [],
        filters: input.filters ?? undefined,
        theme: input.theme ?? 'default',
        refreshSchedule: input.refreshSchedule,
        isPublic: input.isPublic ?? false,
      },
      include: {
        user: { select: userSelect },
        dataSource: true,
      },
    });

    return report;
  }

  async getReports(userId: string) {
    const reports = await prisma.analyticsReport.findMany({
      where: { userId },
      include: {
        user: { select: userSelect },
        dataSource: { select: { id: true, name: true, type: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return reports;
  }

  async getReportById(userId: string, reportId: string) {
    const report = await prisma.analyticsReport.findFirst({
      where: { id: reportId, userId },
      include: {
        user: { select: userSelect },
        dataSource: true,
      },
    });

    if (!report) {
      throw new AppError(404, 'Report not found', 'NOT_FOUND');
    }

    return report;
  }

  async updateReport(userId: string, reportId: string, input: UpdateReportInput) {
    const existing = await prisma.analyticsReport.findFirst({
      where: { id: reportId, userId },
    });
    if (!existing) {
      throw new AppError(404, 'Report not found', 'NOT_FOUND');
    }

    const report = await prisma.analyticsReport.update({
      where: { id: reportId },
      data: {
        title: input.title,
        dataSourceId: input.dataSourceId,
        pages: input.pages,
        filters: input.filters === null ? Prisma.JsonNull : input.filters,
        theme: input.theme,
        refreshSchedule: input.refreshSchedule,
        isPublic: input.isPublic,
      },
      include: {
        user: { select: userSelect },
        dataSource: true,
      },
    });

    return report;
  }

  async deleteReport(userId: string, reportId: string) {
    const existing = await prisma.analyticsReport.findFirst({
      where: { id: reportId, userId },
    });
    if (!existing) {
      throw new AppError(404, 'Report not found', 'NOT_FOUND');
    }

    await prisma.analyticsReport.delete({ where: { id: reportId } });
  }

  // ==================================
  // DATA SOURCE CRUD
  // ==================================

  async createDataSource(userId: string, input: CreateDataSourceInput) {
    const dataSource = await prisma.dataSource.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        config: input.config,
      },
      include: {
        user: { select: userSelect },
      },
    });

    return dataSource;
  }

  async getDataSources(userId: string) {
    const dataSources = await prisma.dataSource.findMany({
      where: { userId },
      include: {
        user: { select: userSelect },
        _count: { select: { reports: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return dataSources;
  }

  async getDataSourceById(userId: string, dataSourceId: string) {
    const dataSource = await prisma.dataSource.findFirst({
      where: { id: dataSourceId, userId },
      include: {
        user: { select: userSelect },
        reports: { select: { id: true, title: true } },
      },
    });

    if (!dataSource) {
      throw new AppError(404, 'Data source not found', 'NOT_FOUND');
    }

    return dataSource;
  }

  async updateDataSource(userId: string, dataSourceId: string, input: UpdateDataSourceInput) {
    const existing = await prisma.dataSource.findFirst({
      where: { id: dataSourceId, userId },
    });
    if (!existing) {
      throw new AppError(404, 'Data source not found', 'NOT_FOUND');
    }

    const dataSource = await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        name: input.name,
        type: input.type,
        config: input.config,
      },
      include: {
        user: { select: userSelect },
      },
    });

    return dataSource;
  }

  async deleteDataSource(userId: string, dataSourceId: string) {
    const existing = await prisma.dataSource.findFirst({
      where: { id: dataSourceId, userId },
    });
    if (!existing) {
      throw new AppError(404, 'Data source not found', 'NOT_FOUND');
    }

    // Check if any reports reference this data source
    const linkedReports = await prisma.analyticsReport.count({
      where: { dataSourceId },
    });
    if (linkedReports > 0) {
      throw new AppError(400, 'Cannot delete data source with linked reports', 'HAS_LINKED_REPORTS');
    }

    await prisma.dataSource.delete({ where: { id: dataSourceId } });
  }

  async refreshData(userId: string, dataSourceId: string) {
    const existing = await prisma.dataSource.findFirst({
      where: { id: dataSourceId, userId },
    });
    if (!existing) {
      throw new AppError(404, 'Data source not found', 'NOT_FOUND');
    }

    // In a real implementation, this would fetch fresh data from the configured source.
    // For now, we update the lastRefreshed timestamp.
    const dataSource = await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        lastRefreshed: new Date(),
      },
      include: {
        user: { select: userSelect },
      },
    });

    return dataSource;
  }

  // ==================================
  // QUERY DATA
  // ==================================

  async queryData(userId: string, dataSourceId: string, input: QueryDataInput) {
    const dataSource = await prisma.dataSource.findFirst({
      where: { id: dataSourceId, userId },
    });
    if (!dataSource) {
      throw new AppError(404, 'Data source not found', 'NOT_FOUND');
    }

    const cachedData = dataSource.cachedData as Record<string, unknown>[] | null;
    if (!cachedData || !Array.isArray(cachedData)) {
      return { rows: [], total: 0 };
    }

    let rows = [...cachedData];

    // Apply filters
    if (input.filters && Object.keys(input.filters).length > 0) {
      rows = rows.filter((row) => {
        return Object.entries(input.filters!).every(([key, value]) => {
          const rowValue = row[key];
          if (Array.isArray(value)) {
            return value.includes(rowValue);
          }
          return rowValue === value;
        });
      });
    }

    // Apply groupBy + aggregations
    if (input.groupBy && input.groupBy.length > 0) {
      const groups = new Map<string, Record<string, unknown>[]>();

      for (const row of rows) {
        const groupKey = input.groupBy.map((field) => String(row[field] ?? '')).join('||');
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(row);
      }

      rows = Array.from(groups.entries()).map(([_key, groupRows]) => {
        const result: Record<string, unknown> = {};

        // Include group-by fields
        for (const field of input.groupBy!) {
          result[field] = groupRows[0][field];
        }

        // Apply aggregations
        if (input.aggregations) {
          for (const agg of input.aggregations) {
            const alias = agg.alias ?? `${agg.function}_${agg.field}`;
            const values = groupRows.map((r) => Number(r[agg.field]) || 0);

            switch (agg.function) {
              case 'sum':
                result[alias] = values.reduce((a, b) => a + b, 0);
                break;
              case 'avg':
                result[alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                break;
              case 'count':
                result[alias] = groupRows.length;
                break;
              case 'min':
                result[alias] = Math.min(...values);
                break;
              case 'max':
                result[alias] = Math.max(...values);
                break;
            }
          }
        }

        return result;
      });
    }

    // Apply sorting
    if (input.sortBy) {
      const order = input.sortOrder === 'desc' ? -1 : 1;
      rows.sort((a, b) => {
        const aVal = a[input.sortBy!];
        const bVal = b[input.sortBy!];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return order;
        if (bVal == null) return -order;
        if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * order;
        return String(aVal).localeCompare(String(bVal)) * order;
      });
    }

    const total = rows.length;

    // Apply limit
    rows = rows.slice(0, input.limit ?? 1000);

    return { rows, total };
  }
}

export const analyticsService = new AnalyticsService();
