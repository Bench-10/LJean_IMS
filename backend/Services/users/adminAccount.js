import { SQLquery } from '../../db.js';
import { saltHashPassword } from '../Services_Utils/passwordHashing.js';

/**
 * Update administrator credentials.
 * Only fields provided in the payload are updated.
 *
 * @param {Object} params
 * @param {number} params.adminId - Administrator identifier
 * @param {string|null} [params.email] - New email/username value
 * @param {string|null} [params.newPassword] - New raw password (will be hashed)
 * @returns {Promise<Object|null>} Updated administrator row (sanitized)
 */
export const updateAdminCredentials = async ({ adminId, email = null, newPassword = null }) => {
  const numericAdminId = Number(adminId);
  if (!Number.isFinite(numericAdminId)) {
    throw new Error('Invalid administrator id');
  }

  const updates = [];
  const values = [];
  let index = 1;

  if (email) {
    updates.push(`username = $${index++}`);
    values.push(email);
  }

  if (newPassword) {
    const hashedPassword = await saltHashPassword(newPassword);
    updates.push(`password = $${index++}`);
    values.push(hashedPassword);
  }

  if (updates.length === 0) {
    const { rows } = await SQLquery(
      'SELECT admin_id, username, first_name, last_name, role FROM Administrator WHERE admin_id = $1',
      [numericAdminId]
    );
    return rows[0] ?? null;
  }

  const query = `
    UPDATE Administrator
    SET ${updates.join(', ')}
    WHERE admin_id = $${index}
    RETURNING admin_id, username, first_name, last_name, role
  `;

  values.push(numericAdminId);

  const { rows } = await SQLquery(query, values);
  return rows[0] ?? null;
};
