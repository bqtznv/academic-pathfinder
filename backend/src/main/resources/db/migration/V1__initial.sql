create table users (
 id uuid primary key, email varchar(254) unique not null, password_hash text not null,
 name varchar(120) not null, role varchar(16) not null check(role in ('STUDENT','ADVISOR','ADMIN')),
 program varchar(100) not null default 'Computer Science (EN)', curriculum_year int not null default 2024,
 advisor_id uuid references users(id), created_at timestamptz not null default now()
);
create table curricula (
 id uuid primary key, program varchar(100) not null, year int not null, version int not null,
 status varchar(16) not null check(status in ('DRAFT','PUBLISHED')), data jsonb not null,
 created_at timestamptz not null default now(), published_at timestamptz,
 unique(program,year,version)
);
create table offerings (
 id uuid primary key, course_code varchar(30) not null, season varchar(8) not null,
 year int, available boolean not null, slots jsonb not null default '[]',
 unique nulls not distinct(course_code,season,year)
);
create table academic_records (
 id uuid primary key, student_id uuid not null references users(id), course_code varchar(30) not null,
 status varchar(16) not null check(status in ('PASSED','CURRENT','FAILED','TRANSFER')),
 grade varchar(8), term varchar(20) not null, approved boolean not null default false,
 created_at timestamptz not null default now(), unique(student_id,course_code,term)
);
create table plans (
 id uuid primary key, student_id uuid not null references users(id), name varchar(100) not null,
 curriculum_id uuid not null references curricula(id), data jsonb not null,
 revision int not null default 1, submitted boolean not null default false,
 updated_at timestamptz not null default now()
);
create table reviews (
 id uuid primary key, plan_id uuid not null references plans(id) on delete cascade,
 advisor_id uuid not null references users(id), revision int not null,
 decision varchar(16) not null check(decision in ('APPROVED','CHANGES_REQUESTED')), context_hash varchar(64) not null,
 comment varchar(3000) not null, created_at timestamptz not null default now()
);
create index records_student on academic_records(student_id);
create index plans_student on plans(student_id);
