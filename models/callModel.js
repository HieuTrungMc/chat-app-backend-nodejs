const { pool } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");

class CallModel {
  static async createCall(callId, callerId, receiverId, callType) {
    try {
      const query = `
                INSERT INTO calls (call_id, caller_id, receiver_id, call_type, start_time, status) 
                VALUES (?, ?, ?, ?, NOW(), ?)
            `;
      const [result] = await pool.execute(query, [callId, callerId, receiverId, callType, 'initiated']);
      return result.insertId;
    } catch (error) {
      console.error('Error creating call record:', error);
      throw error;
    }
  }

  static async updateCallStatus(callId, status, endTime = null) {
    try {
      let query = 'UPDATE calls SET status = ? WHERE call_id = ?';
      let params = [status, callId];

      if (endTime) {
        query = 'UPDATE calls SET status = ?, end_time = NOW() WHERE call_id = ?';
      }

      const [result] = await pool.execute(query, params);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating call status:', error);
      throw error;
    }
  }

  static async getCallHistory(userId) {
    try {
      const query = `
                SELECT c.*, 
                    u1.Name as caller_name, 
                    u2.Name as receiver_name 
                FROM calls c
                JOIN user u1 ON c.caller_id = u1.UserID
                JOIN user u2 ON c.receiver_id = u2.UserID
                WHERE c.caller_id = ? OR c.receiver_id = ?
                ORDER BY c.start_time DESC
            `;
      const [calls] = await pool.execute(query, [userId, userId]);
      return calls;
    } catch (error) {
      console.error('Error fetching call history:', error);
      throw error;
    }
  }
}

module.exports = CallModel;