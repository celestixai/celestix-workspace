import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateCalendarInput,
  UpdateCalendarInput,
  ShareCalendarInput,
  CreateEventInput,
  UpdateEventInput,
  RSVPInput,
  CreateReminderInput,
  EventsQueryInput,
  ConflictQueryInput,
} from './calendar.schema';

// ==========================================
// RRULE PARSER & OCCURRENCE EXPANDER
// ==========================================

interface ParsedRRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  until?: Date;
  byday?: string[];
}

function parseRRule(rrule: string): ParsedRRule {
  const parts = rrule.replace(/^RRULE:/, '').split(';');
  const map: Record<string, string> = {};
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value) {
      map[key.toUpperCase()] = value;
    }
  }

  const freq = map['FREQ'] as ParsedRRule['freq'];
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) {
    throw new AppError(400, `Invalid RRULE frequency: ${map['FREQ']}`, 'INVALID_RRULE');
  }

  const interval = map['INTERVAL'] ? parseInt(map['INTERVAL'], 10) : 1;
  const count = map['COUNT'] ? parseInt(map['COUNT'], 10) : undefined;
  const until = map['UNTIL'] ? parseRRuleDate(map['UNTIL']) : undefined;
  const byday = map['BYDAY'] ? map['BYDAY'].split(',') : undefined;

  return { freq, interval, count, until, byday };
}

function parseRRuleDate(dateStr: string): Date {
  // Handles YYYYMMDD and YYYYMMDDTHHmmssZ formats
  if (dateStr.length === 8) {
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    return new Date(`${y}-${m}-${d}T00:00:00Z`);
  }
  const y = dateStr.substring(0, 4);
  const m = dateStr.substring(4, 6);
  const d = dateStr.substring(6, 8);
  const hh = dateStr.substring(9, 11);
  const mm = dateStr.substring(11, 13);
  const ss = dateStr.substring(13, 15);
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
}

const DAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function advanceDate(date: Date, freq: ParsedRRule['freq'], interval: number): Date {
  const next = new Date(date);
  switch (freq) {
    case 'DAILY':
      next.setUTCDate(next.getUTCDate() + interval);
      break;
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + 7 * interval);
      break;
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + interval);
      break;
    case 'YEARLY':
      next.setUTCFullYear(next.getUTCFullYear() + interval);
      break;
  }
  return next;
}

interface ExpandedOccurrence {
  originalEventId: string;
  occurrenceIndex: number;
  startAt: Date;
  endAt: Date;
}

function expandRecurrences(
  eventId: string,
  startAt: Date,
  endAt: Date,
  rruleStr: string,
  rangeStart: Date,
  rangeEnd: Date,
  maxOccurrences = 730 // safety cap: ~2 years of daily events
): ExpandedOccurrence[] {
  const rule = parseRRule(rruleStr);
  const duration = endAt.getTime() - startAt.getTime();
  const occurrences: ExpandedOccurrence[] = [];

  let current = new Date(startAt);
  let index = 0;

  while (index < maxOccurrences) {
    // Check end conditions
    if (rule.count !== undefined && index >= rule.count) break;
    if (rule.until && current > rule.until) break;

    const occEnd = new Date(current.getTime() + duration);

    // Check if this occurrence overlaps with the query range
    if (occEnd > rangeStart && current < rangeEnd) {
      if (rule.freq === 'WEEKLY' && rule.byday && rule.byday.length > 0) {
        // For WEEKLY with BYDAY, expand each specified day within the week
        const weekStart = new Date(current);
        const currentDayOfWeek = weekStart.getUTCDay();
        for (const dayStr of rule.byday) {
          const targetDay = DAY_MAP[dayStr.toUpperCase()];
          if (targetDay === undefined) continue;
          const diff = targetDay - currentDayOfWeek;
          const dayDate = new Date(weekStart);
          dayDate.setUTCDate(dayDate.getUTCDate() + diff);
          const dayEnd = new Date(dayDate.getTime() + duration);

          if (dayDate >= startAt && dayEnd > rangeStart && dayDate < rangeEnd) {
            if (rule.until && dayDate > rule.until) continue;
            occurrences.push({
              originalEventId: eventId,
              occurrenceIndex: index,
              startAt: dayDate,
              endAt: dayEnd,
            });
          }
        }
      } else {
        occurrences.push({
          originalEventId: eventId,
          occurrenceIndex: index,
          startAt: new Date(current),
          endAt: occEnd,
        });
      }
    }

    // If we've already passed the range end, no more relevant occurrences
    if (current > rangeEnd) break;

    current = advanceDate(current, rule.freq, rule.interval);
    index++;
  }

  return occurrences;
}

