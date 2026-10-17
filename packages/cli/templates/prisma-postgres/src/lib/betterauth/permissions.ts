import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access';
import {
  defaultStatements as orgDefaults,
  adminAc as orgAdminAc,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access';

const statement = {
  ...defaultStatements,
  plan: ['create', 'read', 'update', 'delete'],
  role: ['create', 'read', 'update', 'delete'],
  settings: ['read', 'write'],
  support: ['ticket', 'user:read', 'session:revoke'],
} as const;

export const ac = createAccessControl(statement);

const admin = ac.newRole({
  ...adminAc.statements,
  user: ['impersonate-admins', ...adminAc.statements.user],
  plan: ['create', 'read', 'update', 'delete'],
  role: ['create', 'read', 'update', 'delete'],
  settings: ['read', 'write'],
  support: ['ticket', 'user:read', 'session:revoke'],
});

/** Support: ticket ops + limited user read; no plan/role/settings write. */
const support = ac.newRole({
  support: ['ticket', 'user:read', 'session:revoke'],
  user: ['list', 'get'],
  session: ['revoke'],
  plan: [],
  role: [],
  settings: [],
});

/** Developer: settings read + user list for ops. */
const developer = ac.newRole({
  settings: ['read'],
  user: ['list'],
  session: [],
  plan: [],
  role: [],
  support: [],
});

/** Finance: plan read/update only. */
const finance_officer = ac.newRole({
  plan: ['read', 'update'],
  user: [],
  session: [],
  role: [],
  settings: [],
  support: [],
});

/** Default end-user: no admin capabilities. */
const user = ac.newRole({
  user: [],
  session: [],
  plan: [],
  role: [],
  settings: [],
  support: [],
});

export const roles = {
  admin,
  support,
  developer,
  finance_officer,
  user,
};

const orgStatement = {
  ...orgDefaults,
  apiKey: ['create', 'read', 'update', 'delete'],
} as const;

export const orgAc = createAccessControl(orgStatement);

const orgOwner = orgAc.newRole({
  ...ownerAc.statements,
  apiKey: ['create', 'read', 'update', 'delete'],
});

const orgAdmin = orgAc.newRole({
  ...orgAdminAc.statements,
  apiKey: ['create', 'read', 'update', 'delete'],
});

const orgMember = orgAc.newRole({
  ...memberAc.statements,
  apiKey: ['create', 'read'],
});

export const orgRoles = {
  owner: orgOwner,
  admin: orgAdmin,
  member: orgMember,
};
