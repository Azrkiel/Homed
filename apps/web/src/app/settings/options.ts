import type { ClassYear } from '@homed/core';

export const CLASS_YEARS: { value: ClassYear; label: string }[] = [
  { value: 'first', label: 'First year' },
  { value: 'second', label: 'Second year' },
  { value: 'third', label: 'Third year' },
  { value: 'fourth', label: 'Fourth year' },
  { value: 'grad', label: 'Graduate student' },
  { value: 'phd', label: 'PhD student' },
];

export const SCHOOLS: { code: string; label: string }[] = [
  { code: 'SEAS', label: 'Engineering and Applied Science (SEAS)' },
  { code: 'COMM', label: 'McIntire School of Commerce (COMM)' },
  { code: 'CLAS', label: 'College of Arts & Sciences (CLAS)' },
  { code: 'NURS', label: 'School of Nursing (NURS)' },
  { code: 'LAW', label: 'School of Law (LAW)' },
  { code: 'DARDEN', label: 'Darden School of Business (DARDEN)' },
  { code: 'BATTEN', label: 'Batten School of Leadership and Public Policy (BATTEN)' },
  { code: 'MED', label: 'School of Medicine (MED)' },
  { code: 'ARCH', label: 'School of Architecture (ARCH)' },
  { code: 'EDUC', label: 'School of Education and Human Development (EDUC)' },
];

export const LANDMARK_KIND_LABELS: Record<string, string> = {
  social: 'Social',
  library: 'Libraries',
  dining: 'Dining',
  gym: 'Gyms',
  grocery: 'Groceries',
  worship: 'Places of worship',
  health: 'Health',
  other: 'Other',
};
