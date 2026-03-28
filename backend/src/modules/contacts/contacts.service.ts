import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type { CreateContactInput } from './contacts.schema';

export class ContactsService {
  async createContact(userId: string, input: CreateContactInput) {
    return prisma.contact.create({
      data: {
        userId,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: input.displayName,
        company: input.company,
        title: input.title,
        birthday: input.birthday ? new Date(input.birthday) : undefined,
        notes: input.notes,
        emails: input.emails ? { create: input.emails } : undefined,
        phones: input.phones ? { create: input.phones } : undefined,
        addresses: input.addresses ? { create: input.addresses } : undefined,
      },
      include: { emails: true, phones: true, addresses: true, groups: { include: { group: true } } },
    });
  }

  async getContacts(userId: string, query: {
    search?: string;
    group?: string;
    favorite?: boolean;
    letter?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Record<string, unknown> = { userId, deletedAt: null };

    if (query.favorite) where.isFavorite = true;
    if (query.group) {
      where.groups = { some: { groupId: query.group } };
    }
    if (query.letter) {
      where.displayName = { startsWith: query.letter, mode: 'insensitive' };
    }
    if (query.search) {
      where.OR = [
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { company: { contains: query.search, mode: 'insensitive' } },
        { emails: { some: { email: { contains: query.search, mode: 'insensitive' } } } },
        { phones: { some: { phone: { contains: query.search } } } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 100;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          emails: true,
          phones: true,
          groups: { include: { group: true } },
        },
        orderBy: { displayName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts,
      pagination: { total, page, limit, hasMore: page * limit < total },
    };
  }

  async getContact(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId, deletedAt: null },
      include: {
        emails: true,
        phones: true,
        addresses: true,
        groups: { include: { group: true } },
      },
    });
    if (!contact) throw new AppError(404, 'Contact not found', 'NOT_FOUND');
    return contact;
  }