// ==========================================
// MEETING LINK GENERATOR
// ==========================================

function generateMeetingLink(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `meet://${seg(3)}-${seg(4)}-${seg(3)}`;
}

// ==========================================
// CALENDAR SERVICE
// ==========================================

export class CalendarService {
  // ------------------------------------------
  // CALENDAR CRUD
  // ------------------------------------------

  async createCalendar(userId: string, input: CreateCalendarInput) {
    const calendar = await prisma.calendar.create({
      data: {
        userId,
        name: input.name,
        color: input.color,
        isVisible: input.isVisible,
      },
    });
    return calendar;
  }

  async getCalendars(userId: string) {
    const owned = await prisma.calendar.findMany({
      where: { userId },
      include: {
        shares: {
          select: {
            id: true,
            userId: true,
            permission: true,
          },
        },
        _count: { select: { events: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    // Also get calendars shared with this user
    const shared = await prisma.calendarShare.findMany({
      where: { userId },
      include: {
        calendar: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
            _count: { select: { events: true } },
          },
        },
      },
    });

    return {
      owned,
      shared: shared.map((s) => ({
        ...s.calendar,
        sharePermission: s.permission,
        shareId: s.id,
      })),
    };
  }

  async getCalendar(userId: string, calendarId: string) {
    const calendar = await prisma.calendar.findUnique({
      where: { id: calendarId },
      include: {
        shares: {
          select: {
            id: true,
            userId: true,
            permission: true,
          },
        },
        _count: { select: { events: true } },
      },
    });

    if (!calendar) {
      throw new AppError(404, 'Calendar not found', 'NOT_FOUND');
    }

    // Check access: owner or shared
    if (calendar.userId !== userId) {
      const share = await prisma.calendarShare.findUnique({
        where: { calendarId_userId: { calendarId, userId } },
      });
      if (!share) {
        throw new AppError(403, 'You do not have access to this calendar', 'FORBIDDEN');
      }
    }

    return calendar;
  }

  async updateCalendar(userId: string, calendarId: string, input: UpdateCalendarInput) {
    const calendar = await prisma.calendar.findUnique({ where: { id: calendarId } });
    if (!calendar) {
      throw new AppError(404, 'Calendar not found', 'NOT_FOUND');
    }
    if (calendar.userId !== userId) {
      throw new AppError(403, 'Only the calendar owner can update it', 'FORBIDDEN');
    }

    return prisma.calendar.update({
      where: { id: calendarId },
      data: input,
    });
  }

  async deleteCalendar(userId: string, calendarId: string) {
    const calendar = await prisma.calendar.findUnique({ where: { id: calendarId } });
    if (!calendar) {
      throw new AppError(404, 'Calendar not found', 'NOT_FOUND');
    }
    if (calendar.userId !== userId) {
      throw new AppError(403, 'Only the calendar owner can delete it', 'FORBIDDEN');
    }
    if (calendar.isDefault) {
      throw new AppError(400, 'Cannot delete the default calendar', 'CANNOT_DELETE_DEFAULT');
    }

    await prisma.calendar.delete({ where: { id: calendarId } });
  }

  // ------------------------------------------
  // CALENDAR SHARING
  // ------------------------------------------

  async shareCalendar(userId: string, calendarId: string, input: ShareCalendarInput) {
    const calendar = await prisma.calendar.findUnique({ where: { id: calendarId } });
    if (!calendar) {
      throw new AppError(404, 'Calendar not found', 'NOT_FOUND');
    }
    if (calendar.userId !== userId) {
      throw new AppError(403, 'Only the calendar owner can share it', 'FORBIDDEN');
    }
    if (input.userId === userId) {
      throw new AppError(400, 'Cannot share a calendar with yourself', 'INVALID_INPUT');
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: input.userId, deletedAt: null },
      select: { id: true },
    });
    if (!targetUser) {
      throw new AppError(404, 'Target user not found', 'USER_NOT_FOUND');
    }

    const share = await prisma.calendarShare.upsert({
      where: { calendarId_userId: { calendarId, userId: input.userId } },
      create: {
        calendarId,
        userId: input.userId,
        permission: input.permission,
      },
      update: {
        permission: input.permission,
      },
    });

    return share;
  }

  async updateShare(userId: string, shareId: string, permission: 'VIEW' | 'EDIT') {
    const share = await prisma.calendarShare.findUnique({
      where: { id: shareId },
      include: { calendar: { select: { userId: true } } },
    });
    if (!share) {
      throw new AppError(404, 'Share not found', 'NOT_FOUND');
    }
    if (share.calendar.userId !== userId) {
      throw new AppError(403, 'Only the calendar owner can update shares', 'FORBIDDEN');
    }

    return prisma.calendarShare.update({
      where: { id: shareId },
      data: { permission },
    });
  }

  async removeShare(userId: string, shareId: string) {
    const share = await prisma.calendarShare.findUnique({
      where: { id: shareId },
      include: { calendar: { select: { userId: true } } },
    });
    if (!share) {
      throw new AppError(404, 'Share not found', 'NOT_FOUND');
    }
    // Owner can remove shares, or the shared-with user can remove their own access
    if (share.calendar.userId !== userId && share.userId !== userId) {
      throw new AppError(403, 'Not authorized to remove this share', 'FORBIDDEN');
    }

    await prisma.calendarShare.delete({ where: { id: shareId } });
  }

  // ------------------------------------------
  // EVENT CRUD
  // ------------------------------------------

  async createEvent(userId: string, input: CreateEventInput) {
    // Verify calendar access (owner or EDIT share)
    await this.assertCalendarWriteAccess(userId, input.calendarId);

    const meetingLink = input.generateMeetingLink ? generateMeetingLink() : null;

    const event = await prisma.calendarEvent.create({
      data: {
        calendarId: input.calendarId,
        title: input.title,
        description: input.description ?? null,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        allDay: input.allDay,
        location: input.location ?? null,
        color: input.color ?? null,
        recurrenceRule: input.recurrenceRule ?? null,
        busyStatus: input.busyStatus,
        meetingLink,
        createdById: userId,
        attendees: {
          create: input.attendees.map((a) => ({
            userId: a.userId,
            email: a.email ?? null,
            rsvpStatus: 'NO_RESPONSE',
          })),
        },
        reminders: {
          create: input.reminders.map((r) => ({
            remindAt: new Date(new Date(input.startAt).getTime() - r.minutesBefore * 60 * 1000),
            type: r.type,
          })),
        },
      },
      include: {
        attendees: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
          },
        },
        reminders: true,
        calendar: { select: { id: true, name: true, color: true, userId: true } },
      },
    });

