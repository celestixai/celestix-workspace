import { PrismaClient, ChatType, MemberRole, ChannelType, TaskPriority, TaskStatus, EmailFolder, StatusGroup, SpaceRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const password = await bcrypt.hash('Password123', 12);

  // Create users
  const users = await Promise.all([
    prisma.user.create({ data: { email: 'alice@celestix.local', passwordHash: password, displayName: 'Alice Chen', firstName: 'Alice', lastName: 'Chen', isAdmin: true, status: 'ONLINE' } }),
    prisma.user.create({ data: { email: 'bob@celestix.local', passwordHash: password, displayName: 'Bob Martinez', firstName: 'Bob', lastName: 'Martinez', bio: 'Full-stack developer' } }),
    prisma.user.create({ data: { email: 'carol@celestix.local', passwordHash: password, displayName: 'Carol Williams', firstName: 'Carol', lastName: 'Williams', bio: 'Product designer' } }),
    prisma.user.create({ data: { email: 'david@celestix.local', passwordHash: password, displayName: 'David Kim', firstName: 'David', lastName: 'Kim', bio: 'DevOps engineer' } }),
    prisma.user.create({ data: { email: 'emma@celestix.local', passwordHash: password, displayName: 'Emma Johnson', firstName: 'Emma', lastName: 'Johnson', bio: 'Project manager' } }),
    prisma.user.create({ data: { email: 'frank@celestix.local', passwordHash: password, displayName: 'Frank Brown', firstName: 'Frank', lastName: 'Brown', bio: 'Backend developer' } }),
    prisma.user.create({ data: { email: 'grace@celestix.local', passwordHash: password, displayName: 'Grace Lee', firstName: 'Grace', lastName: 'Lee', bio: 'UX researcher' } }),
    prisma.user.create({ data: { email: 'henry@celestix.local', passwordHash: password, displayName: 'Henry Davis', firstName: 'Henry', lastName: 'Davis', bio: 'Data scientist' } }),
    prisma.user.create({ data: { email: 'iris@celestix.local', passwordHash: password, displayName: 'Iris Patel', firstName: 'Iris', lastName: 'Patel', bio: 'Frontend developer' } }),
    prisma.user.create({ data: { email: 'jack@celestix.local', passwordHash: password, displayName: 'Jack Wilson', firstName: 'Jack', lastName: 'Wilson', bio: 'CTO' } }),
  ]);

  const [alice, bob, carol, david, emma, frank, grace, henry, iris, jack] = users;

  // Create calendars for each user
  for (const user of users) {
    await prisma.calendar.create({
      data: { userId: user.id, name: 'Personal', color: '#4F8EF7', isDefault: true },
    });
  }

  // ==================
  // MESSENGER
  // ==================

  // DM: Alice <-> Bob
  const dm1 = await prisma.chat.create({
    data: {
      type: 'DIRECT',
      members: {
        create: [
          { userId: alice.id, role: 'MEMBER' },
          { userId: bob.id, role: 'MEMBER' },
        ],
      },
    },
  });

  const dmMessages = [
    { chatId: dm1.id, senderId: alice.id, content: 'Hey Bob! Have you seen the new design specs?' },
    { chatId: dm1.id, senderId: bob.id, content: 'Yeah, I looked at them this morning. The dashboard layout looks great!' },
    { chatId: dm1.id, senderId: alice.id, content: 'Awesome! Can you start implementing the chart components today?' },
    { chatId: dm1.id, senderId: bob.id, content: 'Sure thing. I\'ll use Recharts for the analytics dashboard.' },
    { chatId: dm1.id, senderId: alice.id, content: 'Perfect. Let me know if you need any design assets.' },
  ];

  for (const msg of dmMessages) {
    await prisma.message.create({ data: msg });
  }

  // Group: Team Alpha
  const group1 = await prisma.chat.create({
    data: {
      type: 'GROUP',
      name: 'Team Alpha',
      description: 'Core product development team',
      members: {
        create: [
          { userId: alice.id, role: 'OWNER' },
          { userId: bob.id, role: 'ADMIN' },
          { userId: carol.id, role: 'MEMBER' },
          { userId: david.id, role: 'MEMBER' },
          { userId: emma.id, role: 'MEMBER' },
        ],
      },
    },
  });

  const groupMessages = [
    { chatId: group1.id, senderId: emma.id, content: 'Team standup in 15 minutes!' },
    { chatId: group1.id, senderId: alice.id, content: 'I\'ll be presenting the Q1 roadmap updates' },
    { chatId: group1.id, senderId: david.id, content: 'The CI/CD pipeline is ready for the new staging environment' },
    { chatId: group1.id, senderId: carol.id, content: 'I\'ve uploaded the new component library designs to Figma' },
    { chatId: group1.id, senderId: bob.id, content: 'Great work everyone! Let\'s sync up after the standup' },
  ];

  for (const msg of groupMessages) {
    await prisma.message.create({ data: msg });
  }

  // More DMs
  const dm2 = await prisma.chat.create({
    data: {
      type: 'DIRECT',
      members: {
        create: [
          { userId: alice.id, role: 'MEMBER' },
          { userId: carol.id, role: 'MEMBER' },
        ],
      },
    },
  });
  await prisma.message.create({ data: { chatId: dm2.id, senderId: carol.id, content: 'Can you review the mockups I sent yesterday?' } });

  // Channel
  const channel1 = await prisma.chat.create({
    data: {
      type: 'CHANNEL',
      name: 'Engineering Updates',
      description: 'Important engineering announcements',
      members: {
        create: users.map((u) => ({
          userId: u.id,
          role: u.id === alice.id ? 'OWNER' as const : 'MEMBER' as const,
        })),
      },
    },
  });

  await prisma.message.create({
    data: { chatId: channel1.id, senderId: alice.id, content: 'Version 2.0 release scheduled for next Friday. All features must be merged by Wednesday EOD.' },
  });
  await prisma.message.create({
    data: { chatId: channel1.id, senderId: david.id, content: 'Infrastructure migration complete. All services now running on the new cluster.' },
  });

  // ==================
  // WORKSPACE
  // ==================

  const workspace = await prisma.workspace.create({
    data: {
      name: 'Celestix HQ',
      slug: 'celestix-hq',
      description: 'Main workspace for the Celestix team',
      members: {
        create: users.map((u) => ({
          userId: u.id,
          role: u.id === alice.id ? 'OWNER' as const : u.id === jack.id ? 'ADMIN' as const : 'MEMBER' as const,
        })),
      },
    },
  });

  const channels = [
    { name: 'general', description: 'General discussion', type: 'PUBLIC' as const },
    { name: 'engineering', description: 'Engineering team chat', type: 'PUBLIC' as const },
    { name: 'design', description: 'Design team discussion', type: 'PUBLIC' as const },
    { name: 'random', description: 'Non-work banter', type: 'PUBLIC' as const },
    { name: 'announcements', description: 'Company-wide announcements', type: 'PUBLIC' as const },
    { name: 'leadership', description: 'Leadership team', type: 'PRIVATE' as const },
  ];

  for (const ch of channels) {
    const channel = await prisma.wsChannel.create({
      data: {
        workspaceId: workspace.id,
        name: ch.name,
        description: ch.description,
        type: ch.type,
        createdById: alice.id,
        members: {
          create: users.map((u) => ({
            userId: u.id,
            isStarred: ch.name === 'general',
          })),
        },
      },
    });

    // Add some messages to each channel
    if (ch.name === 'general') {
      await prisma.wsMessage.create({ data: { channelId: channel.id, senderId: alice.id, content: 'Welcome to the Celestix Workspace! This is the general channel for team-wide discussions.' } });
      await prisma.wsMessage.create({ data: { channelId: channel.id, senderId: jack.id, content: 'Thanks for setting this up, Alice! Looking forward to collaborating here.' } });
      await prisma.wsMessage.create({ data: { channelId: channel.id, senderId: grace.id, content: 'This looks amazing! Love the interface.' } });
    }
    if (ch.name === 'engineering') {
      await prisma.wsMessage.create({ data: { channelId: channel.id, senderId: bob.id, content: 'PR #142 is ready for review - adds the new authentication flow' } });
      await prisma.wsMessage.create({ data: { channelId: channel.id, senderId: frank.id, content: 'I\'ll take a look at it this afternoon' } });
      await prisma.wsMessage.create({ data: { channelId: channel.id, senderId: david.id, content: 'Don\'t forget to update the API docs when you merge' } });
    }
  }

  // ==================
  // HIERARCHY (Spaces, Folders, Lists)
  // ==================

  // Create 3 Spaces
  const engineeringSpace = await prisma.space.create({
    data: {
      workspaceId: workspace.id,
      name: 'Engineering',
      description: 'Engineering team workspace',
      color: '#4A90D9',
      icon: 'code',
      createdById: alice.id,
      taskIdPrefix: 'ENG',
    },
  });

  const designSpace = await prisma.space.create({
    data: {
      workspaceId: workspace.id,
      name: 'Design',
      description: 'Design team workspace',
      color: '#E91E63',
      icon: 'palette',
      createdById: carol.id,
      taskIdPrefix: 'DES',
    },
  });

  const marketingSpace = await prisma.space.create({
    data: {
      workspaceId: workspace.id,
      name: 'Marketing',
      description: 'Marketing team workspace',
      color: '#4CAF50',
      icon: 'megaphone',
      createdById: emma.id,
      taskIdPrefix: 'MKT',
    },
  });

  // Default statuses for each space
  const defaultStatuses = [
    { name: 'To Do', color: '#87909E', statusGroup: 'NOT_STARTED' as const, position: 0, isDefault: true },
    { name: 'In Progress', color: '#4A90D9', statusGroup: 'ACTIVE' as const, position: 0 },
    { name: 'In Review', color: '#FFA500', statusGroup: 'ACTIVE' as const, position: 1 },
    { name: 'Complete', color: '#6BC950', statusGroup: 'DONE' as const, position: 0 },
    { name: 'Closed', color: '#808080', statusGroup: 'CLOSED' as const, position: 0 },
  ];

  for (const space of [engineeringSpace, designSpace, marketingSpace]) {
    for (const status of defaultStatuses) {
      await prisma.spaceStatus.create({
        data: {
          spaceId: space.id,
          name: status.name,
          color: status.color,
          statusGroup: status.statusGroup,
          position: status.position,
          isDefault: status.isDefault || false,
        },
      });
    }
  }

  // Default task types for each space
  const defaultTaskTypes = [
    { name: 'Task', icon: 'check-square', color: '#4A90D9', isDefault: true, position: 0 },
    { name: 'Bug', icon: 'bug', color: '#E91E63', isDefault: false, position: 1 },
    { name: 'Feature', icon: 'star', color: '#9C27B0', isDefault: false, position: 2 },
    { name: 'Milestone', icon: 'flag', color: '#FF9800', isDefault: false, position: 3 },
  ];

  const taskTypesBySpace: Record<string, any[]> = {};
  for (const space of [engineeringSpace, designSpace, marketingSpace]) {
    taskTypesBySpace[space.id] = [];
    for (const tt of defaultTaskTypes) {
      const created = await prisma.taskType.create({
        data: {
          spaceId: space.id,
          name: tt.name,
          icon: tt.icon,
          color: tt.color,
          isDefault: tt.isDefault,
          position: tt.position,
        },
      });
      taskTypesBySpace[space.id].push(created);
    }
  }

  // Space Members
  // Engineering: Alice (admin), Bob, Carol, David, Frank, Iris
  const engMembers = [
    { userId: alice.id, role: 'ADMIN' as const },
    { userId: bob.id, role: 'MEMBER' as const },
    { userId: carol.id, role: 'MEMBER' as const },
    { userId: david.id, role: 'MEMBER' as const },
    { userId: frank.id, role: 'MEMBER' as const },
    { userId: iris.id, role: 'MEMBER' as const },
  ];
  for (const m of engMembers) {
    await prisma.spaceMember.create({ data: { spaceId: engineeringSpace.id, ...m } });
  }

  // Design: Carol (admin), Grace, Alice
  const designMembers = [
    { userId: carol.id, role: 'ADMIN' as const },
    { userId: grace.id, role: 'MEMBER' as const },
    { userId: alice.id, role: 'MEMBER' as const },
  ];
  for (const m of designMembers) {
    await prisma.spaceMember.create({ data: { spaceId: designSpace.id, ...m } });
  }

  // Marketing: Emma (admin), Henry
  const mktMembers = [
    { userId: emma.id, role: 'ADMIN' as const },
    { userId: henry.id, role: 'MEMBER' as const },
  ];
  for (const m of mktMembers) {
    await prisma.spaceMember.create({ data: { spaceId: marketingSpace.id, ...m } });
  }

  // Folders
  const backendFolder = await prisma.folder.create({
    data: { spaceId: engineeringSpace.id, name: 'Backend', color: '#4A90D9', icon: 'server', createdById: alice.id },
  });
  const frontendFolder = await prisma.folder.create({
    data: { spaceId: engineeringSpace.id, name: 'Frontend', color: '#61DAFB', icon: 'layout', createdById: bob.id, position: 1 },
  });
  const uiKitFolder = await prisma.folder.create({
    data: { spaceId: designSpace.id, name: 'UI Kit', color: '#E91E63', icon: 'paintbrush', createdById: carol.id },
  });

  // TaskLists
  const apiDevList = await prisma.taskList.create({
    data: { spaceId: engineeringSpace.id, folderId: backendFolder.id, name: 'API Development', color: '#4A90D9', createdById: alice.id },
  });
  const bugFixesList = await prisma.taskList.create({
    data: { spaceId: engineeringSpace.id, folderId: backendFolder.id, name: 'Bug Fixes', color: '#EF4444', createdById: bob.id, position: 1 },
  });
  const componentsList = await prisma.taskList.create({
    data: { spaceId: engineeringSpace.id, folderId: frontendFolder.id, name: 'Components', color: '#61DAFB', createdById: iris.id },
  });
  const pagesList = await prisma.taskList.create({
    data: { spaceId: engineeringSpace.id, folderId: frontendFolder.id, name: 'Pages', color: '#8B5CF6', createdById: bob.id, position: 1 },
  });
  const devOpsList = await prisma.taskList.create({
    data: { spaceId: engineeringSpace.id, name: 'DevOps', description: 'Infrastructure and deployment tasks', color: '#F59E0B', createdById: david.id },
  });
  const designSystemList = await prisma.taskList.create({
    data: { spaceId: designSpace.id, folderId: uiKitFolder.id, name: 'Design System', color: '#E91E63', createdById: carol.id },
  });
  const campaignsList = await prisma.taskList.create({
    data: { spaceId: marketingSpace.id, name: 'Campaigns', color: '#4CAF50', createdById: emma.id },
  });
  const contentList = await prisma.taskList.create({
    data: { spaceId: marketingSpace.id, name: 'Content', color: '#10B981', createdById: henry.id, position: 1 },
  });

  // ==================
  // EMAIL
  // ==================

  const emailData = [
    { userId: alice.id, folder: 'INBOX' as const, fromAddress: 'ceo@company.com', fromName: 'CEO', subject: 'Q1 Planning Meeting', bodyText: 'Let\'s schedule our quarterly planning session for next week.', toAddresses: [{ email: alice.email, name: alice.displayName }] },
    { userId: alice.id, folder: 'INBOX' as const, fromAddress: 'hr@company.com', fromName: 'HR Department', subject: 'Updated PTO Policy', bodyText: 'Please review the updated paid time off policy attached.', toAddresses: [{ email: alice.email, name: alice.displayName }] },
    { userId: alice.id, folder: 'SENT' as const, fromAddress: alice.email, fromName: alice.displayName, subject: 'Re: Project Timeline', bodyText: 'I\'ve updated the timeline based on our discussion. Please review.', toAddresses: [{ email: bob.email, name: bob.displayName }] },
    { userId: alice.id, folder: 'DRAFTS' as const, fromAddress: alice.email, fromName: alice.displayName, subject: 'Team Performance Review', bodyText: 'Draft of the performance review template...', toAddresses: [{ email: emma.email, name: emma.displayName }] },
    { userId: bob.id, folder: 'INBOX' as const, fromAddress: alice.email, fromName: alice.displayName, subject: 'Code Review Request', bodyText: 'Can you please review PR #205? It includes the new auth flow.', toAddresses: [{ email: bob.email, name: bob.displayName }] },
  ];

  for (const email of emailData) {
    await prisma.email.create({ data: email });
  }

  // ==================
  // CALENDAR
  // ==================

  const aliceCalendar = await prisma.calendar.findFirst({ where: { userId: alice.id, isDefault: true } });

  if (aliceCalendar) {
    const now = new Date();
    const events = [
      { title: 'Sprint Planning', startAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), endAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), color: '#4F8EF7' },
      { title: 'Design Review', startAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), endAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000), color: '#8B5CF6' },
      { title: 'Team Standup', startAt: new Date(now.getTime() + 3600000), endAt: new Date(now.getTime() + 2 * 3600000), color: '#10B981', recurrenceRule: 'FREQ=DAILY;COUNT=30' },
      { title: 'Lunch with Carol', startAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 12 * 3600000), endAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 13 * 3600000), color: '#F59E0B' },
      { title: 'All Hands Meeting', startAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 14 * 3600000), endAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 15 * 3600000), color: '#EF4444', allDay: false },
    ];

    for (const event of events) {
      await prisma.calendarEvent.create({
        data: {
          calendarId: aliceCalendar.id,
          title: event.title,
          startAt: event.startAt,
          endAt: event.endAt,
          color: event.color,
          recurrenceRule: event.recurrenceRule,
          allDay: event.allDay || false,
          createdById: alice.id,
        },
      });
    }
  }

  // ==================
  // TASKS
  // ==================

  const project1 = await prisma.project.create({
    data: {
      name: 'Website Redesign',
      description: 'Complete redesign of the company website',
      color: '#4F8EF7',
      icon: 'globe',
      createdById: alice.id,
      members: {
        create: [
          { userId: alice.id, role: 'OWNER' },
          { userId: bob.id, role: 'MEMBER' },
          { userId: carol.id, role: 'MEMBER' },
          { userId: iris.id, role: 'MEMBER' },
        ],
      },
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'Mobile App v2',
      description: 'Second version of the mobile application',
      color: '#8B5CF6',
      icon: 'smartphone',
      createdById: jack.id,
      members: {
        create: [
          { userId: jack.id, role: 'OWNER' },
          { userId: frank.id, role: 'MEMBER' },
          { userId: david.id, role: 'MEMBER' },
          { userId: bob.id, role: 'MEMBER' },
        ],
      },
    },
  });

  const tasks = [
    { projectId: project1.id, title: 'Design homepage mockup', status: 'DONE' as const, priority: 'HIGH' as const, createdById: alice.id },
    { projectId: project1.id, title: 'Implement responsive navigation', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const, createdById: bob.id },
    { projectId: project1.id, title: 'Create component library', status: 'IN_PROGRESS' as const, priority: 'MEDIUM' as const, createdById: carol.id },
    { projectId: project1.id, title: 'Write API documentation', status: 'TODO' as const, priority: 'MEDIUM' as const, createdById: alice.id },
    { projectId: project1.id, title: 'SEO optimization', status: 'BACKLOG' as const, priority: 'LOW' as const, createdById: emma.id },
    { projectId: project1.id, title: 'Performance audit', status: 'TODO' as const, priority: 'HIGH' as const, createdById: david.id },
    { projectId: project1.id, title: 'Accessibility review', status: 'BACKLOG' as const, priority: 'MEDIUM' as const, createdById: grace.id },
    { projectId: project2.id, title: 'Setup React Native project', status: 'DONE' as const, priority: 'URGENT' as const, createdById: jack.id },
    { projectId: project2.id, title: 'Implement auth screens', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const, createdById: frank.id },
    { projectId: project2.id, title: 'Design push notification system', status: 'TODO' as const, priority: 'MEDIUM' as const, createdById: david.id },
    { projectId: project2.id, title: 'Offline sync strategy', status: 'BACKLOG' as const, priority: 'HIGH' as const, createdById: bob.id },
  ];

  for (let i = 0; i < tasks.length; i++) {
    await prisma.task.create({
      data: {
        ...tasks[i],
        position: i * 1000,
        dueDate: new Date(Date.now() + (i + 1) * 2 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Hierarchy tasks (in spaces/lists created above, linked to project1)
  // Lookup task type IDs for engineering space
  const engTypes = taskTypesBySpace[engineeringSpace.id];
  const engTaskTypeId = engTypes.find((t: any) => t.name === 'Task')?.id;
  const engBugTypeId = engTypes.find((t: any) => t.name === 'Bug')?.id;
  const engFeatureTypeId = engTypes.find((t: any) => t.name === 'Feature')?.id;
  const engMilestoneTypeId = engTypes.find((t: any) => t.name === 'Milestone')?.id;
  const designTypes = taskTypesBySpace[designSpace.id];
  const designTaskTypeId = designTypes.find((t: any) => t.name === 'Task')?.id;
  const mktTypes = taskTypesBySpace[marketingSpace.id];
  const mktTaskTypeId = mktTypes.find((t: any) => t.name === 'Task')?.id;

  const hierarchyTasks = [
    // Engineering tasks (ENG-001 through ENG-009)
    { projectId: project1.id, listId: apiDevList.id, title: 'Design REST endpoints for Spaces API', statusName: 'Complete', statusColor: '#6BC950', priority: 'HIGH' as const, createdById: alice.id, position: 1000, taskTypeId: engFeatureTypeId, customTaskId: 'ENG-001' },
    { projectId: project1.id, listId: apiDevList.id, title: 'Implement folder CRUD service', statusName: 'In Progress', statusColor: '#4A90D9', priority: 'HIGH' as const, createdById: frank.id, position: 2000, taskTypeId: engTaskTypeId, customTaskId: 'ENG-002' },
    { projectId: project1.id, listId: apiDevList.id, title: 'Add pagination to list endpoints', statusName: 'To Do', statusColor: '#87909E', priority: 'MEDIUM' as const, createdById: bob.id, position: 3000, taskTypeId: engTaskTypeId, customTaskId: 'ENG-003' },
    { projectId: project1.id, listId: bugFixesList.id, title: 'Fix race condition in message delivery', statusName: 'In Progress', statusColor: '#4A90D9', priority: 'URGENT' as const, createdById: bob.id, position: 1000, taskTypeId: engBugTypeId, customTaskId: 'ENG-004' },
    { projectId: project1.id, listId: bugFixesList.id, title: 'Memory leak in WebSocket handler', statusName: 'To Do', statusColor: '#87909E', priority: 'HIGH' as const, createdById: david.id, position: 2000, taskTypeId: engBugTypeId, customTaskId: 'ENG-005' },
    { projectId: project1.id, listId: componentsList.id, title: 'Build SpacesSidebar component', statusName: 'In Progress', statusColor: '#4A90D9', priority: 'HIGH' as const, createdById: iris.id, position: 1000, taskTypeId: engFeatureTypeId, customTaskId: 'ENG-006' },
    { projectId: project1.id, listId: componentsList.id, title: 'Create StatusManager widget', statusName: 'To Do', statusColor: '#87909E', priority: 'MEDIUM' as const, createdById: carol.id, position: 2000, taskTypeId: engTaskTypeId, customTaskId: 'ENG-007' },
    { projectId: project1.id, listId: devOpsList.id, title: 'Setup staging environment', statusName: 'Complete', statusColor: '#6BC950', priority: 'HIGH' as const, createdById: david.id, position: 1000, taskTypeId: engMilestoneTypeId, customTaskId: 'ENG-008' },
    { projectId: project1.id, listId: devOpsList.id, title: 'Configure CI/CD pipeline', statusName: 'In Review', statusColor: '#FFA500', priority: 'MEDIUM' as const, createdById: david.id, position: 2000, taskTypeId: engTaskTypeId, customTaskId: 'ENG-009' },
    // Design tasks (DES-001 through DES-002)
    { projectId: project1.id, listId: designSystemList.id, title: 'Define color tokens', statusName: 'Complete', statusColor: '#6BC950', priority: 'HIGH' as const, createdById: carol.id, position: 1000, taskTypeId: designTaskTypeId, customTaskId: 'DES-001' },
    { projectId: project1.id, listId: designSystemList.id, title: 'Design button variants', statusName: 'In Progress', statusColor: '#4A90D9', priority: 'MEDIUM' as const, createdById: grace.id, position: 2000, taskTypeId: designTaskTypeId, customTaskId: 'DES-002' },
    // Marketing tasks (MKT-001 through MKT-002)
    { projectId: project1.id, listId: campaignsList.id, title: 'Plan Q2 product launch campaign', statusName: 'In Progress', statusColor: '#4A90D9', priority: 'HIGH' as const, createdById: emma.id, position: 1000, taskTypeId: mktTaskTypeId, customTaskId: 'MKT-001' },
    { projectId: project1.id, listId: contentList.id, title: 'Write blog post: New Features', statusName: 'To Do', statusColor: '#87909E', priority: 'MEDIUM' as const, createdById: henry.id, position: 1000, taskTypeId: mktTaskTypeId, customTaskId: 'MKT-002' },
  ];

  for (const t of hierarchyTasks) {
    await prisma.task.create({ data: t });
  }

  // Update task ID counters to match the number of seeded tasks
  await prisma.space.update({ where: { id: engineeringSpace.id }, data: { taskIdCounter: 9 } });
  await prisma.space.update({ where: { id: designSpace.id }, data: { taskIdCounter: 2 } });
  await prisma.space.update({ where: { id: marketingSpace.id }, data: { taskIdCounter: 2 } });

  // Sample checklists on tasks
  const firstTask = await prisma.task.findFirst({ where: { title: 'Design REST endpoints for Spaces API' } });
  if (firstTask) {
    const cl1 = await prisma.checklist.create({
      data: {
        taskId: firstTask.id,
        name: 'Endpoint Checklist',
        items: {
          create: [
            { name: 'GET /spaces - list spaces', isCompleted: true, position: 0 },
            { name: 'POST /spaces - create space', isCompleted: true, position: 1 },
            { name: 'PATCH /spaces/:id - update space', isCompleted: true, position: 2 },
            { name: 'DELETE /spaces/:id - delete space', isCompleted: false, position: 3 },
          ],
        },
      },
    });
  }

  const bugTask = await prisma.task.findFirst({ where: { title: 'Fix race condition in message delivery' } });
  if (bugTask) {
    await prisma.checklist.create({
      data: {
        taskId: bugTask.id,
        name: 'Investigation Steps',
        items: {
          create: [
            { name: 'Reproduce the race condition', isCompleted: true, position: 0 },
            { name: 'Add mutex lock to message handler', isCompleted: false, position: 1, assigneeId: bob.id },
            { name: 'Write regression test', isCompleted: false, position: 2, assigneeId: frank.id },
          ],
        },
      },
    });
  }

  const designTask = await prisma.task.findFirst({ where: { title: 'Define color tokens' } });
  if (designTask) {
    await prisma.checklist.create({
      data: {
        taskId: designTask.id,
        name: 'Color System',
        items: {
          create: [
            { name: 'Primary palette', isCompleted: true, position: 0 },
            { name: 'Semantic colors (success, error, warning)', isCompleted: true, position: 1 },
            { name: 'Dark mode variants', isCompleted: false, position: 2 },
            { name: 'Document in Storybook', isCompleted: false, position: 3 },
          ],
        },
      },
    });
  }

  // ==================
  // FILES
  // ==================

  const filesData = [
    { userId: alice.id, name: 'Documents', type: 'FOLDER' as const },
    { userId: alice.id, name: 'Images', type: 'FOLDER' as const },
    { userId: alice.id, name: 'Q1 Report.pdf', type: 'FILE' as const, mimeType: 'application/pdf', sizeBytes: BigInt(2456789) },
    { userId: alice.id, name: 'Budget 2024.xlsx', type: 'FILE' as const, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeBytes: BigInt(567890) },
    { userId: alice.id, name: 'Meeting Notes.docx', type: 'FILE' as const, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: BigInt(123456) },
    { userId: bob.id, name: 'Projects', type: 'FOLDER' as const },
    { userId: bob.id, name: 'Architecture Diagram.png', type: 'FILE' as const, mimeType: 'image/png', sizeBytes: BigInt(3456789) },
  ];

  for (const file of filesData) {
    await prisma.file.create({ data: file });
  }

  // ==================
  // NOTES
  // ==================

  const notesFolder = await prisma.noteFolder.create({
    data: { userId: alice.id, name: 'Work Notes' },
  });

  await prisma.note.create({
    data: {
      userId: alice.id,
      folderId: notesFolder.id,
      title: 'Sprint Planning Notes',
      contentText: 'Goals for this sprint:\n1. Complete auth flow\n2. Design dashboard\n3. Setup CI/CD pipeline',
      contentJson: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Sprint Planning Notes' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Goals for this sprint:' }] },
          { type: 'orderedList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Complete auth flow' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Design dashboard' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Setup CI/CD pipeline' }] }] },
          ]},
        ],
      },
      isPinned: true,
    },
  });

  await prisma.note.create({
    data: {
      userId: alice.id,
      title: 'API Design Ideas',
      contentText: 'REST vs GraphQL considerations for the new API...',
      isStarred: true,
    },
  });

  // ==================
  // CONTACTS
  // ==================

  // Create contacts for Alice (including internal users)
  for (const user of users) {
    if (user.id === alice.id) continue;
    await prisma.contact.create({
      data: {
        userId: alice.id,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        isInternalUser: true,
        internalUserId: user.id,
        emails: { create: { email: user.email, label: 'work', isPrimary: true } },
      },
    });
  }

  // External contacts for Alice
  await prisma.contact.create({
    data: {
      userId: alice.id,
      displayName: 'Sarah Thompson',
      firstName: 'Sarah',
      lastName: 'Thompson',
      company: 'Acme Corp',
      title: 'VP of Sales',
      isFavorite: true,
      emails: { create: { email: 'sarah@acme.com', label: 'work', isPrimary: true } },
      phones: { create: { phone: '+1-555-0123', label: 'mobile', isPrimary: true } },
    },
  });

  // Contact groups
  await prisma.contactGroup.create({
    data: { userId: alice.id, name: 'Team', color: '#4F8EF7' },
  });
  await prisma.contactGroup.create({
    data: { userId: alice.id, name: 'Clients', color: '#10B981' },
  });

  console.log('Seed completed successfully!');
  console.log('Demo accounts:');
  console.log('  alice@celestix.local / Password123 (admin)');
  console.log('  bob@celestix.local / Password123');
  console.log('  ... and 8 more users');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
