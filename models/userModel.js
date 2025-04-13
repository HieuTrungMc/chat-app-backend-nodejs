const { pool } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");

const model = {
  createAccount: async ({ password, ...userData }) => {
    try {
      const query = `
        INSERT INTO user (UserID, Name, Password, Phone, ImageUrl, Location, Birthday, Email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await pool.execute(query, [
        userData.id, // Using id from input, mapped to UserID in DB
        userData.name,
        password,
        userData.phone,
        userData.image || null, // image from input maps to ImageUrl in DB
        userData.location || null,
        userData.birthday || null,
        userData.email || null
      ]);

      return { ok: 1, ...userData };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  getAccountByPhone: async (phone) => {
    try {
      const query = `SELECT UserID as id, Name as name, Password as password, Phone as phone,
                            ImageUrl as image, Location as location, Birthday as birthday, Email as email
                     FROM user WHERE Phone = ?`;
      const [rows] = await pool.execute(query, [phone]);
      return rows;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  getAccountById: async (id) => {
    try {
      const query = `SELECT UserID as id, Name as name, Phone as phone,
                            ImageUrl as image, Location as location, Birthday as birthday, Email as email
                     FROM user WHERE UserID = ?`;
      const [rows] = await pool.execute(query, [Number(id)]);
      return rows;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  getAccountByEmail: async (email) => {
    try {
      const query = `SELECT UserID as id, Name as name, Password as password, Phone as phone,
                            ImageUrl as image, Location as location, Birthday as birthday, Email as email
                     FROM user WHERE Email = ?`;
      const [rows] = await pool.execute(query, [email]);
      return rows;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  updateAccount: async (accId, updateData) => {
    try {
      // Map the input field names to database column names
      const fieldMapping = {
        name: 'Name',
        password: 'Password',
        phone: 'Phone',
        image: 'ImageUrl',
        location: 'Location',
        birthday: 'Birthday',
        email: 'Email'
      };

      // Build the SET part of the query dynamically
      const setFields = [];
      const values = [];

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined && fieldMapping[key]) {
          setFields.push(`${fieldMapping[key]} = ?`);
          values.push(value);
        }
      }

      // Add the user ID to the values array for the WHERE clause
      values.push(Number(accId));

      const query = `
          UPDATE user
          SET ${setFields.join(', ')}
          WHERE UserID = ?
      `;

      await pool.execute(query, values);

      return { id: accId, ...updateData };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  changePassword: async (accId, password) => {
    try {
      const query = `UPDATE user SET Password = ? WHERE UserID = ?`;
      await pool.execute(query, [password, Number(accId)]);

      return { ok: 1, id: accId };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
};

module.exports = model;