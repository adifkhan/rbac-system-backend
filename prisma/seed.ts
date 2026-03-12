import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create permissions
  const permissions = [
    // Dashboard
    {
      name: 'dashboard:view',
      resource: 'dashboard',
      action: 'view',
      description: 'View dashboard',
    },

    // Users
    {
      name: 'users:view',
      resource: 'users',
      action: 'view',
      description: 'View users',
    },
    {
      name: 'users:create',
      resource: 'users',
      action: 'create',
      description: 'Create users',
    },
    {
      name: 'users:update',
      resource: 'users',
      action: 'update',
      description: 'Update users',
    },
    {
      name: 'users:delete',
      resource: 'users',
      action: 'delete',
      description: 'Delete users',
    },

    // Leads
    {
      name: 'leads:view',
      resource: 'leads',
      action: 'view',
      description: 'View leads',
    },
    {
      name: 'leads:create',
      resource: 'leads',
      action: 'create',
      description: 'Create leads',
    },
    {
      name: 'leads:update',
      resource: 'leads',
      action: 'update',
      description: 'Update leads',
    },
    {
      name: 'leads:delete',
      resource: 'leads',
      action: 'delete',
      description: 'Delete leads',
    },

    // Tasks
    {
      name: 'tasks:view',
      resource: 'tasks',
      action: 'view',
      description: 'View tasks',
    },
    {
      name: 'tasks:create',
      resource: 'tasks',
      action: 'create',
      description: 'Create tasks',
    },
    {
      name: 'tasks:update',
      resource: 'tasks',
      action: 'update',
      description: 'Update tasks',
    },
    {
      name: 'tasks:delete',
      resource: 'tasks',
      action: 'delete',
      description: 'Delete tasks',
    },

    // Reports
    {
      name: 'reports:view',
      resource: 'reports',
      action: 'view',
      description: 'View reports',
    },
    {
      name: 'reports:create',
      resource: 'reports',
      action: 'create',
      description: 'Create reports',
    },

    // Audit
    {
      name: 'audit:view',
      resource: 'audit',
      action: 'view',
      description: 'View audit logs',
    },

    // Settings
    {
      name: 'settings:view',
      resource: 'settings',
      action: 'view',
      description: 'View settings',
    },
    {
      name: 'settings:update',
      resource: 'settings',
      action: 'update',
      description: 'Update settings',
    },
  ];

  console.log('Creating permissions...');
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  // Create roles
  console.log('Creating roles...');
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      description: 'Full system access',
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'Manager' },
    update: {},
    create: {
      name: 'Manager',
      description: 'Team management access',
    },
  });

  const agentRole = await prisma.role.upsert({
    where: { name: 'Agent' },
    update: {},
    create: {
      name: 'Agent',
      description: 'Basic operations access',
    },
  });

  const customerRole = await prisma.role.upsert({
    where: { name: 'Customer' },
    update: {},
    create: {
      name: 'Customer',
      description: 'Customer portal access',
    },
  });

  // Assign all permissions to Admin
  console.log('Assigning permissions to Admin role...');
  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Assign some permissions to Manager
  console.log('Assigning permissions to Manager role...');
  const managerPermissions = [
    'dashboard:view',
    'users:view',
    'users:create',
    'users:update',
    'leads:view',
    'leads:create',
    'leads:update',
    'tasks:view',
    'tasks:create',
    'reports:view',
  ];

  const managerPerms = await prisma.permission.findMany({
    where: { name: { in: managerPermissions } },
  });

  for (const permission of managerPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: managerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: managerRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Assign some permissions to Agent
  console.log('Assigning permissions to Agent role...');
  const agentPermissions = [
    'dashboard:view',
    'leads:view',
    'leads:update',
    'tasks:view',
    'tasks:update',
  ];

  const agentPerms = await prisma.permission.findMany({
    where: { name: { in: agentPermissions } },
  });

  for (const permission of agentPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: agentRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: agentRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Create users
  console.log('Creating users...');

  // Admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      roleId: adminRole.id,
      isActive: true,
      isBanned: false,
    },
  });

  // Manager user
  const managerPassword = await bcrypt.hash('manager123', 10);
  await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      password: managerPassword,
      firstName: 'Manager',
      lastName: 'User',
      roleId: managerRole.id,
      isActive: true,
      isBanned: false,
    },
  });

  // Agent user
  const agentPassword = await bcrypt.hash('agent123', 10);
  await prisma.user.upsert({
    where: { email: 'agent@example.com' },
    update: {},
    create: {
      email: 'agent@example.com',
      password: agentPassword,
      firstName: 'Agent',
      lastName: 'User',
      roleId: agentRole.id,
      isActive: true,
      isBanned: false,
    },
  });

  // Customer user
  const customerPassword = await bcrypt.hash('customer123', 10);
  await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      password: customerPassword,
      firstName: 'Customer',
      lastName: 'User',
      roleId: customerRole.id,
      isActive: true,
      isBanned: false,
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
