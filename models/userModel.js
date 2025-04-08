const { dynamo } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");
const tableName = "User";

const model = {
  createAccount: async ({ password, ...userData}) => {
    //const id = uuidv4();
    const params = {
      TableName: tableName,
      Item: {
        id: userData.id,
        name: userData.name,
        password: password,
        phone: userData.phone,
        image: userData.image,
        location: userData.location,
        birthday: userData.birthday,
        email: userData.email,
      },
    };
    try {
      await dynamo.put(params).promise();
      return { ok: 1, ...userData };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  getAccountByPhone: async (phone) => {
    const params = {
      TableName: tableName,
      //IndexName: "phone-index",
      FilterExpression: "phone = :phone",
      ExpressionAttributeValues: {
        ":phone": phone,
      },
    };
    try {
      const data = await dynamo.scan(params).promise();
      return data.Items;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  getAccountById: async (id) => {
        const params = {
        TableName: tableName,
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: {
            ":id": Number(id),
        },
        };
        try {
        const data = await dynamo.query(params).promise();
            const filteredItems = data.Items.map(({ password, ...rest }) => rest); // Remove the password field
            return filteredItems;
        } catch (error) {
        console.error(error);
        throw error;
        }
    },
  getAccountByEmail : async (email) => {
    const params = {
      TableName: tableName,
      //IndexName: "email-index",
      FilterExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email,
      },
    };
    try {
      const data = await dynamo.scan(params).promise();
      return data.Items;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  updateAccount: async (accId, updateData) => {
    console.log(updateData)
    const id = Number(accId);
    const params = {
      TableName: tableName,
      Key: {id},
      UpdateExpression: "set #name = :name, #phone = :phone",
      ExpressionAttributeNames: {
        "#name": "name", "#phone": "phone",
      },
      ExpressionAttributeValues: {
        ":name": updateData.name, ":phone": updateData.phone,
      },
      ReturnValues: "ALL_NEW",
    };

    // Loop through updateData fields
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined && key !== "name" && key !== "phone") {
        params.UpdateExpression += `, #${key} = :${key}`;
        params.ExpressionAttributeNames[`#${key}`] = key;
        params.ExpressionAttributeValues[`:${key}`] = value;
      }
    }
    try {
      const result = await dynamo.update(params).promise();
      return {id: accId, ...updateData};
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  changePassword: async (accId, password) => {
    const id = Number(accId);
    const params = {
      TableName: tableName,
      Key: {id},
      UpdateExpression: "set #password = :password",
      ExpressionAttributeNames: {
        "#password": "password",
      },
      ExpressionAttributeValues: {
        ":password": password,
      },
      ReturnValues: "ALL_NEW",
    };
    try {
      const result = await dynamo.update(params).promise();
      return {ok: 1, id: accId};
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
};

module.exports = model;
