'use strict';

/**
 * LoanPro — Database Seed Script (MySQL 8)
 *
 * Populates the database with:
 *   • 1 admin user
 *   • 3 regular users
 *   • 12 sample loans spread across statuses and types
 *
 * Usage (run from anywhere in the project):
 *   node database/seed.js
 *
 * Or via npm script from backend/:
 *   npm run seed
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');

/* ── Create a temporary pool just for seeding ── */
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306', 10),
  database:           process.env.DB_NAME     || 'loan_origination_db',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  connectionLimit:    5,
  waitForConnections: true,
  timezone:           '+00:00',
});

/* ── Sample data ── */
const USERS = [
  { full_name: 'System Admin',  email: 'admin@loanpro.com',  password: 'Admin@123', role: 'admin' },
  { full_name: 'John Doe',      email: 'john@example.com',   password: 'User@123',  role: 'user'  },
  { full_name: 'Jane Smith',    email: 'jane@example.com',   password: 'User@123',  role: 'user'  },
  { full_name: 'Carlos Rivera', email: 'carlos@example.com', password: 'User@123',  role: 'user'  },
];

/* Loans indexed by position in USERS array */
const LOANS = [
  /* John (index 1) */
  { userIdx: 1, loan_amount: 25000.00,  loan_type: 'personal',  credit_score: 720, status: 'approved'  },
  { userIdx: 1, loan_amount: 180000.00, loan_type: 'home',       credit_score: 780, status: 'pending'   },
  { userIdx: 1, loan_amount: 12000.00,  loan_type: 'auto',       credit_score: 720, status: 'disbursed' },

  /* Jane (index 2) */
  { userIdx: 2, loan_amount: 55000.00,  loan_type: 'business',   credit_score: 695, status: 'disbursed' },
  { userIdx: 2, loan_amount: 18000.00,  loan_type: 'personal',   credit_score: 640, status: 'rejected'  },
  { userIdx: 2, loan_amount: 30000.00,  loan_type: 'education',  credit_score: 710, status: 'approved'  },
  { userIdx: 2, loan_amount: 8500.00,   loan_type: 'auto',       credit_score: 695, status: 'pending'   },

  /* Carlos (index 3) */
  { userIdx: 3, loan_amount: 95000.00,  loan_type: 'home',       credit_score: 760, status: 'approved'  },
  { userIdx: 3, loan_amount: 40000.00,  loan_type: 'business',   credit_score: 720, status: 'pending'   },
  { userIdx: 3, loan_amount: 15000.00,  loan_type: 'personal',   credit_score: 580, status: 'rejected'  },
  { userIdx: 3, loan_amount: 22000.00,  loan_type: 'education',  credit_score: 740, status: 'disbursed' },
  { userIdx: 3, loan_amount: 11000.00,  loan_type: 'auto',       credit_score: 760, status: 'pending'   },
];

/* ── Main ── */
async function seed() {
  /* Get a dedicated connection so we can use transactions */
  const conn = await pool.getConnection();

  try {
    console.log('\n🌱  Starting MySQL database seed…\n');

    await conn.beginTransaction();

    /* ── Seed users ── */
    const insertedUserIds = [];

    for (const u of USERS) {
      const hash = await bcrypt.hash(u.password, 12);

      /*
       * INSERT … ON DUPLICATE KEY UPDATE
       * MySQL equivalent of PostgreSQL's ON CONFLICT (email) DO UPDATE.
       * If the email already exists the row is updated in-place.
       */
      const [result] = await conn.query(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           full_name     = VALUES(full_name),
           password_hash = VALUES(password_hash),
           role          = VALUES(role)`,
        [u.full_name, u.email, hash, u.role]
      );

      /*
       * ON DUPLICATE KEY UPDATE sets insertId = 0 when a row already
       * existed and was updated. In that case, look up the id by email.
       */
      let userId = result.insertId;
      if (!userId) {
        const [[existing]] = await conn.query(
          'SELECT id FROM users WHERE email = ?', [u.email]
        );
        userId = existing.id;
      }

      insertedUserIds.push(userId);
      console.log(`   ✅ User  [${u.role.padEnd(5)}]  ${u.email}  (password: ${u.password})`);
    }

    /* ── Seed loans ── */
    console.log('');
    let loanCount = 0;

    for (const l of LOANS) {
      const userId = insertedUserIds[l.userIdx];
      if (!userId) continue;

      await conn.query(
        `INSERT INTO loans (user_id, loan_amount, loan_type, credit_score, status)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, l.loan_amount, l.loan_type, l.credit_score, l.status]
      );

      const amt = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
      }).format(l.loan_amount);

      console.log(
        `   💳 Loan  [${l.status.padEnd(9)}]  ${amt.padStart(12)}  ${l.loan_type.padEnd(9)}  (score: ${l.credit_score})`
      );
      loanCount++;
    }

    await conn.commit();

    console.log('\n─────────────────────────────────────────────');
    console.log(`  Seeded ${USERS.length} users  +  ${loanCount} loans  ✓`);
    console.log('─────────────────────────────────────────────');
    console.log('\n  Demo credentials:');
    console.log('    Admin  →  admin@loanpro.com  /  Admin@123');
    console.log('    User   →  john@example.com   /  User@123');
    console.log('─────────────────────────────────────────────\n');

  } catch (err) {
    await conn.rollback();
    console.error('\n❌  Seed failed — transaction rolled back.');
    console.error(err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

seed();