  async updateContact(userId: string, contactId: string, input: Partial<CreateContactInput>) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!contact) throw new AppError(404, 'Contact not found', 'NOT_FOUND');

    // Update base fields
    const updateData: Record<string, unknown> = {};
    if (input.firstName !== undefined) updateData.firstName = input.firstName;
    if (input.lastName !== undefined) updateData.lastName = input.lastName;
    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.company !== undefined) updateData.company = input.company;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.birthday !== undefined) updateData.birthday = input.birthday ? new Date(input.birthday) : null;
    if (input.notes !== undefined) updateData.notes = input.notes;

    // Replace emails/phones/addresses if provided
    if (input.emails) {
      await prisma.contactEmail.deleteMany({ where: { contactId } });
      await prisma.contactEmail.createMany({
        data: input.emails.map((e) => ({ ...e, contactId })),
      });
    }
    if (input.phones) {
      await prisma.contactPhone.deleteMany({ where: { contactId } });
      await prisma.contactPhone.createMany({
        data: input.phones.map((p) => ({ ...p, contactId })),
      });
    }
    if (input.addresses) {
      await prisma.contactAddress.deleteMany({ where: { contactId } });
      await prisma.contactAddress.createMany({
        data: input.addresses.map((a) => ({ ...a, contactId })),
      });
    }

    return prisma.contact.update({
      where: { id: contactId },
      data: updateData,
      include: { emails: true, phones: true, addresses: true, groups: { include: { group: true } } },
    });
  }

  async deleteContact(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!contact) throw new AppError(404, 'Contact not found', 'NOT_FOUND');

    return prisma.contact.update({
      where: { id: contactId },
      data: { deletedAt: new Date() },
    });
  }

  async toggleFavorite(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!contact) throw new AppError(404, 'Contact not found', 'NOT_FOUND');

    return prisma.contact.update({
      where: { id: contactId },
      data: { isFavorite: !contact.isFavorite },
    });
  }

  // Groups
  async createGroup(userId: string, input: { name: string; color?: string }) {
    return prisma.contactGroup.create({
      data: { userId, name: input.name, color: input.color || '#4F8EF7' },
    });
  }

  async getGroups(userId: string) {
    return prisma.contactGroup.findMany({
      where: { userId },
      include: { _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async deleteGroup(userId: string, groupId: string) {
    const group = await prisma.contactGroup.findFirst({ where: { id: groupId, userId } });
    if (!group) throw new AppError(404, 'Group not found', 'NOT_FOUND');
    await prisma.contactGroup.delete({ where: { id: groupId } });
  }

  async addToGroup(userId: string, contactId: string, groupId: string) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!contact) throw new AppError(404, 'Contact not found', 'NOT_FOUND');

    return prisma.contactGroupMember.upsert({
      where: { contactId_groupId: { contactId, groupId } },
      create: { contactId, groupId },
      update: {},
    });
  }

  async removeFromGroup(userId: string, contactId: string, groupId: string) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!contact) throw new AppError(404, 'Contact not found', 'NOT_FOUND');

    await prisma.contactGroupMember.delete({
      where: { contactId_groupId: { contactId, groupId } },
    });
  }

  async syncInternalUsers(userId: string) {
    const users = await prisma.user.findMany({
      where: { id: { not: userId }, deletedAt: null },
      select: { id: true, displayName: true, firstName: true, lastName: true, username: true, email: true, avatarUrl: true },
    });

    for (const user of users) {
      const existing = await prisma.contact.findFirst({
        where: { userId, internalUserId: user.id },
      });
      if (!existing) {
        await prisma.contact.create({
          data: {
            userId,
            displayName: user.displayName,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
            isInternalUser: true,
            internalUserId: user.id,
            emails: { create: { email: user.email, label: 'work', isPrimary: true } },
          },
        });
      }
    }
  }

  async findDuplicates(userId: string) {
    const contacts = await prisma.contact.findMany({
      where: { userId, deletedAt: null },
      include: { emails: true, phones: true },
    });

    const duplicates: Array<{ contacts: typeof contacts; reason: string }> = [];
    const checked = new Set<string>();

    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const key = `${contacts[i].id}-${contacts[j].id}`;
        if (checked.has(key)) continue;
        checked.add(key);

        // Check email match
        const emails1 = contacts[i].emails.map((e) => e.email.toLowerCase());
        const emails2 = contacts[j].emails.map((e) => e.email.toLowerCase());
        const emailMatch = emails1.some((e) => emails2.includes(e));

        // Check phone match
        const phones1 = contacts[i].phones.map((p) => p.phone.replace(/\D/g, ''));
        const phones2 = contacts[j].phones.map((p) => p.phone.replace(/\D/g, ''));
        const phoneMatch = phones1.some((p) => phones2.includes(p));

        if (emailMatch) {
          duplicates.push({ contacts: [contacts[i], contacts[j]], reason: 'Same email' });
        } else if (phoneMatch) {
          duplicates.push({ contacts: [contacts[i], contacts[j]], reason: 'Same phone' });
        }
      }
    }

    return duplicates;
  }

  async mergeContacts(userId: string, primaryId: string, secondaryId: string) {
    const primary = await prisma.contact.findFirst({
      where: { id: primaryId, userId },
      include: { emails: true, phones: true, addresses: true },
    });
    const secondary = await prisma.contact.findFirst({
      where: { id: secondaryId, userId },
      include: { emails: true, phones: true, addresses: true },
    });

    if (!primary || !secondary) throw new AppError(404, 'Contact not found', 'NOT_FOUND');

    // Move unique emails/phones/addresses from secondary to primary
    for (const email of secondary.emails) {
      if (!primary.emails.some((e) => e.email === email.email)) {
        await prisma.contactEmail.update({
          where: { id: email.id },
          data: { contactId: primaryId },
        });
      }
    }
    for (const phone of secondary.phones) {
      if (!primary.phones.some((p) => p.phone === phone.phone)) {
        await prisma.contactPhone.update({
          where: { id: phone.id },
          data: { contactId: primaryId },
        });
      }
    }

    // Delete secondary
    await prisma.contact.update({
      where: { id: secondaryId },
      data: { deletedAt: new Date() },
    });

    return this.getContact(userId, primaryId);
  }

  async exportVCard(userId: string, contactId: string) {
    const contact = await this.getContact(userId, contactId);
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contact.displayName}`,
    ];
    if (contact.firstName || contact.lastName) {
      lines.push(`N:${contact.lastName || ''};${contact.firstName || ''}`);
    }
    if (contact.company) lines.push(`ORG:${contact.company}`);
    if (contact.title) lines.push(`TITLE:${contact.title}`);
    for (const email of contact.emails) {
      lines.push(`EMAIL;TYPE=${email.label.toUpperCase()}:${email.email}`);
    }
    for (const phone of contact.phones) {
      lines.push(`TEL;TYPE=${phone.label.toUpperCase()}:${phone.phone}`);
    }
    for (const addr of contact.addresses) {
      lines.push(`ADR;TYPE=${addr.label.toUpperCase()}:;;${addr.street || ''};${addr.city || ''};${addr.state || ''};${addr.zip || ''};${addr.country || ''}`);
    }
    if (contact.birthday) {
      const bday = new Date(contact.birthday);
      lines.push(`BDAY:${bday.toISOString().slice(0, 10).replace(/-/g, '')}`);
    }
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }
}

export const contactsService = new ContactsService();
