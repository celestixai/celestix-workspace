import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import crypto from 'crypto';

export class BookingsService {
  // ─── Booking Pages ───────────────────────────────────────────────

  async createPage(userId: string, data: Record<string, unknown>) {
    // Check slug uniqueness
    const existing = await prisma.bookingPage.findUnique({
      where: { slug: data.slug as string },
    });
    if (existing) {
      throw new AppError(409, 'Slug is already taken', 'SLUG_CONFLICT');
    }

    return prisma.bookingPage.create({
      data: {
        userId,
        name: data.name as string,
        slug: data.slug as string,
        type: (data.type as string) || 'PERSONAL',
        description: data.description as string | undefined,
        branding: data.branding as Record<string, unknown> | undefined,
        settings: data.settings as Record<string, unknown> | undefined,
      },
      include: {
        services: true,
      },
    });
  }

  async getMyPages(userId: string) {
    return prisma.bookingPage.findMany({
      where: { userId },
      include: {
        services: true,
        _count: { select: { appointments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPageBySlug(slug: string) {
    const page = await prisma.bookingPage.findUnique({
      where: { slug },
      include: {
        services: {
          where: { isActive: true },
          include: {
            staff: {
              include: {
                user: { select: { id: true, displayName: true, avatarUrl: true } },
              },
            },
          },
        },
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    if (!page) throw new AppError(404, 'Booking page not found', 'NOT_FOUND');
    if (!page.isActive) throw new AppError(404, 'Booking page is not active', 'NOT_FOUND');

    return page;
  }

  async updatePage(pageId: string, userId: string, data: Record<string, unknown>) {
    const page = await prisma.bookingPage.findUnique({ where: { id: pageId } });
    if (!page) throw new AppError(404, 'Booking page not found', 'NOT_FOUND');
    if (page.userId !== userId) throw new AppError(403, 'Not authorized', 'FORBIDDEN');

    // If slug is being changed, check uniqueness
    if (data.slug && data.slug !== page.slug) {
      const existing = await prisma.bookingPage.findUnique({
        where: { slug: data.slug as string },
      });
      if (existing) {
        throw new AppError(409, 'Slug is already taken', 'SLUG_CONFLICT');
      }
    }

    return prisma.bookingPage.update({
      where: { id: pageId },
      data: data as never,
      include: { services: true },
    });
  }

  async deletePage(pageId: string, userId: string) {
    const page = await prisma.bookingPage.findUnique({ where: { id: pageId } });
    if (!page) throw new AppError(404, 'Booking page not found', 'NOT_FOUND');
    if (page.userId !== userId) throw new AppError(403, 'Not authorized', 'FORBIDDEN');

    await prisma.bookingPage.delete({ where: { id: pageId } });
  }

  // ─── Services ────────────────────────────────────────────────────

  async addService(pageId: string, userId: string, data: Record<string, unknown>) {
    const page = await prisma.bookingPage.findUnique({ where: { id: pageId } });
    if (!page) throw new AppError(404, 'Booking page not found', 'NOT_FOUND');
    if (page.userId !== userId) throw new AppError(403, 'Not authorized', 'FORBIDDEN');

    return prisma.bookingService.create({
      data: {
        bookingPageId: pageId,
        name: data.name as string,
        description: data.description as string | undefined,
        durationMinutes: data.durationMinutes as number,
        bufferMinutes: (data.bufferMinutes as number) || 0,
        price: data.price as number | undefined,
        maxAttendees: (data.maxAttendees as number) || 1,
        intakeForm: data.intakeForm as unknown[] | undefined,
        staffAssignmentType: (data.staffAssignmentType as string) || 'ROUND_ROBIN',
      },
    });
  }

  async updateService(serviceId: string, userId: string, data: Record<string, unknown>) {
    const service = await prisma.bookingService.findUnique({
      where: { id: serviceId },
      include: { bookingPage: true },
    });
    if (!service) throw new AppError(404, 'Service not found', 'NOT_FOUND');
    if (service.bookingPage.userId !== userId) throw new AppError(403, 'Not authorized', 'FORBIDDEN');

    return prisma.bookingService.update({
      where: { id: serviceId },
      data: data as never,
    });
  }

  async deleteService(serviceId: string, userId: string) {
    const service = await prisma.bookingService.findUnique({
      where: { id: serviceId },
      include: { bookingPage: true },
    });
    if (!service) throw new AppError(404, 'Service not found', 'NOT_FOUND');
    if (service.bookingPage.userId !== userId) throw new AppError(403, 'Not authorized', 'FORBIDDEN');

    await prisma.bookingService.delete({ where: { id: serviceId } });
  }

  // ─── Staff ───────────────────────────────────────────────────────

  async addStaff(serviceId: string, userId: string, staffUserId: string, schedule?: Record<string, unknown>) {
    const service = await prisma.bookingService.findUnique({
      where: { id: serviceId },
      include: { bookingPage: true },
    });
    if (!service) throw new AppError(404, 'Service not found', 'NOT_FOUND');
    if (service.bookingPage.userId !== userId) throw new AppError(403, 'Not authorized', 'FORBIDDEN');

    // Check if staff is already assigned
    const existing = await prisma.bookingStaff.findFirst({
      where: { bookingServiceId: serviceId, userId: staffUserId },
    });
    if (existing) throw new AppError(409, 'Staff already assigned to this service', 'CONFLICT');

    return prisma.bookingStaff.create({
      data: {
        bookingServiceId: serviceId,
        userId: staffUserId,
        schedule: schedule || {},
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async removeStaff(serviceId: string, userId: string, staffUserId: string) {
    const service = await prisma.bookingService.findUnique({
      where: { id: serviceId },
      include: { bookingPage: true },
    });
    if (!service) throw new AppError(404, 'Service not found', 'NOT_FOUND');
    if (service.bookingPage.userId !== userId) throw new AppError(403, 'Not authorized', 'FORBIDDEN');

    const staff = await prisma.bookingStaff.findFirst({
      where: { bookingServiceId: serviceId, userId: staffUserId },
    });
    if (!staff) throw new AppError(404, 'Staff not found on this service', 'NOT_FOUND');

    await prisma.bookingStaff.delete({ where: { id: staff.id } });
  }

  // ─── Availability / Slots ───────────────────────────────────────

  async getAvailableSlots(slug: string, serviceId: string, date: string) {
    const page = await prisma.bookingPage.findUnique({
      where: { slug },
    });
    if (!page) throw new AppError(404, 'Booking page not found', 'NOT_FOUND');
    if (!page.isActive) throw new AppError(404, 'Booking page is not active', 'NOT_FOUND');

    const service = await prisma.bookingService.findUnique({
      where: { id: serviceId },
      include: { staff: true },
    });
    if (!service) throw new AppError(404, 'Service not found', 'NOT_FOUND');
    if (service.bookingPageId !== page.id) throw new AppError(400, 'Service does not belong to this page', 'BAD_REQUEST');

    const settings = (page.settings as Record<string, unknown>) || {};
    const minNoticeHours = (settings.minNoticeHours as number) || 24;
    const maxDaysAhead = (settings.maxDaysAhead as number) || 30;

    const requestedDate = new Date(date + 'T00:00:00');
    const now = new Date();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxDaysAhead);

    if (requestedDate > maxDate) {
      throw new AppError(400, 'Date is too far in the future', 'DATE_TOO_FAR');
    }

    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd = new Date(date + 'T23:59:59');

    // Get existing appointments for this service on this date
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        bookingServiceId: serviceId,
        status: { in: ['CONFIRMED', 'PENDING'] },
        startAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { startAt: 'asc' },
    });

    const durationMs = service.durationMinutes * 60 * 1000;
    const bufferMs = service.bufferMinutes * 60 * 1000;
    const slotIncrement = 15 * 60 * 1000; // 15-min increments
    const minNoticeMs = minNoticeHours * 60 * 60 * 1000;
    const earliestSlot = new Date(now.getTime() + minNoticeMs);

    const staffMembers = service.staff;
    const slots: Array<{ startAt: string; endAt: string; staffUserId?: string }> = [];

    // Generate slots for each staff member
    for (const staffMember of staffMembers) {
      const schedule = (staffMember.schedule as Record<string, unknown>) || {};
      const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'lowercase' as never }) ||
        ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][requestedDate.getDay()];
      const daySchedule = schedule[dayOfWeek] as { start?: string; end?: string } | undefined;

      // Default working hours: 9:00 - 17:00
      const workStart = daySchedule?.start || '09:00';
      const workEnd = daySchedule?.end || '17:00';

      const [startH, startM] = workStart.split(':').map(Number);
      const [endH, endM] = workEnd.split(':').map(Number);

      const windowStart = new Date(requestedDate);
      windowStart.setHours(startH, startM, 0, 0);

      const windowEnd = new Date(requestedDate);
      windowEnd.setHours(endH, endM, 0, 0);

      // Get this staff member's appointments for the day
      const staffAppointments = existingAppointments.filter(
        (a) => a.staffUserId === staffMember.userId
      );

      let cursor = windowStart.getTime();

      while (cursor + durationMs <= windowEnd.getTime()) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor + durationMs);

        // Check if slot is past min notice threshold
        if (slotStart >= earliestSlot) {
          // Check for conflicts with existing appointments
          const hasConflict = staffAppointments.some((appt) => {
            const apptStart = new Date(appt.startAt).getTime();
            const apptEnd = new Date(appt.endAt).getTime() + bufferMs;
            const proposedStart = cursor;
            const proposedEnd = cursor + durationMs + bufferMs;
            return proposedStart < apptEnd && proposedEnd > apptStart;
          });

          if (!hasConflict) {
            slots.push({
              startAt: slotStart.toISOString(),
              endAt: slotEnd.toISOString(),
              staffUserId: staffMember.userId,
            });
          }
        }

        cursor += slotIncrement;
      }
    }

    // If no staff assigned, generate generic slots based on default availability
    if (staffMembers.length === 0) {
      const defaultAvailability = settings.defaultAvailability as Record<string, unknown> | undefined;
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][requestedDate.getDay()];
      const daySchedule = defaultAvailability?.[dayOfWeek] as { start?: string; end?: string } | undefined;

      const workStart = daySchedule?.start || '09:00';
      const workEnd = daySchedule?.end || '17:00';

      const [startH, startM] = workStart.split(':').map(Number);
      const [endH, endM] = workEnd.split(':').map(Number);

      const windowStart = new Date(requestedDate);
      windowStart.setHours(startH, startM, 0, 0);

      const windowEnd = new Date(requestedDate);
      windowEnd.setHours(endH, endM, 0, 0);

      let cursor = windowStart.getTime();

      while (cursor + durationMs <= windowEnd.getTime()) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor + durationMs);

        if (slotStart >= earliestSlot) {
          const hasConflict = existingAppointments.some((appt) => {
            const apptStart = new Date(appt.startAt).getTime();
            const apptEnd = new Date(appt.endAt).getTime() + bufferMs;
            const proposedStart = cursor;
            const proposedEnd = cursor + durationMs + bufferMs;
            return proposedStart < apptEnd && proposedEnd > apptStart;
          });

          if (!hasConflict) {
            slots.push({
              startAt: slotStart.toISOString(),
              endAt: slotEnd.toISOString(),
            });
          }
        }

        cursor += slotIncrement;
      }
    }

    // Sort by start time
    slots.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    return slots;
  }

  // ─── Appointments ────────────────────────────────────────────────

  async bookAppointment(data: Record<string, unknown>) {
    const serviceId = data.serviceId as string;
    const startAt = new Date(data.startAt as string);
    const guestName = data.guestName as string;
    const guestEmail = data.guestEmail as string;
    const guestPhone = data.guestPhone as string | undefined;
    const intakeResponses = data.intakeResponses as Record<string, unknown> | undefined;
    const requestedStaffUserId = data.staffUserId as string | undefined;

    const service = await prisma.bookingService.findUnique({
      where: { id: serviceId },
      include: {
        staff: true,
        bookingPage: true,
      },
    });
    if (!service) throw new AppError(404, 'Service not found', 'NOT_FOUND');
    if (!service.bookingPage.isActive) throw new AppError(400, 'Booking page is not active', 'PAGE_INACTIVE');

    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60 * 1000);
    const bufferMs = service.bufferMinutes * 60 * 1000;

    // Verify the slot is still available
    const conflicting = await prisma.appointment.findFirst({
      where: {
        bookingServiceId: serviceId,
        status: { in: ['CONFIRMED', 'PENDING'] },
        OR: [
          {
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
        ],
        ...(requestedStaffUserId ? { staffUserId: requestedStaffUserId } : {}),
      },
    });

    if (conflicting && service.maxAttendees <= 1) {
      throw new AppError(409, 'This time slot is no longer available', 'SLOT_TAKEN');
    }

    // If maxAttendees > 1, check count
    if (service.maxAttendees > 1) {
      const overlappingCount = await prisma.appointment.count({
        where: {
          bookingServiceId: serviceId,
          status: { in: ['CONFIRMED', 'PENDING'] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      });
      if (overlappingCount >= service.maxAttendees) {
        throw new AppError(409, 'This time slot is fully booked', 'SLOT_FULL');
      }
    }

    // Assign staff
    let assignedStaffUserId: string | null = null;

    if (service.staff.length > 0) {
      const assignmentType = service.staffAssignmentType || 'ROUND_ROBIN';

      if (assignmentType === 'SPECIFIC') {
        if (!requestedStaffUserId) {
          throw new AppError(400, 'Staff selection is required for this service', 'STAFF_REQUIRED');
        }
        const validStaff = service.staff.find((s) => s.userId === requestedStaffUserId);
        if (!validStaff) {
          throw new AppError(400, 'Selected staff is not available for this service', 'INVALID_STAFF');
        }
        // Verify this specific staff member is free
        const staffConflict = await prisma.appointment.findFirst({
          where: {
            staffUserId: requestedStaffUserId,
            status: { in: ['CONFIRMED', 'PENDING'] },
            startAt: { lt: new Date(endAt.getTime() + bufferMs) },
            endAt: { gt: new Date(startAt.getTime() - bufferMs) },
          },
        });
        if (staffConflict) {
          throw new AppError(409, 'Selected staff is not available at this time', 'STAFF_UNAVAILABLE');
        }
        assignedStaffUserId = requestedStaffUserId;
      } else if (assignmentType === 'ROUND_ROBIN') {
        // Find staff with fewest upcoming appointments
        const staffIds = service.staff.map((s) => s.userId);
        const staffCounts = await Promise.all(
          staffIds.map(async (staffId) => {
            // Also check this staff member is free for the requested slot
            const conflict = await prisma.appointment.findFirst({
              where: {
                staffUserId: staffId,
                status: { in: ['CONFIRMED', 'PENDING'] },
                startAt: { lt: new Date(endAt.getTime() + bufferMs) },
                endAt: { gt: new Date(startAt.getTime() - bufferMs) },
              },
            });
            if (conflict) return { staffId, count: Infinity };

            const count = await prisma.appointment.count({
              where: {
                staffUserId: staffId,
                status: { in: ['CONFIRMED', 'PENDING'] },
                startAt: { gte: new Date() },
              },
            });
            return { staffId, count };
          })
        );

        staffCounts.sort((a, b) => a.count - b.count);
        if (staffCounts[0].count === Infinity) {
          throw new AppError(409, 'No staff available at this time', 'NO_STAFF_AVAILABLE');
        }
        assignedStaffUserId = staffCounts[0].staffId;
      } else if (assignmentType === 'RANDOM') {
        // Filter to only available staff
        const availableStaff = await Promise.all(
          service.staff.map(async (s) => {
            const conflict = await prisma.appointment.findFirst({
              where: {
                staffUserId: s.userId,
                status: { in: ['CONFIRMED', 'PENDING'] },
                startAt: { lt: new Date(endAt.getTime() + bufferMs) },
                endAt: { gt: new Date(startAt.getTime() - bufferMs) },
              },
            });
            return conflict ? null : s;
          })
        );

        const freeStaff = availableStaff.filter(Boolean);
        if (freeStaff.length === 0) {
          throw new AppError(409, 'No staff available at this time', 'NO_STAFF_AVAILABLE');
        }
        const randomIndex = Math.floor(Math.random() * freeStaff.length);
        assignedStaffUserId = freeStaff[randomIndex]!.userId;
      }
    }

    const cancelToken = crypto.randomUUID();

    const appointment = await prisma.appointment.create({
      data: {
        bookingPageId: service.bookingPageId,
        bookingServiceId: serviceId,
        staffUserId: assignedStaffUserId,
        startAt,
        endAt,
        guestName,
        guestEmail,
        guestPhone,
        intakeResponses: intakeResponses || undefined,
        cancelToken,
        status: 'CONFIRMED',
      },
      include: {
        bookingService: { select: { name: true, durationMinutes: true } },
        staff: { select: { id: true, displayName: true } },
      },
    });

    return appointment;
  }

  async cancelAppointment(cancelToken: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { cancelToken },
    });
    if (!appointment) throw new AppError(404, 'Appointment not found', 'NOT_FOUND');
    if (appointment.status === 'CANCELLED') {
      throw new AppError(400, 'Appointment is already cancelled', 'ALREADY_CANCELLED');
    }

    return prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CANCELLED' },
    });
  }

  async getMyAppointments(userId: string) {
    return prisma.appointment.findMany({
      where: { staffUserId: userId },
      include: {
        bookingService: { select: { name: true, durationMinutes: true } },
        bookingPage: { select: { name: true, slug: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async getPageAppointments(pageId: string, userId: string) {
    const page = await prisma.bookingPage.findUnique({ where: { id: pageId } });
    if (!page) throw new AppError(404, 'Booking page not found', 'NOT_FOUND');
    if (page.userId !== userId) throw new AppError(403, 'Not authorized', 'FORBIDDEN');

    return prisma.appointment.findMany({
      where: { bookingPageId: pageId },
      include: {
        bookingService: { select: { name: true, durationMinutes: true } },
        staff: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }
}

export const bookingsService = new BookingsService();