    return event;
  }

  async getEvent(userId: string, eventId: string) {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: {
        attendees: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
          },
        },
        reminders: true,
        calendar: {
          select: { id: true, name: true, color: true, userId: true },
        },
      },
    });

    if (!event) {
      throw new AppError(404, 'Event not found', 'NOT_FOUND');
    }

    await this.assertCalendarReadAccess(userId, event.calendarId);

    return event;
  }

  async updateEvent(userId: string, eventId: string, input: UpdateEventInput) {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: { calendar: { select: { userId: true } } },
    });
    if (!event) {
      throw new AppError(404, 'Event not found', 'NOT_FOUND');
    }

    await this.assertCalendarWriteAccess(userId, event.calendarId);

    // If moving to a different calendar, verify write access there too
    if (input.calendarId && input.calendarId !== event.calendarId) {
      await this.assertCalendarWriteAccess(userId, input.calendarId);
    }

    // Build update data (exclude attendees and reminders from the main update)
    const { attendees, reminders, ...eventData } = input;
    const updateData: Record<string, unknown> = {};

    if (eventData.calendarId !== undefined) updateData.calendarId = eventData.calendarId;
    if (eventData.title !== undefined) updateData.title = eventData.title;
    if (eventData.description !== undefined) updateData.description = eventData.description;
    if (eventData.startAt !== undefined) updateData.startAt = new Date(eventData.startAt);
    if (eventData.endAt !== undefined) updateData.endAt = new Date(eventData.endAt);
    if (eventData.allDay !== undefined) updateData.allDay = eventData.allDay;
    if (eventData.location !== undefined) updateData.location = eventData.location;
    if (eventData.color !== undefined) updateData.color = eventData.color;
    if (eventData.recurrenceRule !== undefined) updateData.recurrenceRule = eventData.recurrenceRule;
    if (eventData.busyStatus !== undefined) updateData.busyStatus = eventData.busyStatus;
    if (eventData.meetingLink !== undefined) updateData.meetingLink = eventData.meetingLink;

    const updated = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: updateData,
      include: {
        attendees: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
          },
        },
        reminders: true,
        calendar: { select: { id: true, name: true, color: true, userId: true } },
      },
    });

    // Replace attendees if provided
    if (attendees !== undefined) {
      await prisma.eventAttendee.deleteMany({ where: { eventId } });
      if (attendees.length > 0) {
        await prisma.eventAttendee.createMany({
          data: attendees.map((a) => ({
            eventId,
            userId: a.userId,
            email: a.email ?? null,
            rsvpStatus: 'NO_RESPONSE',
          })),
        });
      }
    }

    // Replace reminders if provided
    if (reminders !== undefined) {
      await prisma.eventReminder.deleteMany({ where: { eventId } });
      const effectiveStart = input.startAt ? new Date(input.startAt) : event.startAt;
      if (reminders.length > 0) {
        await prisma.eventReminder.createMany({
          data: reminders.map((r) => ({
            eventId,
            remindAt: new Date(effectiveStart.getTime() - r.minutesBefore * 60 * 1000),
            type: r.type,
          })),
        });
      }
    }

    // Re-fetch if attendees or reminders were changed
    if (attendees !== undefined || reminders !== undefined) {
      return prisma.calendarEvent.findUnique({
        where: { id: eventId },
        include: {
          attendees: {
            include: {
              user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
            },
          },
          reminders: true,
          calendar: { select: { id: true, name: true, color: true, userId: true } },
        },
      });
    }

    return updated;
  }

  async deleteEvent(userId: string, eventId: string) {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { calendarId: true },
    });
    if (!event) {
      throw new AppError(404, 'Event not found', 'NOT_FOUND');
    }

    await this.assertCalendarWriteAccess(userId, event.calendarId);

    await prisma.calendarEvent.delete({ where: { id: eventId } });
  }

  // ------------------------------------------
  // ATTENDEES & RSVP
  // ------------------------------------------

  async addAttendee(userId: string, eventId: string, attendeeUserId: string, email?: string) {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { calendarId: true },
    });
    if (!event) {
      throw new AppError(404, 'Event not found', 'NOT_FOUND');
    }

    await this.assertCalendarWriteAccess(userId, event.calendarId);

    return prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId, userId: attendeeUserId } },
      create: {
        eventId,
        userId: attendeeUserId,
        email: email ?? null,
        rsvpStatus: 'NO_RESPONSE',
      },
      update: {},
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
      },
    });
  }

  async removeAttendee(userId: string, eventId: string, attendeeUserId: string) {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { calendarId: true },
    });
    if (!event) {
      throw new AppError(404, 'Event not found', 'NOT_FOUND');
    }

    await this.assertCalendarWriteAccess(userId, event.calendarId);

    await prisma.eventAttendee.delete({
      where: { eventId_userId: { eventId, userId: attendeeUserId } },
    });
  }

  async rsvp(userId: string, eventId: string, input: RSVPInput) {
    // User must be an attendee
    const attendee = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!attendee) {
      throw new AppError(404, 'You are not an attendee of this event', 'NOT_ATTENDEE');
    }

    return prisma.eventAttendee.update({
      where: { id: attendee.id },
      data: { rsvpStatus: input.status },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
      },
    });
  }

  // ------------------------------------------
  // REMINDERS
  // ------------------------------------------

  async addReminder(userId: string, eventId: string, input: CreateReminderInput) {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { calendarId: true, startAt: true },
    });
    if (!event) {
      throw new AppError(404, 'Event not found', 'NOT_FOUND');
    }

    await this.assertCalendarWriteAccess(userId, event.calendarId);

    return prisma.eventReminder.create({
      data: {
        eventId,
        remindAt: new Date(event.startAt.getTime() - input.minutesBefore * 60 * 1000),
        type: input.type,
      },
    });
  }

  async removeReminder(userId: string, reminderId: string) {
    const reminder = await prisma.eventReminder.findUnique({
      where: { id: reminderId },
      include: { event: { select: { calendarId: true } } },
    });
    if (!reminder) {
      throw new AppError(404, 'Reminder not found', 'NOT_FOUND');
    }

    await this.assertCalendarWriteAccess(userId, reminder.event.calendarId);

    await prisma.eventReminder.delete({ where: { id: reminderId } });
  }

  // ------------------------------------------
  // EVENTS QUERY (DATE RANGE + RECURRENCE)
  // ------------------------------------------

  async getEventsForRange(userId: string, query: EventsQueryInput) {
    const { start, end, calendarIds, includeShared } = query;

    // Build list of accessible calendar IDs
    const ownedCalendars = await prisma.calendar.findMany({
      where: {
        userId,
        ...(calendarIds ? { id: { in: calendarIds } } : {}),
      },
      select: { id: true, isVisible: true },
    });

    let sharedCalendarIds: string[] = [];
    if (includeShared) {
      const shares = await prisma.calendarShare.findMany({
        where: {
          userId,
          ...(calendarIds ? { calendarId: { in: calendarIds } } : {}),
        },
        include: {
          calendar: { select: { id: true, isVisible: true } },
        },
      });
      sharedCalendarIds = shares.map((s) => s.calendar.id);
    }

    const visibleOwnedIds = ownedCalendars
      .filter((c) => c.isVisible)
      .map((c) => c.id);

    const accessibleCalendarIds = [...visibleOwnedIds, ...sharedCalendarIds];

    if (accessibleCalendarIds.length === 0) {
      return [];
    }

    // Fetch non-recurring events that fall in range
    const nonRecurringEvents = await prisma.calendarEvent.findMany({
      where: {
        calendarId: { in: accessibleCalendarIds },
        recurrenceRule: null,
        startAt: { lt: end },
        endAt: { gt: start },
      },
      include: {
        attendees: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
          },
        },
        reminders: true,
        calendar: { select: { id: true, name: true, color: true, userId: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    // Fetch recurring events that might have occurrences in range
    // A recurring event is relevant if its start is before range end
    const recurringEvents = await prisma.calendarEvent.findMany({
      where: {
        calendarId: { in: accessibleCalendarIds },
        recurrenceRule: { not: null },
        startAt: { lt: end },
      },
      include: {
        attendees: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
          },
        },
        reminders: true,
        calendar: { select: { id: true, name: true, color: true, userId: true } },
      },
    });

    // Expand recurring events into individual occurrences
    const expandedEvents: Array<typeof nonRecurringEvents[0] & { isRecurrenceInstance?: boolean; occurrenceStart?: Date; occurrenceEnd?: Date }> = [];

    for (const event of recurringEvents) {
      if (!event.recurrenceRule) continue;

      const occurrences = expandRecurrences(
        event.id,
        event.startAt,
        event.endAt,
        event.recurrenceRule,
        start,
        end
      );

      for (const occ of occurrences) {
        expandedEvents.push({
          ...event,
          isRecurrenceInstance: true,
          occurrenceStart: occ.startAt,
          occurrenceEnd: occ.endAt,
          // Override startAt/endAt for this occurrence's display
          startAt: occ.startAt,
          endAt: occ.endAt,
        });
      }
    }

    // Combine and sort by startAt
    const allEvents = [...nonRecurringEvents, ...expandedEvents];
    allEvents.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    return allEvents;
  }

  // ------------------------------------------
  // CONFLICT DETECTION
  // ------------------------------------------

  async detectConflicts(userId: string, query: ConflictQueryInput) {
    const start = new Date(query.start);
    const end = new Date(query.end);

    // Get all calendars the user owns
    const calendars = await prisma.calendar.findMany({
      where: { userId },
      select: { id: true },
    });
    const calendarIds = calendars.map((c) => c.id);

    if (calendarIds.length === 0) return [];

    const where: Record<string, unknown> = {
      calendarId: { in: calendarIds },
      busyStatus: { in: ['BUSY', 'OUT_OF_OFFICE'] },
      startAt: { lt: end },
      endAt: { gt: start },
    };

    if (query.excludeEventId) {
      where.id = { not: query.excludeEventId };
    }

    const conflicts = await prisma.calendarEvent.findMany({
      where,
      include: {
        calendar: { select: { id: true, name: true, color: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    return conflicts;
  }

  // ------------------------------------------
  // VIEW DATA HELPERS
  // ------------------------------------------

  async getDayView(userId: string, date: Date) {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return this.getEventsForRange(userId, {
      start,
      end,
      calendarIds: undefined,
      includeShared: true,
    });
  }

  async getWeekView(userId: string, date: Date) {
    const start = new Date(date);
    const dayOfWeek = start.getUTCDay();
    start.setUTCDate(start.getUTCDate() - dayOfWeek);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const events = await this.getEventsForRange(userId, {
      start,
      end,
      calendarIds: undefined,
      includeShared: true,
    });

    // Group events by day of week
    const days: Record<string, typeof events> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      days[d.toISOString().slice(0, 10)] = [];
    }

    for (const event of events) {
      const key = event.startAt.toISOString().slice(0, 10);
      if (days[key]) {
        days[key].push(event);
      } else {
        // Event spans multiple days or starts before the week
        const eventDateKey = event.startAt < start
          ? start.toISOString().slice(0, 10)
          : key;
        if (days[eventDateKey]) {
          days[eventDateKey].push(event);
        }
      }
    }

    return { start, end, days };
  }

  async getMonthView(userId: string, year: number, month: number) {
    // month is 1-based (January = 1)
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const events = await this.getEventsForRange(userId, {
      start,
      end,
      calendarIds: undefined,
      includeShared: true,
    });

    // Group events by date
    const days: Record<string, typeof events> = {};
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days[dateStr] = [];
    }

    for (const event of events) {
      const key = event.startAt.toISOString().slice(0, 10);
      if (days[key]) {
        days[key].push(event);
      }
    }

    return { year, month, start, end, days };
  }

  // ------------------------------------------
  // BUSY/FREE LOOKUP
  // ------------------------------------------

  async getBusyFreeStatus(userId: string, targetUserId: string, start: Date, end: Date) {
    // Get calendars of the target user
    const calendars = await prisma.calendar.findMany({
      where: { userId: targetUserId },
      select: { id: true },
    });
    const calendarIds = calendars.map((c) => c.id);

    if (calendarIds.length === 0) return [];

    const events = await prisma.calendarEvent.findMany({
      where: {
        calendarId: { in: calendarIds },
        startAt: { lt: end },
        endAt: { gt: start },
      },
      select: {
        startAt: true,
        endAt: true,
        busyStatus: true,
        allDay: true,
      },
      orderBy: { startAt: 'asc' },
    });

    return events.map((e) => ({
      start: e.startAt,
      end: e.endAt,
      status: e.busyStatus,
      allDay: e.allDay,
    }));
  }

  // ------------------------------------------
  // ACCESS CONTROL HELPERS
  // ------------------------------------------

  private async assertCalendarReadAccess(userId: string, calendarId: string) {
    const calendar = await prisma.calendar.findUnique({
      where: { id: calendarId },
      select: { userId: true },
    });
    if (!calendar) {
      throw new AppError(404, 'Calendar not found', 'NOT_FOUND');
    }
    if (calendar.userId === userId) return;

    const share = await prisma.calendarShare.findUnique({
      where: { calendarId_userId: { calendarId, userId } },
    });
    if (!share) {
      throw new AppError(403, 'You do not have access to this calendar', 'FORBIDDEN');
    }
  }

  private async assertCalendarWriteAccess(userId: string, calendarId: string) {
    const calendar = await prisma.calendar.findUnique({
      where: { id: calendarId },
      select: { userId: true },
    });
    if (!calendar) {
      throw new AppError(404, 'Calendar not found', 'NOT_FOUND');
    }
    if (calendar.userId === userId) return;

    const share = await prisma.calendarShare.findUnique({
      where: { calendarId_userId: { calendarId, userId } },
    });
    if (!share || share.permission !== 'EDIT') {
      throw new AppError(403, 'You do not have edit access to this calendar', 'FORBIDDEN');
    }
  }
}

export const calendarService = new CalendarService();
