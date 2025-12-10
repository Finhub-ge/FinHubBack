export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  CONTROLLER = 'controller',
  OPERATIONAL_DIRECTOR = 'operational_director',
  ANALYST = 'analyst',
  COLLECTOR = 'collector',
  LAWYER = 'lawyer',
  JUNIOR_LAWYER = 'junior_lawyer',
  EXECUTION_LAWYER = 'execution_lawyer',
  ACCOUNTANT = 'accountant',
  AML_OFFICER = 'aml_officer',
  COURIER = 'courier',
  ANALYTICS = 'analytics',
  HR = 'hr',
  GENERAL_MANAGER = 'general_manager',
  PERSONAL_DATA_PROTECTION_OFFICER = 'personal_data_protection_officer',
  SUPER_LAWYER = 'super_lawyer',
  OPERATIONAL_MANAGER = 'operational_manager',
}

export const LAWYER_ROLES = [
  Role.LAWYER,
  Role.JUNIOR_LAWYER,
  Role.EXECUTION_LAWYER,
  Role.SUPER_LAWYER,
];