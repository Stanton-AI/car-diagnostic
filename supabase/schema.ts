import {
  pgTable, uuid, text, integer, boolean, timestamp, jsonb,
  pgEnum, index
} from 'drizzle-orm/pg-core'

// ─── Enums ──────────────────────────────────────────────────────────────
export const fuelTypeEnum = pgEnum('fuel_type', ['gasoline', 'diesel', 'hybrid', 'electric', 'lpg'])
export const urgencyEnum = pgEnum('urgency', ['HIGH', 'MID', 'LOW'])
export const userRoleEnum = pgEnum('user_role', ['user', 'admin'])
export const diagnosisModeEnum = pgEnum('diagnosis_mode', ['free', 'paid', 'ab_test'])

// ─── Users (Supabase Auth 연동) ──────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),           // auth.users.id 참조
  email: text('email').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('user').notNull(),
  provider: text('provider').notNull(),  // kakao | google
  agreedToTerms: boolean('agreed_to_terms').default(false).notNull(),
  agreedAt: timestamp('agreed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Vehicles ──────────────────────────────────────────────────────────
export const vehicles = pgTable('vehicles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  maker: text('maker').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  mileage: integer('mileage').notNull(),
  fuelType: fuelTypeEnum('fuel_type').notNull(),
  plateNumber: text('plate_number'),     // 암호화 저장
  nickname: text('nickname'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('vehicles_user_id_idx').on(table.userId),
}))

// ─── Conversations (진단 세션) ─────────────────────────────────────────
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  guestSessionId: uuid('guest_session_id'),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  messages: jsonb('messages').notNull().default([]),    // ChatMessage[]
  initialSymptom: text('initial_symptom').notNull(),
  symptomImages: text('symptom_images').array().default([]),
  finalResult: jsonb('final_result'),                  // DiagnosisResult
  selfCheckResult: jsonb('self_check_result'),          // DiagnosisResult (재진단)
  category: text('category'),                          // AI 판단 카테고리
  urgency: urgencyEnum('urgency'),
  costMin: integer('cost_min'),
  costMax: integer('cost_max'),
  isPublic: boolean('is_public').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('conversations_user_id_idx').on(table.userId),
  guestSessionIdx: index('conversations_guest_session_idx').on(table.guestSessionId),
  createdAtIdx: index('conversations_created_at_idx').on(table.createdAt),
}))

// ─── Workshops (파트너 정비소) ─────────────────────────────────────────
export const workshops = pgTable('workshops', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  categories: text('categories').array().default([]),
  rating: integer('rating'),             // 0~50 (5.0 기준 * 10)
  reviewCount: integer('review_count').default(0),
  isActive: boolean('is_active').default(true).notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Admin Config ──────────────────────────────────────────────────────
export const adminConfig = pgTable('admin_config', {
  id: integer('id').primaryKey().default(1),           // 싱글톤
  diagnosisMode: diagnosisModeEnum('diagnosis_mode').default('free').notNull(),
  freeUsersRatio: integer('free_users_ratio').default(100).notNull(), // 0~100
  guestMaxDiagnosis: integer('guest_max_diagnosis').default(1).notNull(),
  userDailyLimit: integer('user_daily_limit').default(0).notNull(),   // 0 = 무제한
  maintenanceBanner: text('maintenance_banner'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
